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
		this.errorMessagesExt = {};
	}

	setMaxListeners(value) {
		super.setMaxListeners(value);
		return this;
	}

	resetExt() {}

	async initExt(config) {
		this.cookieData = config.cookie || null;
		return this.cookieData;
	}
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
			createNode(node, input = {}) {
				const emitter = new EventEmitter();
				node.on = emitter.on.bind(emitter);
				node.emit = emitter.emit.bind(emitter);
				node.status = () => {};
				node.log = () => {};
				node.warn = () => {};
				node.error = () => {};
				node.debug = value => {
					if (input.__debugLog) input.__debugLog.push(String(value));
				};
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
		authMethod: 'proxy',
		refreshInterval: '',
		amazonPage: 'amazon.com',
	}, input));
}

async function testInitAlexaDoesNotDebugRawCookieData() {
	const debugLog = [];
	const account = createAccount({ __debugLog: debugLog });
	const cookieData = {
		loginCookie: 'login-cookie-secret',
		localCookie: 'csrf=secret-csrf; session-id=secret-session',
		refreshToken: 'secret-refresh',
		accessToken: 'secret-access',
		amazonPage: 'amazon.com',
		dataVersion: 2,
	};

	account.buildUiJson = async () => {};
	account.renewTimeout = () => {};

	await account.initAlexa(cookieData);

	const joined = debugLog.join('\n');
	assert(!joined.includes('login-cookie-secret'), 'loginCookie leaked through Node-RED debug output');
	assert(!joined.includes('secret-csrf'), 'csrf leaked through Node-RED debug output');
	assert(!joined.includes('secret-session'), 'session leaked through Node-RED debug output');
	assert(!joined.includes('secret-refresh'), 'refresh token leaked through Node-RED debug output');
	assert(!joined.includes('secret-access'), 'access token leaked through Node-RED debug output');
}

testInitAlexaDoesNotDebugRawCookieData()
	.then(() => console.log('account-debug-cookie-redaction tests passed'))
	.catch(error => {
		console.error(error);
		process.exitCode = 1;
	});
