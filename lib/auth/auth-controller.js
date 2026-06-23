'use strict';

const http = require('http');
const https = require('https');

class AlexaAuthController {
	constructor(tokenStore, oauthDevice) {
		this.tokenStore = tokenStore;
		this.oauthDevice = oauthDevice;
	}

	async ensureAuth() {
		// OAuth2 setup is handled by alexa-remote2 init flow.
		// We only need to ensure this class is available for runtime wiring.
		return true;
	}

	async request(options = {}) {
		const method = options.method || 'GET';
		const headers = options.headers || {};
		const maxRedirects = options.maxRedirects === undefined ? 5 : options.maxRedirects;

		const response = await this.requestWithNodeHttp(options.url, {
			method,
			headers,
			followRedirect: !!options.followRedirect,
			maxRedirects,
		});

		return {
			statusCode: response.statusCode,
			headers: {
				'set-cookie': response.headers['set-cookie'] || [],
			},
		};
	}

	requestWithNodeHttp(url, options) {
		return new Promise((resolve, reject) => {
			const requestUrl = new URL(url);
			const client = requestUrl.protocol === 'https:' ? https : http;
			const req = client.request(requestUrl, {
				method: options.method,
				headers: options.headers,
			}, res => {
				const chunks = [];
				res.on('data', chunk => chunks.push(chunk));
				res.on('end', () => {
					if (options.followRedirect
							&& options.maxRedirects > 0
							&& res.statusCode >= 300
							&& res.statusCode < 400
							&& res.headers.location) {
						const redirectUrl = new URL(res.headers.location, requestUrl).toString();
						this.requestWithNodeHttp(redirectUrl, Object.assign({}, options, {
							maxRedirects: options.maxRedirects - 1,
						})).then(resolve, reject);
						return;
					}

					resolve({
						statusCode: res.statusCode,
						headers: res.headers,
						body: Buffer.concat(chunks).toString('utf8'),
					});
				});
			});

			req.on('error', reject);
			req.end();
		});
	}
}

module.exports = { AlexaAuthController };
