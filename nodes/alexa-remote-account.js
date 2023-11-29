const util = require('util');
const fs = require('fs');
const readFileAsync = util.promisify(fs.readFile);
const EventEmitter = require('events');

const AlexaRemote = require('../lib/alexa-remote-ext.js');
const tools = require('../lib/common.js');
const pjson = require('../package.json')

// we are building all sorts of json payloads to send to the webpage when
// initializing the account (can be updated via an 'update' query or account.updateAlexa)
// they are built by the account.builders and stored in account.ui
// any error that happens during building these payloads are reported in
// the json payload account.ui.errors

const uiJsonBuilders = {
	devices: async (alexa, fresh = true) => {
		function getIcon(device) {
			switch(device.deviceFamily) {
				case 'TABLET':                        return 'f10a'; // tablet
				case 'VOX':                           return 'f007'; // user
				case 'THIRD_PARTY_AVS_MEDIA_DISPLAY': return 'f135'; // app
				case 'ECHO':                          return 'f270'; // amazon
				case 'FIRE_TV':                       return 'f06d'; // fire
				case 'WHA':                           return 'f247'; // object-group
				case 'AMAZONMOBILEMUSIC_ANDROID':     return 'f17b'; // android
				default:                              return 'f059'; // question-circle
			}
		}
	
		function getLabel(device) {
			return `&#x${getIcon(device)};  ${device.accountName}`
		}
	
		function getSortValue(device) {
			let value = device.accountName ? device.accountName.charCodeAt(0) : 0;
		
			switch(device.deviceFamily) {
				case 'ECHO':                          value -= 1000;
				case 'WHA':                           value -= 1000;
				case 'FIRE_TV':                       value -= 1000;
				case 'TABLET':                        value -= 1000;
				case 'VOX':                           value -= 1000;
				case 'THIRD_PARTY_AVS_MEDIA_DISPLAY': value -= 1000;
				case 'AMAZONMOBILEMUSIC_ANDROID':     value -= 1000;
				default:                              value -= 1000;
			}
		
			return value;
		}
	
		if(fresh) {
			await alexa.initDevicesExt();
		}
	
		return JSON.stringify(Array.from(alexa.deviceByIdExt.values())
       		.filter(d => d.deviceFamily != 'WHA' || d.clusterMembers.length > 0)
			.sort((a,b) => getSortValue(a) - getSortValue(b))
			.map(x => [x.serialNumber, getLabel(x), x.capabilities])
		);
	},
	smarthome: async (alexa, fresh = true) => {
		function getIcon(applianceType) {
			switch(applianceType) {
				case 'LIGHT':               return 'f0eb'; // lightbulb-o 
				case 'SWITCH':              return 'f205'; // toggle-on
				case 'THERMOSTAT':          return 'f2c9'; // thermometer-half
				case 'SMARTLOCK':           return 'f084'; // key
				case 'SCENE_TRIGGER':       return 'f144'; // play-circle
				case 'ACTIVITY_TRIGGER':    return 'f0f3'; // bell
				case 'HUB':                 return 'f233'; // server
				case 'ECHO': /*not native*/ return 'f270'; // amazon
				case 'OTHER':               return 'f2db'; // microchip
				default:                    return 'f128'; // question
			}
		}
	
		function getLabel(entity) {
			if(entity.type === 'APPLIANCE') {
				return entity.applianceTypes.map(getIcon).map(c => `&#x${c};`).join('') + `  ${entity.name}`;
			}
			else {
				const icon = 'f247'; // object-group
				return `&#x${icon};  ${entity.name}`; 
			}
		}

		if(fresh) {
			await Promise.all([
				alexa.initSmarthomeSimplifiedExt(),
				alexa.initSmarthomeColorsExt(),
			]);
		}
	
		const entityById = Array.from(alexa.smarthomeSimplifiedByEntityIdExt.values())
			.filter(e => !e.isDuplicate)
			.sort((a, b) => {
				if (a.type !== b.type) {
					return a.type === 'APPLIANCE' ? -1 : 1;
				}
	
				const an = a.name.toLowerCase();
				const bn = b.name.toLowerCase();
	
				return an < bn ? -1 : an > bn ? 1 : 0;
			})
			.reduce((obj, entity) => (obj[entity.entityId] =
				[getLabel(entity), entity.properties, entity.actions, entity.type],
				obj), {});
	
		const colorNames = Array.from(alexa.colorNameToLabelExt.entries());
		const colorTemperatureNames = Array.from(alexa.colorTemperatureNameToLabelExt.entries());
	
		//tools.log({smarthomeForUi: smarthomeForUi}, 10, 250);
		return JSON.stringify({
			entityById: entityById,
			colorNames: colorNames,
			colorTemperatureNames: colorTemperatureNames,
		});
	},
	bluetooth: async (alexa, fresh = true) => {
		function getLabel(device) {
			return device.friendlyName;
		}
	
		return JSON.stringify((await alexa.getBluetoothPromise()).bluetoothStates
			.filter(state => Array.isArray(state.pairedDeviceList))
			.reduce((o, state) => (o[state.deviceSerialNumber] = state.pairedDeviceList
				.map(device => [device.address, getLabel(device)]
			), o), {})
		);
	},
	notifications: async (alexa, fresh = true) => {
		function getLabel(not) {
			if(!tools.matches(not, { type: '', status: '', id: ''})) return `&#xf059;  ???`;
		
			const name = not.type === 'Timer' ? not.timerLabel : not.reminderLabel;
			const suffix = not.status === 'ON' ? '' : ` (${String(not.status).toLowerCase()})`;
			const icon = not.type === 'Timer' ? 'f017' : not.type === 'Alarm' ? 'f0f3' : not.type === 'Reminder' ? 'f073' : 'f059';
			const shortId = not.id.slice(not.id.lastIndexOf('-') + 1);
			const shortTime = (not.originalTime || '').slice(0, 5);
		
			return `&#x${icon};  ${name || (not.type === 'Alarm' ? shortTime : shortId)}${suffix}`;
		}

		const getSortValue = (noti) => {
			const name = noti.type === 'Timer' ? noti.timerLabel : noti.reminderLabel;		
		
			const nameValue = name ? name.charCodeAt(0) : 1000;
		
			const typeValue = 
					noti.type === 'Timer' ? 0
				: noti.type === 'Alarm' ? 10000
				: noti.type === 'Reminder' ? 20000
				: 30000;
		
			return nameValue + typeValue;
		};

		return JSON.stringify(Array.from(alexa.notificationByIdExt.values())
			.sort((a,b) => getSortValue(a) - getSortValue(b))
			.map(noti => [noti.notificationIndex, getLabel(noti), noti.type, noti.deviceSerialNumber])
		);
	},
	routines: async (alexa, fresh = true) => {
		function getLabel(routine, smarthomeSimplifiedByEntityIdExt) {
			routine = tools.isObject(routine) && routine || {};
			const id = String(routine.automationId);
			const trigger = Array.isArray(routine.triggers) && routine.triggers[0] || {}; 
			const type = trigger.type || '';
			const disabled = routine.status === 'DISABLED';
			const suffix = disabled ? ' (disabled)' : '';
		
			// const shortId = 
			// 	  id.startsWith('amzn1.alexa.automation') 				? id.slice(id.lastIndexOf('-') + 1) 
			// 	: id.startsWith('amzn1.alexa.behaviors.preconfigured') 	? tools.keyToLabel(id.slice(id.lastIndexOf(':') + 1, tools.nthIndexOf(id, '_', 1)))
			// 	: '???';
		
			if(type.startsWith('Alexa.Trigger.Alarms')) {
				let action = type.slice(type.lastIndexOf('.') + 1);
				if(action === 'NotificationStopped') action = 'dismissed';
				return `&#xf0f3;  Alarm ${tools.keyToLabel(action)}${suffix}`; //bell
			}
		
			if(type.startsWith('Alexa.Trigger.Gadget.EchoButton')) {
				let action = type.slice(type.lastIndexOf('.') + 1);
				let shortId = trigger.payload.gadgetDsn.slice(-3);
				if(action === 'ButtonPress') action = 'pressed';
				return `&#xf111;  Button ${shortId} ${tools.keyToLabel(action)}${suffix}`; // circle
			}
		
			if(type === 'CustomUtterance') {
				const utterance = trigger.payload.utterance;
				return `&#xf130;  "${utterance}"`; // microphone
			}
		
			if(type === 'motionSensorDetectionStateTrigger') {
				const entityId = trigger.payload.target;
				const entity = smarthomeSimplifiedByEntityIdExt.get(entityId);
				const name = entity && entity.name || '???';
				return `&#xf047;  Motion in ${name}${suffix}`; // arrows
			}
		
			if(type === 'AbsoluteTimeSchedule') {
				const time = trigger.schedule && trigger.schedule.triggerTime || '??????';
				const formatted = `${time.slice(0,2)}:${time.slice(2,4)}:${time.slice(4,6)}`;
				return `&#xf017;  Schedule ${formatted}${suffix}`; // clock-o
			}
		
			return `&#xf059;  ${id}${suffix}`; // question-circle
		}

		if(fresh) {
			await alexa.initRoutinesExt();
		}

		return JSON.stringify(Array.from(alexa.routineByIdExt.values())
			.sort((a,b) => (a.status === 'DISABLED' ? 1 : -1) - (b.status === 'DISABLED' ? 1 : -1))
			.map(routine => [routine.automationId, getLabel(routine, alexa.smarthomeSimplifiedByEntityIdExt)]));
	},
	musicProviders: async(alexa, fresh = true) => {
		if(fresh) {
			await alexa.initMusicProvidersExt();
		}

		return JSON.stringify(alexa.musicProvidersExt
			.filter(provider => provider.supportedOperations.includes('Alexa.Music.PlaySearchPhrase'))
			.map(provider => [provider.id, provider.displayName]));
	},
	skills: async(alexa, fresh = true) => {
		function getIcon(skill) {
			switch(skill.type) {
				case 'CUSTOM':           return 'f013'; // cog
				case 'SMART_HOME':       return 'f015'; // home
				case 'CONTENT':          return 'f1ea'; // newspaper-o
				default:                 return 'f059'; // question-circle
			}
		}
	
		function getLabel(skill) {
			return `&#x${getIcon(skill)};  ${skill.name}`;
		}

		return JSON.stringify((await alexa.getSkillsExt())
			.map(o => [o.id, getLabel(o)])
		);
	},
	lists: async (alexa, fresh = true) => {
		function getIcon(list) {
			switch(list.type) {
				case 'SHOPPING_LIST': return 'f07a'; // shopping-cart
				case 'TO_DO':         return 'f14a'; // check-square
				default:              return 'f03a'; // list
			}
		}
	
		function getName(list) {
			if(list.name) return list.name;
	
			switch(list.type) {
				case 'SHOPPING_LIST': return 'Shopping';
				case 'TO_DO':         return 'To-do';
				default:              return 'Unnamed';
			}
		}
	
		function getLabel(list) {
			return `&#x${getIcon(list)};  ${getName(list)}`;
		}
	
		return JSON.stringify((await alexa.getListsPromise())
			.filter(x => x.archived == false)
			.map(x => [x.itemId, getLabel(x)])
		);
	},
};

function accountHttpResponse(RED, property, label, req, res) {
	const account = RED.nodes.getNode(req.query.account);
	
	if(!account) {
		res.writeHeader(400, {'Content-Type': 'text/plain'});
		return res.end(`Could not load ${label}: Account not deployed!`);
	}
	
	if(account.state.code !== 'READY') {
		res.writeHeader(400, {'Content-Type': 'text/plain'});
		return res.end(`Could not load ${label}: Account not initialised!`);
	}
	
	// this won't throw, update failures are reported through ui.errors
	(req.query.refresh === '1' ? account.builders[property]() : Promise.resolve()).then(() => {
		if(!account.ui.hasOwnProperty(property)) {
			res.writeHeader(500, {'Content-Type': 'text/plain'});
			return res.end(`Could not load ${label}: Account is missing "${property}" property!`);
		}

		res.writeHeader(200, {'Content-Type': 'application/json'});
		res.end(typeof account.ui[property] === 'string' ? account.ui[property] : JSON.stringify(account.ui[property]));
	});
}

module.exports = function (RED) {
	function AlexaRemoteAccountNode(input) {
		RED.nodes.createNode(this, input);

		tools.assign(this, ['authMethod', 'proxyOwnIp', 'proxyPort', 'cookieFile', 'refreshInterval', 'alexaServiceHost', 'pushDispatchHost', 'amazonPage', 'acceptLanguage', 'onKeywordInLanguage', 'userAgent'], input);
		this.usePushConnection = input.usePushConnection === 'on';
		this.autoQueryActivityOnTrigger = input.autoQueryActivityOnTrigger === "on";
		this.autoInit  = input.autoInit  === 'on';
		this.name = input.name;
		this.onKeywordInLanguage = input.onKeywordInLanguage;
		this.locale = this.acceptLanguage;
		this.refreshInterval = Number(this.refreshInterval) * 1000 * 60 * 60 * 24;
		if(this.refreshInterval < 15000) this.refreshInterval = NaN;

		this.alexa = new AlexaRemote().setMaxListeners(32);
		this.emitter = new EventEmitter().setMaxListeners(128);
		this.initing = false;
		this.state = { code: 'UNINITIALISED', message: '' };
		this.debugCb = tools.nodeGetDebugCb(this);
		this.logCb = tools.nodeGetLogCb(this);
		this.warnCb = tools.nodeGetWarnCb(this);
		this.errorCb = tools.nodeGetErrorCb(this);

		this.refreshTimeoutStartTime = null;
		this.refreshTimeout = null;
		this.errorMessages = {};
		this.ui = {};
		this.builders = {};

		this.buildUiErrorJson = async () => {
			const a = this.errorMessages;
			const b = this.alexa.errorMessagesExt;
			const keys = new Set(Object.getOwnPropertyNames(a), Object.getOwnPropertyNames(b));
			const combined = {};

			for(const key of keys) {
				combined[key] = a[key] || b[key];
			}

			this.ui.errors = JSON.stringify(combined);
		};
		this.buildUiJson = async (fresh = true) => {
			await Promise.all(Object.values(this.builders).map(fn => fn(fresh)));
		};
		this.captureErrorMessage = async function(name, asyncFn) {
			return asyncFn().then(some => {
				delete this.errorMessages[name];
				this.buildUiErrorJson();
				return some;
			}).catch(error => {
				this.errorMessages[name] = error.message;
				this.buildUiErrorJson();
				throw error;
			}).catch(this.warnCb);
		};
				
		Object.keys(uiJsonBuilders).forEach(key => {
			this.builders[key] = async(fresh = true) => this.captureErrorMessage(key, async () => {
				this.ui[key] = await uiJsonBuilders[key](this.alexa, fresh);
			});
		});

		this.setState = function(code, message) {
			this.state = {
				code: code,
				message: message || code
			};
			this.emitter.emit('state', code, message);
		};
		this.renewTimeout = function() {
			if(this.refreshTimeout !== null) {
				clearTimeout(this.refreshTimeout);
				this.refreshTimeout = null;
			}

			if(!this.refreshInterval) return;
			if(this.state.code !== 'READY') return;

			this.refreshTimeoutStartTime = Date.now();
			this.refreshTimeout = setTimeout(() => {
				this.log('auto refreshing cookie...');
				this.refreshAlexa().catch(this.errorCb);
			}, this.refreshInterval);
		};
		this.resetAlexa = function () {
			if(this.refreshTimeout !== null) {
				clearTimeout(this.refreshTimeout);
				this.refreshTimeout = null;
			}
			if (!this.alexa) return;
			this.alexa.resetExt();
			this.initialised = false;
			this.alexa = new AlexaRemote();

      this.ui.smarthome      = JSON.stringify({ entityById: {}, colorNames: [], colorTemperatureNames: []});
      this.ui.devices        = JSON.stringify([]);
      this.ui.notifications  = JSON.stringify([]);
      this.ui.routines       = JSON.stringify([]);
      this.ui.musicProviders = JSON.stringify([]);
      this.ui.bluetooth      = JSON.stringify({});
      this.ui.errors         = JSON.stringify({});
      this.ui.skills         = JSON.stringify([]);

			this.errorMessages = {};

			this.setState('UNINITIALISED');
		};

		this.initAlexa = async function(input, ignoreFile = false) {
			if(this.initing)  {
				this.debugCb('Already initializing Alexa!');
				return;
			}
			this.initing = true;

			let config = {};
			tools.assign(config, ['proxyOwnIp', 'proxyPort', 'alexaServiceHost', 'pushDispatchHost', 'amazonPage', 'acceptLanguage', 'onKeywordInLanguage', 'userAgent', 'usePushConnection', 'autoQueryActivityOnTrigger'], this);
			config.logger = this.debugCb;
			config.refreshCookieInterval = 0;
			config.proxyLogLevel = 'warn';
			config.cookieJustCreated = true; // otherwise it just tries forever...
			config.bluetooth = false;
			config.setupProxy = false;
			config.apiUserAgentPostfix = pjson.name + '/' + pjson.version;

			switch (this.authMethod) {
				case 'proxy':
					config.proxyOnly = true; // should not matter					

					const cookieData = tools.isObject(input) && input.loginCookie && tools.clone(input)
						 || this.cookieFile && !ignoreFile && await readFileAsync(this.cookieFile, 'utf8').then(json => JSON.parse(json)).catch(this.warnCb)
						 || undefined;

					config.cookie = cookieData;
					break;
				case 'cookie':
					tools.assign(config, ['cookie'], this.credentials);
					break;
				case 'password':
					tools.assign(config, ['email', 'password'], this.credentials);
					break;
			}

			if (!config.amazonPageProxyLanguage) config.amazonPageProxyLanguage = config.acceptLanguage && config.acceptLanguage.replace('-', '_') || undefined;

			// guess authentication method that AlexaRemote will use
			// useful if we want to drive init by input
			// currently initType should not differ this.authMethod
			const initType = config.cookie ? (config.cookie.loginCookie ? 'proxy' : 'cookie') : (config.email && config.password ? 'password' : 'proxy');

			this.resetAlexa();
			
			switch(initType) {
				case 'proxy': this.setState('INIT_PROXY'); break;
				case 'cookie': this.setState('INIT_COOKIE'); break;
				case 'password': this.setState('INIT_PASSWORD'); break;
			}

			this.logCb(`intialising ${this.name ? `"${this.name}" ` : ''}with the ${initType.toUpperCase()} method and ${config.cookie ? '' : 'NO '}saved data...`);

			this.debugCb(`Alexa-Remote: starting initialisation:`);
			this.debugCb(`Alexa-Remote: ${JSON.stringify({authMethod: this.authMethod, initType: initType, cookie: config.cookie})}`);

			// the this.alexa we init could change once the this.alexa.initExt is complete because
			// this.resetAlexa() or this.initAlexa() might have been called again during this time
			// so we need to check if this.alexa has changed and if so handle it differently
			const alexa = this.alexa;

			const proxyWaitCallback = (url) => {
				if(alexa !== this.alexa) return;
				const text = `open ${url} in your browser`;
				this.warn(text);
				this.setState('WAIT_PROXY', text);
			};

			if(initType === 'proxy') {
				await tools.portAvailable(config.proxyPort).catch(error => {
					if(error.code === 'EADDRINUSE') error.message = `port ${config.proxyPort} already in use`;
					this.setState('ERROR', error.message);
					this.initing = false;
					throw error;
				});
			}

			const cookieData = await alexa.initExt(config, proxyWaitCallback, this.warnCb).catch(error => {
				if(alexa !== this.alexa) return;
				this.setState('ERROR', error && error.message);
				this.initing = false;
				throw error;
			});

			// see above why
			if(alexa !== this.alexa) {
				this.initing = false;
				throw new Error('Initialisation was aborted!');
			}

			if(this.authMethod === 'proxy' && this.cookieFile) {
				const data = alexa.cookieData;
				const json = JSON.stringify(data);
				try { fs.writeFileSync(this.cookieFile, json, 'utf8'); }
				catch (error) { this.warnCb(error); }
			}
			
			await this.buildUiJson(false);

			this.alexa.on('change-device', _ => this.builders.devices().catch(this.warnCb));
			this.alexa.on('change-smarthome', _ => this.builders.smarthome().catch(this.warnCb));
			this.alexa.on('change-notification', _ => this.builders.notifications().catch(this.warnCb));

			// see above why
			if(alexa !== this.alexa) {
				this.initing = false;
				throw new Error('Initialisation was aborted!');
			}

			this.setState('READY');
			this.renewTimeout();
			this.initing = false;
			return cookieData;
		};
		this.refreshAlexa = async function() {
			if(this.state.code !== 'READY') throw new Error('account must be initialised before refreshing');
			this.setState('REFRESH');

			//return this.alexa.refreshExt().then(value => {
			return this.initAlexa(undefined).then(value => {
				this.setState('READY');
				this.renewTimeout();
				return value;
			}).catch(error => {
				this.setState('ERROR', error && error.message);
				this.renewTimeout();
				throw error;
			});
		};
		this.updateAlexa = async function() {
			if(this.state.code !== 'READY') throw new Error('account must be initialised before updating');
			this.setState('UPDATE');

			return this.alexa.updateExt().then(async value => {
				await this.buildUiJson(false);
				this.setState('READY');
				return value;
			}).catch(error => {
				this.setState('ERROR', error && error.message);
				throw error;
			});
		};

		this.on('close', function () {
			this.resetAlexa();
		});
		
		if(this.autoInit) {
			this.initAlexa(undefined).catch(this.errorCb);
		}
	}

	RED.nodes.registerType("alexa-remote-account", AlexaRemoteAccountNode, {
		credentials: {
			cookie: { type: 'text' },
			email: { type: 'text' },
			password: { type: 'password' },
		}
	});

	RED.httpAdmin.get('/alexa-remote-error-messages.json', RED.auth.needsPermission('alexa-remote.read'), (req, res) => accountHttpResponse(RED, 'errors', 'Error Messages', req, res));
	RED.httpAdmin.get('/alexa-remote-skills.json',         RED.auth.needsPermission('alexa-remote.read'), (req, res) => accountHttpResponse(RED, 'skills', 'Skills', req, res));
	RED.httpAdmin.get('/alexa-remote-routines.json',       RED.auth.needsPermission('alexa-remote.read'), (req, res) => accountHttpResponse(RED, 'routines', 'Routines', req, res));
	RED.httpAdmin.get('/alexa-remote-musicProviders.json', RED.auth.needsPermission('alexa-remote.read'), (req, res) => accountHttpResponse(RED, 'musicProviders', 'Music Providers', req, res));
	RED.httpAdmin.get('/alexa-remote-devices.json',        RED.auth.needsPermission('alexa-remote.read'), (req, res) => accountHttpResponse(RED, 'devices', 'Devices', req, res));
	RED.httpAdmin.get('/alexa-remote-smarthome.json',      RED.auth.needsPermission('alexa-remote.read'), (req, res) => accountHttpResponse(RED, 'smarthome', 'Smarthome Devices', req, res));
	RED.httpAdmin.get('/alexa-remote-bluetooth.json',      RED.auth.needsPermission('alexa-remote.read'), (req, res) => accountHttpResponse(RED, 'bluetooth', 'Bluetooth Devices', req, res));
	RED.httpAdmin.get('/alexa-remote-notifications.json',  RED.auth.needsPermission('alexa-remote.read'), (req, res) => accountHttpResponse(RED, 'notifications', 'Notifications', req, res));
	RED.httpAdmin.get('/alexa-remote-lists.json',          RED.auth.needsPermission('alexa-remote.read'), (req, res) => accountHttpResponse(RED, 'lists', 'Lists', req, res));

	// we request sounds on demand because they are per device
	RED.httpAdmin.get('/alexa-remote-sounds.json', RED.auth.needsPermission('alexa-remote.read'), (req, res) => {
		const account = RED.nodes.getNode(req.query.account);
		const device = req.query.device;
		const label = 'Sounds';

		if (!account) {
			res.writeHeader(400, { 'Content-Type': 'text/plain' });
			return res.end(`Could not load ${label}: Account not deployed!`);
		}

		if (account.state.code !== 'READY') {
			res.writeHeader(400, { 'Content-Type': 'text/plain' });
			return res.end(`Could not load ${label}: Account not initialised!`);
		}

		account.alexa.getSoundsExt(device).then(sounds => {
			const pairs = sounds.map(sound => [JSON.stringify(sound), sound.displayName]);
			res.writeHeader(200, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify(pairs));
		}).catch(error => {
			res.writeHeader(400, { 'Content-Type': 'text/plain' });
			return res.end(`Could not load sounds: "${error}"`);
		});
	});
};