const tools = require('../lib/common.js');


module.exports = function (RED) {

	function AlexaRemoteEcho(input) {
		RED.nodes.createNode(this, input);
		tools.assign(this, ['config', 'outputs'], input);
		tools.assignNode(RED, this, ['account'], input);
		if(!tools.nodeSetup(this, input, true)) return;

		this.on('input', function (msg) {
			const send = tools.nodeGetSendCb(this, msg);
			const error = tools.nodeGetErrorCb(this);
			if(this.account.state.code !== 'READY') return error('account not initialised');
			this.status({ shape: 'dot', fill: 'grey', text: 'sending' });
			const alexa = this.account.alexa;
			const config = tools.nodeEvaluateProperties(RED, this, msg, this.config);
			if(!tools.matches(config, { option: '', value: undefined })) return error(`invalid input: "${JSON.stringify(config)}"`);
			const {option, value} = config;

			switch(option) {
				case 'get': 
					if(!tools.matches(value, { what: '', device: '' })) return error(`invalid input: "${JSON.stringify(config)}"`);

					switch(value.what) {
						case 'media': return alexa.getMediaPromise(value.device).then(send).catch(error);
						case 'playerInfo': return alexa.getPlayerInfoPromise(value.device).then(o => o.playerInfo).then(send).catch(error);
						//case 'alarmVolume': return alexa.getDeviceNotificationStatePromise(value.device).then(send).catch(error);
					}

					const all = value.device === 'ALEXA_ALL_DSN';
					const device = !all && alexa.find(value.device);
					if(!all && !device) return error(`device not found: "${value.device}"`);

					switch(value.what) {
						case 'device': 
							if(value.cached) {
								if(all)	return send(Array.from(alexa.deviceByIdExt.values()));
								else	return send(device);
							}
							else {
								if(all) return alexa.getDevicesPromise().then(o => o.devices).then(send).catch(error);
								else 	return alexa.getDevicesPromise().then(response => {
									const found = response.devices.find(o => o.serialNumber === device.serialNumber);
									if(!found) throw new Error(`no response for device: "${device.accountName}" (${device.serialNumber})`);
									return found;
								}).then(send).catch(error);
							}

						case 'notifications':
							if(all)	return alexa.getNotificationsPromise().then(o => o.notifications).then(send).catch(error);
							else	return alexa.getNotificationsPromise().then(o => o.notifications).then(list => list.filter(o => o.deviceSerialNumber === device.serialNumber)).then(send).catch(error);
					}

					const find = all ? (list => list) : (list => {
						const found = list.find(o => o.deviceSerialNumber === device.serialNumber);
						if(!found) throw new Error(`no response for device: "${device.accountName}" (${device.serialNumber})`);
						return found;
					});

					switch(value.what) {
						case 'alarmVolume': 	return alexa.getDeviceNotificationStatesExt()	.then(list => find(list)).then(send).catch(error);
						case 'preferences': 	return alexa.getDevicePreferencesPromise()		.then(o => o.devicePreferences).then(list => find(list)).then(send).catch(error);
						case 'doNotDisturb': 	return alexa.getDoNotDisturbPromise()					.then(o => o.doNotDisturbDeviceStatusList).then(list => find(list)).then(send).catch(error);
						case 'wakeWord': 			return alexa.getWakeWordsPromise()						.then(o => o.wakeWords).then(list => find(list)).then(send).catch(error);
						case 'bluetooth': 		return alexa.getBluetoothPromise()						.then(o => o.bluetoothStates).then(list => find(list)).then(send).catch(error);
						default: 				return error(`invalid input: "${JSON.stringify(config)}"`);
					}
				
				case 'command': 
					if(!tools.matches(value, { device: '', what: '', value: undefined })) return error(`invalid input: "${JSON.stringify(config)}"`);
					return alexa.sendCommandPromise(value.device, value.what, value.value).then(send).catch(error);
				
				case 'bluetooth': 
					if(!tools.matches(value, { action: '', device: '', gadget: '' })) return error(`invalid input: "${JSON.stringify(config)}"`);
					switch(value.action) {
						case 'pair': return alexa.pairBluetoothExt(value.device, value.gadget).then(send).catch(error);
						case 'unpair': return alexa.unpairBluetoothExt(value.device, value.gadget).then(send).catch(error);
						case 'disconnect': return alexa.disconnectBluetoothExt(value.device, value.gadget).then(send).catch(error);
						default: return error(`invalid input: "${JSON.stringify(config)}"`);
					}
				
				case 'rename': 
					if(!tools.matches(value, { device: '', name: '' })) return error(`invalid input: "${JSON.stringify(config)}"`);
					return alexa.renameDeviceExt(value.device, value.name).then(send).catch(error);
				
				case 'delete': 
					if(!tools.matches(value, { device: '' })) return error(`invalid input: "${JSON.stringify(config)}"`);
					return alexa.deleteDeviceExt(value.device).then(send).catch(error);
				
				case 'tuneIn': 
					if(!tools.matches(value, { device: '', guideId: '', contentType: '' })) return error(`invalid input: "${JSON.stringify(config)}"`);
					return alexa.setTuneinPromise(value.device, value.guideId, value.contentType).then(send).catch(error);
				
				case 'doNotDisturb': 
					if(!tools.matches(value, { device: '', enabled: false })) return error(`invalid input: "${JSON.stringify(config)}"`);
					return alexa.setDoNotDisturbPromise(value.device, value.enabled).then(send).catch(error);
				
				case 'alarmVolume': 
					if(!tools.matches(value, { device: '', volume: 50 })) return error(`invalid input: "${JSON.stringify(config)}"`);
					return alexa.setAlarmVolumePromise(value.device, value.volume).then(send).catch(error);
			}
		});
	}
	RED.nodes.registerType("alexa-remote-echo", AlexaRemoteEcho);
};