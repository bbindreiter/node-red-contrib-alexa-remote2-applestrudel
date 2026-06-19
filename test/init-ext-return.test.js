const assert = require('assert');
const EventEmitter = require('events');
const Module = require('module');

const expectedCookieData = {
	loginCookie: 'login-cookie',
	localCookie: 'local-cookie',
	csrf: 'csrf-token',
	refreshToken: 'refresh-token',
	dataVersion: 2,
};

class FakeAlexaRemote extends EventEmitter {
	constructor() {
		super();
	}
}

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
	if (request === 'alexa-remote2') {
		return FakeAlexaRemote;
	}
	if (request === 'tough-cookie') {
		return { CookieJar: class CookieJar {} };
	}
	return originalLoad.call(this, request, parent, isMain);
};

async function main() {
	try {
		const AlexaRemoteExt = require('../lib/alexa-remote-ext');

		const createAlexa = () => new AlexaRemoteExt({
			context: {
				global: {
					get: () => null,
					set: () => {},
				},
			},
		});

		const alexa = createAlexa();
		alexa.init = (config, callback) => {
			alexa.cookieData = expectedCookieData;
			callback(null);
		};
		alexa.checkAuthenticationExt = async () => true;
		alexa.updateExt = async () => {};

		const result = await alexa.initExt({});

		assert.strictEqual(result, expectedCookieData);

		const alexaWithoutCookieData = createAlexa();
		alexaWithoutCookieData.init = (config, callback) => callback(null);
		alexaWithoutCookieData.checkAuthenticationExt = async () => true;
		alexaWithoutCookieData.updateExt = async () => {};

		const resultWithoutCookieData = await alexaWithoutCookieData.initExt({});

		assert.strictEqual(resultWithoutCookieData, null);
	}
	finally {
		Module._load = originalLoad;
	}
}

main().catch(error => {
	console.error(error);
	process.exit(1);
});
