'use strict';

class TokenStore {
	constructor(globalContext) {
		this.globalContext = globalContext;
		this.key = 'alexaRemoteOAuth2';
	}

	get() {
		if (!this.globalContext || typeof this.globalContext.get !== 'function') {
			return null;
		}
		return this.globalContext.get(this.key) || null;
	}

	set(tokens) {
		if (!this.globalContext || typeof this.globalContext.set !== 'function') {
			return;
		}
		this.globalContext.set(this.key, tokens);
	}
}

module.exports = { TokenStore };
