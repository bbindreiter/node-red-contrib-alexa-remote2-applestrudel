const tools = require('../lib/common.js');

module.exports = function (RED) {
	function AlexaRemoteInitNode(input) {
		RED.nodes.createNode(this, input);
		tools.assignNode(RED, this, ['account'], input);
		tools.assign(this, ['option'], input);
		if(!tools.nodeSetup(this, input, true)) return;

		this.on('input', function (msg) {
			const send = tools.nodeGetSendCb(this, msg);
			const error = tools.nodeGetErrorCb(this);

			switch(this.option) {
				case 'initialise': return this.account.initAlexa(msg.payload).then(send).catch(error);
				case 'fresh': return this.account.initAlexa(undefined, true).then(send).catch(error);
				case 'refresh':	return this.account.refreshAlexa().then(send).catch(error);
				case 'update': return this.account.updateAlexa().then(send).catch(error);
				case 'reset': this.account.resetAlexa(); return send();
				case 'debug': return send(tools.stringifyOmitCircular(this.account));
				case 'interval': 
					const start = this.account.refreshTimeoutStartTime;
					const delta = this.account.refreshInterval;
					const end = start + delta;
					const now = Date.now();
					const left = end - now;
					const [d,h,m,s,u] = tools.durationToPieces(left);
					return send({
						message: `next refresh in ${d}d ${h}h ${m}m ${s}s`,
						start: start,
						interval: delta,
						end: end,
					});

				default: return error('what the heck');
			}
		});
	}

	RED.nodes.registerType("alexa-remote-init", AlexaRemoteInitNode);
};

