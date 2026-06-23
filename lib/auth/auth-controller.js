'use strict';

const http = require('http');
const https = require('https');

function mergeCookieHeader(existingHeader, setCookieHeaders) {
	const cookieMap = new Map();
	const addCookie = cookie => {
		const separator = cookie.indexOf('=');
		if (separator <= 0) return;
		cookieMap.set(cookie.slice(0, separator).trim(), cookie.trim());
	};

	String(existingHeader || '').split(';').map(cookie => cookie.trim()).filter(Boolean).forEach(addCookie);
	[]
		.concat(setCookieHeaders || [])
		.map(cookie => String(cookie || '').split(';')[0].trim())
		.filter(Boolean)
		.forEach(addCookie);
	return Array.from(cookieMap.values()).join('; ');
}

function getHeader(headers, name) {
	const key = Object.keys(headers || {}).find(header => header.toLowerCase() === name.toLowerCase());
	return key ? headers[key] : undefined;
}

function deleteHeader(headers, name) {
	Object.keys(headers || {})
		.filter(header => header.toLowerCase() === name.toLowerCase())
		.forEach(header => delete headers[header]);
}

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
				'set-cookie': response.setCookie || [],
			},
		};
	}

	requestWithNodeHttp(url, options, collectedSetCookie = []) {
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
					const responseSetCookie = []
						.concat(res.headers['set-cookie'] || [])
						.filter(Boolean);
					const nextSetCookie = collectedSetCookie.concat(responseSetCookie);

					if (options.followRedirect
							&& options.maxRedirects > 0
							&& res.statusCode >= 300
							&& res.statusCode < 400
							&& res.headers.location) {
						const redirectUrl = new URL(res.headers.location, requestUrl).toString();
						const redirectHeaders = Object.assign({}, options.headers);
						const cookieHeader = mergeCookieHeader(getHeader(redirectHeaders, 'Cookie'), nextSetCookie);
						deleteHeader(redirectHeaders, 'Cookie');
						if (cookieHeader) redirectHeaders.Cookie = cookieHeader;
						this.requestWithNodeHttp(redirectUrl, Object.assign({}, options, {
							headers: redirectHeaders,
							maxRedirects: options.maxRedirects - 1,
						}), nextSetCookie).then(resolve, reject);
						return;
					}

					resolve({
						statusCode: res.statusCode,
						headers: res.headers,
						setCookie: nextSetCookie,
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
