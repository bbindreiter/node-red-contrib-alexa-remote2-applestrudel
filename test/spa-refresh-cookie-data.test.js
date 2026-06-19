const assert = require('assert');
const EventEmitter = require('events');
const Module = require('module');

const originalLoad = Module._load;

class FakeAlexaRemote extends EventEmitter {
	constructor(options = {}) {
		super();
		this._options = options;
		this.cookieData = options.cookie;
	}

	setCookie(cookieData) {
		this.cookieData = cookieData;
		this.cookie = cookieData.localCookie;
		this.csrf = cookieData.csrf;
	}
}

Module._load = function patchedLoad(request, parent, isMain) {
	if (request === 'alexa-remote2') {
		return FakeAlexaRemote;
	}
	if (request === 'tough-cookie') {
		return { CookieJar: class CookieJar {} };
	}
	if (request === './auth/auth-controller') {
		return { AlexaAuthController: class AlexaAuthController {} };
	}
	if (request === './auth/token-store') {
		return { TokenStore: class TokenStore {} };
	}
	if (request === './auth/oauth-device') {
		return { OAuthDevice: class OAuthDevice {} };
	}
	return originalLoad.call(this, request, parent, isMain);
};

async function main() {
	try {
		const AlexaRemoteExt = require('../lib/alexa-remote-ext');
		const existingCookieData = {
			loginCookie: 'login-cookie',
			localCookie: 'csrf=old-csrf; session-id=old-session',
			csrf: 'old-csrf',
			refreshToken: 'refresh-token',
			accessToken: 'access-token',
			macDms: 'mac-dms',
			amazonPage: 'amazon.com',
			dataVersion: 2,
		};
		const options = {
			cookie: existingCookieData,
			amazonPage: 'amazon.com',
			userAgent: 'test-agent',
			acceptLanguage: 'en-US',
			context: {
				global: {
					get: () => null,
					set: () => {},
				},
			},
		};
		const alexa = new AlexaRemoteExt(options);
		alexa.alexaCookie = {
			refreshAlexaCookie: (refreshOptions, callback) => callback(new Error('token refresh failed')),
		};
		alexa.auth = {
			request: async () => ({
				headers: {
					'set-cookie': [
						'csrf=new-csrf; Path=/; Secure',
						'session-id=new-session; Path=/; Secure',
					],
				},
			}),
		};

		await alexa.refreshAlexaCookies();

		assert.strictEqual(alexa.cookie, 'csrf=new-csrf; session-id=new-session');
		assert.strictEqual(alexa.csrf, 'new-csrf');
		assert.strictEqual(alexa.cookieData.loginCookie, existingCookieData.loginCookie);
		assert.strictEqual(alexa.cookieData.refreshToken, existingCookieData.refreshToken);
		assert.strictEqual(alexa.cookieData.accessToken, existingCookieData.accessToken);
		assert.strictEqual(alexa.cookieData.macDms, existingCookieData.macDms);
		assert.strictEqual(alexa.cookieData.amazonPage, existingCookieData.amazonPage);
		assert.strictEqual(alexa.cookieData.dataVersion, existingCookieData.dataVersion);
		assert.strictEqual(alexa.cookieData.localCookie, alexa.cookie);
		assert.strictEqual(alexa.cookieData.csrf, alexa.csrf);
		assert.strictEqual(options.cookie, alexa.cookieData);
		assert.strictEqual(alexa._options.cookie, alexa.cookieData);
	}
	finally {
		Module._load = originalLoad;
	}
}

main().catch(error => {
	console.error(error);
	process.exit(1);
});
