const tools = require('../lib/common.js');

module.exports = function (RED) {

	function AlexaRemoteOther(input) {
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
			if(!tools.matches(config, { option: '' })) return error(`invalid input: "${JSON.stringify(config)}"`);
			const {option, value} = config;

			switch(option) {
				case 'get': {
					if(!tools.matches(value, { what: '' })) return error(`invalid input: "${JSON.stringify(config)}"`);

					switch(value.what) {
						case 'accounts': 						return alexa.getAccountPromise						().then(send).catch(error);
						case 'contacts': 						return alexa.getContactsPromise						().then(send).catch(error);
						case 'conversations': 			return alexa.getConversationsPromise			().then(o => o.conversations).then(send).catch(error);
						case 'automationRoutines': 	return alexa.getAutomationRoutinesPromise	().then(send).catch(error);
						case 'musicProviders': 			return alexa.getMusicProvidersPromise			().then(send).catch(error);
						case 'homeGroup':						return alexa.getHomeGroupPromise					().then(send).catch(error);
						case 'notifications':				return alexa.getNotificationsPromise			().then(o => o.notifications).then(send).catch(error);
						case 'skills':							return alexa.getSkillsExt									().then(send).catch(error);

						case 'list':
							if(!tools.matches(value, { list: '' })) return error(`invalid input: "${JSON.stringify(config)}"`);
							return alexa.getListExt(value.list).then(o => o.values).then(send).catch(error);

						case 'activities': 			
							if(!tools.matches(value, { count: 10, offset: 1 })) return error(`invalid input: "${JSON.stringify(config)}"`);
							return alexa.getCustomerHistoryRecordsPromise({ size: value.count, offset: value.offset }).then(send).catch(error);

						case 'cards':				
							if(!tools.matches(value, { count: 10 })) return error(`invalid input: "${JSON.stringify(config)}"`);
							return alexa.getCardsPromise(value.count, '%t').then(o => o.cards).then(send).catch(error);

						default: 					
							return error(`invalid input: "${JSON.stringify(config)}"`);
					}
				}
				case 'addListItem': 
					if(!tools.matches(value, { list: '', text: '' })) return error(`invalid input: "${JSON.stringify(config)}"`);
					return alexa.addListItemExt(value.list, value.text).then(send).catch(error);

				case 'addNotification':
					if(!tools.matches(value, {  type: '', label: '', time: undefined, device: '', status: '', sound: undefined })) return error(`invalid input: "${JSON.stringify(config)}"`);
					return alexa.createNotificationExt(value.device, value.type, value.label, value.time, value.status.toUpperCase(), value.sound).then(send).catch(error);

				case 'changeNotification': 
					if(!tools.matches(value, { notification: undefined, label: '', time: undefined, status: '', sound: undefined })) return error(`invalid input: "${JSON.stringify(config)}"`);
					return alexa.changeNotificationExt(value.notification, value.label, value.time, value.status.toUpperCase(), value.sound).then(send).catch(error);

				case 'removeNotification': 
					if(!tools.matches(value, { notification: undefined })) return error(`invalid input: "${JSON.stringify(config)}"`);
					return alexa.deleteNotificationExt(value.notification).then(send).catch(error);

				case 'sendTextMessage': 
					if(!tools.matches(value, { conversation: '', text: '' })) return error(`invalid input: "${JSON.stringify(config)}"`);
					return alexa.sendTextMessagePromise(value.conversation, value.text).then(send).catch(error);

				case 'deleteConversation':
					if(!tools.matches(value, { conversation: '' })) return error(`invalid input: "${JSON.stringify(config)}"`);
					return alexa.deleteConversationPromise(value.conversation).then(send).catch(error);

				case 'checkAuthentication':
					return alexa.checkAuthenticationExt().then(send).catch(error);
				
				default: 
					return error(`invalid input: "${JSON.stringify(config)}"`);
			}
		});
	}
	RED.nodes.registerType("alexa-remote-other", AlexaRemoteOther);
};