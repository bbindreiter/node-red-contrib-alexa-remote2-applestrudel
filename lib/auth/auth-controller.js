'use strict';

class AlexaAuthController {
	constructor(tokenStore, oauthDevice) {
		this.tokenStore = tokenStore;
		this.oauthDevice = oauthDevice;
	}

	async ensureAuth() {
		// OAuth2 bootstrap is handled by alexa-remote2 init flow.
		// We only need to ensure this class is available for runtime wiring.
		return true;
	}

	async request(options = {}) {
		const method = options.method || 'GET';
		const headers = options.headers || {};

		const response = await fetch(options.url, {
			method: method,
			headers: headers,
			redirect: options.followRedirect ? 'follow' : 'manual',
		});

		const setCookie = typeof response.headers.getSetCookie === 'function'
			? response.headers.getSetCookie()
			: [];

		return {
			statusCode: response.status,
			headers: {
				'set-cookie': setCookie,
			},
		};
	}
}

module.exports = { AlexaAuthController };
