const tools = require('../lib/common.js');
const convert = require('../lib/color-convert.js');

module.exports = function (RED) {

	function AlexaRemoteSmarthome(input) {
		RED.nodes.createNode(this, input);
		tools.assign(this, ['config', 'outputs'], input);
		tools.assignNode(RED, this, ['account'], input);
		if(!tools.nodeSetup(this, input, true)) return;

		this.on('input', function (msg) {
			const send = tools.nodeGetSendCb(this, msg);
			const error = tools.nodeGetErrorCb(this);
			if(this.account.state.code !== 'READY') return error('Account not initialised!');
			this.status({ shape: 'dot', fill: 'grey', text: 'sending' });
			const alexa = this.account.alexa;
			const option = this.config.option;
			let value = this.config.value;
			const invalid = (what) => error(`invalid input: "${JSON.stringify(what || this.config)}"`);

			switch(option) {
				case 'get': {
					switch(value) {
						case 'devices': 	return alexa.getSmarthomeDevicesPromise().then(send).catch(error);
						case 'groups': 		return alexa.getSmarthomeGroupsPromise().then(send).catch(error);
						case 'entities': 	return alexa.getSmarthomeEntitiesPromise().then(send).catch(error);
						case 'definitions': return alexa.getSmarthomeBehaviourActionDefinitionsPromise().then(send).catch(error);
						case 'simplified': 	return alexa.smarthomeSimplifiedByEntityIdExt ? send(alexa.smarthomeSimplifiedByEntityIdExt) : error('Not available?!');
						default: 			return invalid();
					}
				}
				case 'query': {
					if(!Array.isArray(value)) return invalid();

					// i don't know either (that's what amazon expects...)
					const getIdForQuery = (entity) => entity.type === 'APPLIANCE' ? entity.applianceId : entity.entityId;

					const queries = value.length === 0 ? msg.payload : value;

					if(!tools.matches(queries, [{ entity: '' }])) {
						return error(`query: input must be an array of objects with the string property "entity" and optionally "property"`);
					}
					
					const entities = queries.map(query => {
						const entity = alexa.findSmarthomeEntityExt(query.entity);
						if(!entity) error(`smarthome entity not found: "${query.entity}"`, query.entity);
						return entity;
					});
					if(entities.includes(undefined)) return;


					const requests = Array.from(new Set(entities)).map(entity => ({entityType: entity.type, entityId: getIdForQuery(entity)}));

					return alexa.querySmarthomeDevicesExt(requests).then(response => {
						if(tools.matches(response, {message: ''})) return error(`error response: ${response.message}`);

						if(!tools.matches(response, { 
							deviceStates: [{ entity: { entityId: '', entityType: ''}, capabilityStates: ['']}],
							errors: [{ entity: { entityId: '', entityType: '' }}]
						})) {
							return error(`unexpected response layout: "${JSON.stringify(response)}"`);
						}

						const stateById = new Map();
						const errorById = new Map();

						for(const state of response.deviceStates) {
							const simplified = {};
							simplified.id = state.entity.entityId;
							simplified.type = state.entity.type;
							if(state.error) simplified.error = state.error;
							simplified.properties = state.capabilityStates
								.map(json => tools.tryParseJson(json))
								.filter(cap => tools.isObject(cap))
								.reduce((o,cap) => (o[cap.name] = cap.value, o), {});

							stateById.set(simplified.id, simplified);
						}

						for(const errEntry of response.errors) {
							errorById.set(errEntry.entity.entityId, errEntry);
						}

						// tools.log({states: stateById, errors: errorById});

						const mapQueryToMsg = (entity, query, reportErrors = true) => {
							if(!entity) {
								return null;
							}

							if(entity.type === 'GROUP') {
								const msg = {};
								msg.id = entity.entityId;
								msg.type = 'GROUP';
								msg.topic = entity.name;
								msg.payload = entity.children
									.filter(e => e.type !== 'GROUP')
									.map(e => mapQueryToMsg(e, query, false))
									.filter(m => m);

								return msg;
							}

							const id = getIdForQuery(entity);
							const state = stateById.get(id);
							if(!state) {
								if(reportErrors) {
									const errorObj = errorById.get(id) || { message: `no response for smarthome entity "${entity.name}" (${id})!`};
									error(errorObj.message || errorObj.code || JSON.stringify(errorObj), errorObj);								
								}
								return null;
							}

							if(query.property && query.property !== 'all') {
								const msg = tools.clone(state);
								msg.payload = msg.properties[query.property];
								switch(query.property) { 
									case 'color': { 
										const native = msg.payload;
										if(!tools.isObject(native)) break;
										const hsv = [native.hue, native.saturation, native.brightness];

										switch(query.format) {
											case 'hex': msg.payload = convert.hsv2hex(hsv); break;
											case 'rgb': msg.payload = convert.hsv2rgb(hsv); break;
											case 'hsv': msg.payload = hsv; break;
										}
										break;
									}
								}
								msg.topic = entity.name;
								delete msg.properties;
								return msg;
							}
							else {
								const msg = tools.clone(state);
								msg.payload = msg.properties;
								msg.topic = entity.name;
								delete msg.properties;
								return msg;
							}
						}

						const msgs = queries.map((query,i) => mapQueryToMsg(entities[i], query));
						tools.nodeSendMultiple(RED, this, msg, msgs, this.outputs);
					}).catch(error);	
				}
				case 'action': {
					if(!Array.isArray(value)) return invalid();

					const inputs = value.length === 0 ? msg.payload : value.map(input => {
						const result = {};
						result.entity = input.entity;
						result.action = input.action;

						for(const key of ['value', 'scale']) {
							const param = input[key];
							if(!tools.isObject(param)) continue;
							result[key] = RED.util.evaluateNodeProperty(param.value, param.type, this, msg);
						}
						
						return result;
					});

					if(!tools.matches(inputs, [{ entity: '', action: '' }])) {
						return error(`action: input must be an array of objects with the string properties "entity" and "action"`);
					}

					const entities = inputs.map(input => {
						const entity = alexa.findSmarthomeEntityExt(input.entity);
						if(!entity) error(`smarthome entity not found: "${input.entity}"`, input.entity);
						return entity;
					});
					if(entities.includes(undefined)) return;

					let requests = new Array(inputs.length);
					for(let i = 0; i < inputs.length; i++) {
						const input = inputs[i];
						const entity = entities[i];
						if(!entity) return;
						
						const native = requests[i] = {};
						native.entityId = entity.entityId;
						native.entityType = entity.entityType;
						native.parameters = { action: input.action };
						
						switch(input.action) {
							case 'setColor': {
								const name = alexa.findSmarthomeColorNameExt(input.value);
								if(!name) return error(`could not find closest color name of "${input.value}"`);
								native.parameters['colorName'] = name;
								break;
							}
							case 'setColorTemperature': {
								const name = alexa.findSmarthomeColorTemperatureNameExt(input.value);
								if(!name) return error(`could not find closest color name of "${input.value}"`);
								native.parameters['colorTemperatureName'] = name;
								break;
							}
							case 'setBrightness': {
								native.parameters['brightness'] = Number(input.value);
								break;
							}
							case 'setPercentage': {
								native.parameters['percentage'] = Number(input.value);
								break;
							}
							case 'setLockState': 
							case 'lockAction': {
								native.parameters['targetLockState.value'] = String(input.value).trim().toUpperCase();
								break;
							}
							case 'setTargetTemperature': {
								native.parameters['targetTemperature.value'] = Number(input.value);
								native.parameters['targetTemperature.scale'] = String(input.scale || 'celsius').trim().toUpperCase();
								break;
							}
						}
					}

					requests = requests.filter(o => o);

					return alexa.executeSmarthomeDeviceActionExt(requests).then(response => {
						if(tools.matches(response, {message: ''})) return error(`error response: ${response.message}`);

						if(!tools.matches(response, { 
							controlResponses: [{ entityId: '' }],
							errors: [{ entity: { entityId: '', entityType: '' }}]
						})) {
							return error(`unexpected response layout: "${JSON.stringify(response)}"`);
						}

						const controlResponseById = new Map();
						const errorById = new Map();

						for(const controlResponse of response.controlResponses) {
							controlResponseById.set(controlResponse.entityId, controlResponse);
						}

						for(const errEntry of response.errors) {
							errorById.set(errEntry.entity.entityId, errEntry);
						}

						const msgs = inputs.map((input, i) => {
							const entity = entities[i];
							if(!entity) return null;

							const id = entity.entityId;
							const controlResponse = controlResponseById.get(id);
							if(!controlResponse) {
								const errorObj = errorById.get(id) || {message: `no response for smarthome entity: "${entity.name}" (${id})!`};
								error(errorObj.message, errorObj);
							}

							return controlResponse;
						});
						tools.nodeSendMultiple(RED, this, msg, msgs, this.outputs);
					}).catch(error);
				}
				case 'discover': {
					return alexa.discoverSmarthomeDevicePromise().then(send).catch(error);
				}
				case 'forget': {
					if(!tools.matches(value, { what: '' })) {
						return error(`invalid input: "${JSON.stringify(this.config)}"`);
					}
					
					switch(value.what) {
						case 'device': {
							if(!tools.matches(value, { entity: {type: '', value: ''} })) return error(`invalid input: "${JSON.stringify(this.config)}"`);
							const id = RED.util.evaluateNodeProperty(value.entity.value, value.entity.type, this, msg);
							return alexa.deleteSmarthomeDeviceExt(id).then(send).catch(error);
						}		
						case 'group': {
							if(!tools.matches(value, { entity: {type: '', value: ''} })) return error(`invalid input: "${JSON.stringify(this.config)}"`);
							const id = RED.util.evaluateNodeProperty(value.entity.value, value.entity.type, this, msg);
							return alexa.deleteSmarthomeGroupExt(id).then(send).catch(error);
						}		
						case 'allDevices': 	{
							return alexa.deleteAllSmarthomeDevicesExt().then(send).catch(error);
						}
						default: {
							return error(`invalid input: "${JSON.stringify(this.config)}"`);
						}
					}
				}
				default: {
					return invalid();
				}
			}
		});
	}
	RED.nodes.registerType("alexa-remote-smarthome", AlexaRemoteSmarthome);
};