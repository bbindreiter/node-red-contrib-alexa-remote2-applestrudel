const tools = require('../lib/common.js');

module.exports = function (RED) {

	function AlexaRemoteList(input) {
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
				case 'getLists': 
				return alexa.getListsV2Promise().then(send).catch(error);
				
        case 'getList':
					if(!tools.matches(value, { list: '' })) return error(`expected a string 'list'`);
          return alexa.getListPromise(value.list).then(send).catch(error);
					
					case 'getListItems':
						if(!tools.matches(value, { list: '' })) return error(`expected a string 'list'`);
						return alexa.getListItemsPromise(value.list).then(send).catch(error);
						
						case 'addItem': 
						if(!tools.matches(value, { list: '', text: '' })) return error(`expected a string 'list' and 'text'`);
						return alexa.addListItemPromise(value.list, value.text).then(send).catch(error);
						
				case 'editItem':
					if(!tools.matches(value, { list: '', item: '', text: '', completed: undefined, version: 0 })) return error(`expected a string 'list', 'item', 'text' and number 'version'`);
					let options = { value: value.text, version: value.version };
					if(typeof value.completed === 'boolean') options.completed = value.completed;
					return alexa.updateListItemPromise(value.list, value.item, options).then(send).catch(error);

				case 'removeItem':
					if(!tools.matches(value, { list: '', item: '', version: 0 })) return error(`expected a string 'list', 'item' and number 'version'`);
					return alexa.deleteListItemPromise(value.list, value.item, { version: value.version }).then(send).catch(error);

				default:
					return error('invalid option');
			}
		});
	}
	RED.nodes.registerType("alexa-remote-list", AlexaRemoteList);
};