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
			localCookie: 'csrf=old-csrf; session-id=old-session; ubid-main=old-ubid',
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
		const cookieEvents = [];
		alexa.on('cookie', (cookie, csrf, macDms) => {
			cookieEvents.push({ cookie, csrf, macDms });
		});
		alexa.alexaCookie = {
			refreshAlexaCookie: (refreshOptions, callback) => callback(new Error('token refresh failed')),
		};
		alexa.auth = {
			request: async requestOptions => {
				assert.strictEqual(requestOptions.headers.Cookie, 'csrf=old-csrf; session-id=old-session; ubid-main=old-ubid');
				return {
					headers: {
						'set-cookie': [
							'csrf=new-csrf; Path=/; Secure',
							'session-id=new-session; Path=/; Secure',
							'new-cookie=new-value; Path=/; Secure',
						],
					},
				};
			},
		};

		await alexa.refreshAlexaCookies();

		assert.strictEqual(alexa.cookie, 'csrf=new-csrf; session-id=new-session; ubid-main=old-ubid; new-cookie=new-value');
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
		assert.strictEqual(alexa._options.formerRegistrationData, alexa.cookieData);
		assert.deepStrictEqual(cookieEvents, [{
			cookie: 'csrf=new-csrf; session-id=new-session; ubid-main=old-ubid; new-cookie=new-value',
			csrf: 'new-csrf',
			macDms: 'mac-dms',
		}]);

		const runtimeCookieData = {
			loginCookie: 'login-cookie',
			localCookie: 'csrf=old-csrf; session-id=old-session',
			csrf: 'old-csrf',
			refreshToken: 'refresh-token',
			macDms: 'runtime-mac-dms',
		};
		const runtimeOptions = {
			cookie: runtimeCookieData.localCookie,
			amazonPage: 'amazon.com',
			context: {
				global: {
					get: () => null,
					set: () => {},
				},
			},
		};
		const runtimeAlexa = new AlexaRemoteExt(runtimeOptions);
		runtimeAlexa.cookieData = runtimeCookieData;
		const runtimeEvents = [];
		runtimeAlexa.on('cookie', (cookie, csrf, macDms) => {
			runtimeEvents.push({ cookie, csrf, macDms });
		});
		runtimeAlexa.auth = {
			request: async requestOptions => {
				assert.strictEqual(requestOptions.headers.Cookie, runtimeCookieData.localCookie);
				return {
					headers: {
						'set-cookie': [
							'csrf=runtime-csrf; Path=/; Secure',
							'session-id=runtime-session; Path=/; Secure',
						],
					},
				};
			},
		};

		await runtimeAlexa.refreshAlexaCookies();

		assert.deepStrictEqual(runtimeEvents, [{
			cookie: 'csrf=runtime-csrf; session-id=runtime-session',
			csrf: 'runtime-csrf',
			macDms: 'runtime-mac-dms',
		}]);
		assert.strictEqual(runtimeAlexa.cookieData.loginCookie, runtimeCookieData.loginCookie);
		assert.strictEqual(runtimeAlexa.cookieData.refreshToken, runtimeCookieData.refreshToken);
		assert.strictEqual(runtimeAlexa.cookieData.localCookie, 'csrf=runtime-csrf; session-id=runtime-session');
		assert.strictEqual(runtimeAlexa.cookieData.csrf, 'runtime-csrf');
		assert.strictEqual(runtimeAlexa._options.cookie, runtimeAlexa.cookieData);
		assert.strictEqual(runtimeAlexa._options.formerRegistrationData, runtimeAlexa.cookieData);

		const noCsrfCookieData = {
			loginCookie: 'login-cookie',
			localCookie: 'csrf=old-csrf; session-id=old-session',
			csrf: 'old-csrf',
			refreshToken: 'refresh-token',
			macDms: 'mac-dms',
		};
		const noCsrfOptions = {
			cookie: noCsrfCookieData,
			amazonPage: 'amazon.com',
			headers: {
				Cookie: noCsrfCookieData.localCookie,
				csrf: noCsrfCookieData.csrf,
			},
			context: {
				global: {
					get: () => null,
					set: () => {},
				},
			},
		};
		const noCsrfAlexa = new AlexaRemoteExt(noCsrfOptions);
		noCsrfAlexa.cookie = noCsrfCookieData.localCookie;
		noCsrfAlexa.csrf = noCsrfCookieData.csrf;
		const noCsrfEvents = [];
		noCsrfAlexa.on('cookie', (cookie, csrf, macDms) => {
			noCsrfEvents.push({ cookie, csrf, macDms });
		});
		noCsrfAlexa.alexaCookie = {
			refreshAlexaCookie: (refreshOptions, callback) => callback(new Error('token refresh failed')),
		};
		noCsrfAlexa.auth = {
			request: async requestOptions => {
				assert.strictEqual(requestOptions.headers.Cookie, noCsrfCookieData.localCookie);
				return {
					headers: {
						'set-cookie': [
							'session-id=new-session; Path=/; Secure',
						],
					},
				};
			},
		};

		await assert.rejects(
			() => noCsrfAlexa.refreshAlexaCookies(),
			/Alexa SPA cookies did not include csrf/
		);

		assert.deepStrictEqual(noCsrfEvents, []);
		assert.strictEqual(noCsrfAlexa.cookie, noCsrfCookieData.localCookie);
		assert.strictEqual(noCsrfAlexa.csrf, noCsrfCookieData.csrf);
		assert.strictEqual(noCsrfAlexa.cookieData, noCsrfCookieData);
		assert.strictEqual(noCsrfAlexa._options.cookie, noCsrfCookieData);
		assert.strictEqual(noCsrfAlexa._options.headers.Cookie, noCsrfCookieData.localCookie);
		assert.strictEqual(noCsrfAlexa._options.headers.csrf, noCsrfCookieData.csrf);
	}
	finally {
		Module._load = originalLoad;
	}
}

main().catch(error => {
	console.error(error);
	process.exit(1);
});
