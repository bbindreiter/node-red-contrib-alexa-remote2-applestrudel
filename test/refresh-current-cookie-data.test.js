const assert = require('assert');
const EventEmitter = require('events');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const alexaRemotePath = path.join(repoRoot, 'lib', 'alexa-remote-ext.js');
const accountNodePath = path.join(repoRoot, 'nodes', 'alexa-remote-account.js');

class FakeAlexaRemote extends EventEmitter {
	constructor() {
		super();
		this.cookieData = undefined;
	}

	setMaxListeners(value) {
		super.setMaxListeners(value);
		return this;
	}

	resetExt() {}
}

function loadAccountNode() {
	delete require.cache[accountNodePath];
	require.cache[alexaRemotePath] = {
		id: alexaRemotePath,
		filename: alexaRemotePath,
		loaded: true,
		exports: FakeAlexaRemote,
	};

	let AccountNode;
	const RED = {
		nodes: {
			createNode(node) {
				const emitter = new EventEmitter();
				node.on = emitter.on.bind(emitter);
				node.emit = emitter.emit.bind(emitter);
				node.status = () => {};
				node.log = () => {};
				node.warn = () => {};
				node.error = () => {};
				node.debug = () => {};
				node.context = () => ({});
				node.credentials = {};
			},
			registerType(name, constructor) {
				if (name === 'alexa-remote-account') AccountNode = constructor;
			},
		},
		auth: {
			needsPermission: () => () => {},
		},
		httpAdmin: {
			get: () => {},
		},
	};

	require(accountNodePath)(RED);
	assert(AccountNode, 'Account node was not registered');
	return AccountNode;
}

function createAccount(input) {
	const AccountNode = loadAccountNode();
	return new AccountNode(Object.assign({
		refreshInterval: '',
		amazonPage: 'amazon.com',
	}, input));
}

async function captureRefreshInitInput(account) {
	let initInput;

	account.state.code = 'READY';
	account.initAlexa = async input => {
		initInput = input;
		return { ok: true };
	};

	await account.refreshAlexa();
	return initInput;
}

function createProxyCookieData() {
	return {
		loginCookie: 'login-cookie',
		localCookie: 'csrf=csrf-token; session=session-token',
		refreshToken: 'refresh-token',
		accessToken: 'access-token',
		macDms: 'mac-dms',
		amazonPage: 'amazon.com',
		dataVersion: 2,
		tokenDate: 1234567890,
	};
}

async function testRefreshUsesCurrentProxyCookieData() {
	const account = createAccount({
		authMethod: 'proxy',
	});
	const currentCookieData = {
		...createProxyCookieData(),
	};

	account.alexa.cookieData = currentCookieData;
	const initInput = await captureRefreshInitInput(account);

	assert.deepStrictEqual(initInput, currentCookieData);
}

async function testRefreshIgnoresCurrentCookieDataWithoutLoginCookie() {
	const account = createAccount({
		authMethod: 'proxy',
	});
	const currentCookieData = createProxyCookieData();
	delete currentCookieData.loginCookie;

	account.alexa.cookieData = currentCookieData;
	const initInput = await captureRefreshInitInput(account);

	assert.strictEqual(initInput, undefined);
}

async function testRefreshKeepsFileBasedProxyInputEmpty() {
	const account = createAccount({
		authMethod: 'proxy',
		cookieFile: '/tmp/alexa-cookie.json',
	});

	account.alexa.cookieData = createProxyCookieData();
	const initInput = await captureRefreshInitInput(account);

	assert.strictEqual(initInput, undefined);
}

async function testRefreshKeepsCookieAuthInputEmpty() {
	const account = createAccount({
		authMethod: 'cookie',
	});

	account.alexa.cookieData = createProxyCookieData();
	const initInput = await captureRefreshInitInput(account);

	assert.strictEqual(initInput, undefined);
}

Promise.resolve()
	.then(testRefreshUsesCurrentProxyCookieData)
	.then(testRefreshIgnoresCurrentCookieDataWithoutLoginCookie)
	.then(testRefreshKeepsFileBasedProxyInputEmpty)
	.then(testRefreshKeepsCookieAuthInputEmpty)
	.then(() => {
		console.log('refresh-current-cookie-data tests passed');
	})
	.catch(error => {
		console.error(error);
		process.exitCode = 1;
	});
