const assert = require('assert');
const EventEmitter = require('events');
const Module = require('module');

class FakeAlexaRemote extends EventEmitter {
	constructor() {
		super();
		this.cookie = null;
		this.csrf = null;
		this.cookieData = null;
		this._options = {};
	}

	setCookie(cookie) {
		if (cookie && cookie.localCookie) {
			this.cookie = cookie.localCookie;
			this.cookieData = cookie;
			this._options.formerRegistrationData = cookie;
		} else {
			this.cookie = cookie;
		}

		const match = this.cookie && this.cookie.match(/csrf=([^;]+)/);
		if (match) this.csrf = match[1];
		this._options.cookie = this.cookie;
		this._options.csrf = this.csrf;
	}
}

const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
	if (request === 'alexa-remote2') return FakeAlexaRemote;
	if (request === 'tough-cookie') return { CookieJar: class CookieJar {} };
	return originalLoad.call(this, request, parent, isMain);
};

const AlexaRemoteExt = require('../lib/alexa-remote-ext.js');
Module._load = originalLoad;

function createCookieData(overrides) {
	return Object.assign({
		loginCookie: 'login-cookie',
		localCookie: 'csrf=old-csrf; session=old-session',
		refreshToken: 'refresh-token',
		accessToken: 'old-access-token',
		macDms: 'mac-dms',
		deviceSerial: 'device-serial',
		deviceAppName: 'device-app-name',
		amazonPage: 'amazon.com',
		dataVersion: 2,
		tokenDate: Date.now() - 48 * 60 * 60 * 1000,
	}, overrides);
}

async function testUsesFormerRegistrationDataWhenCookieOptionIsString() {
	const alexa = new AlexaRemoteExt({ context: { global: {} } });
	const formerRegistrationData = createCookieData();
	const refreshedCookieData = createCookieData({
		loginCookie: 'new-login-cookie',
		localCookie: 'csrf=new-csrf; session=new-session',
		accessToken: 'new-access-token',
		tokenDate: Date.now(),
	});
	let refreshOptions;
	let refreshFormerRegistrationData;

	alexa.options = {};
	alexa._options = {
		cookie: formerRegistrationData.localCookie,
		formerRegistrationData,
		headers: {},
		amazonPage: 'amazon.com',
	};
	alexa.cookieData = formerRegistrationData;
	alexa.alexaCookie = {
		refreshAlexaCookie: (options, callback) => {
			refreshOptions = options;
			refreshFormerRegistrationData = options.formerRegistrationData;
			callback(null, refreshedCookieData);
		},
	};
	alexa.auth = {
		request: () => {
			throw new Error('SPA fallback should not be used');
		},
	};

	await alexa.refreshAlexaCookies();

	assert.strictEqual(refreshFormerRegistrationData, formerRegistrationData);
	assert.strictEqual(refreshOptions.formerRegistrationData, refreshedCookieData);
	assert.strictEqual(alexa.cookieData, refreshedCookieData);
	assert.strictEqual(alexa.cookie, refreshedCookieData.localCookie);
	assert.strictEqual(alexa.csrf, 'new-csrf');
	assert.strictEqual(alexa._options.formerRegistrationData, refreshedCookieData);
	assert.strictEqual(alexa.options.cookie, refreshedCookieData);
	assert.strictEqual(alexa._options.cookie, refreshedCookieData.localCookie);
	assert.strictEqual(alexa.options.headers.Cookie, refreshedCookieData.localCookie);
	assert.strictEqual(alexa._options.headers.Cookie, refreshedCookieData.localCookie);
}

testUsesFormerRegistrationDataWhenCookieOptionIsString()
	.then(() => {
		console.log('token-refresh-registration-data tests passed');
	})
	.catch(error => {
		console.error(error);
		process.exitCode = 1;
	});
