const assert = require('assert');
const http = require('http');

const { AlexaAuthController } = require('../lib/auth/auth-controller');

async function withServer(handler, test) {
	const server = http.createServer(handler);
	await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
	try {
		const { port } = server.address();
		await test(`http://127.0.0.1:${port}`);
	}
	finally {
		await new Promise(resolve => server.close(resolve));
	}
}

async function testRequestWorksWithoutGlobalFetch() {
	const previousFetch = global.fetch;
	global.fetch = undefined;

	try {
		await withServer((req, res) => {
			assert.strictEqual(req.method, 'GET');
			assert.strictEqual(req.headers['user-agent'], 'test-agent');
			res.setHeader('Set-Cookie', [
				'csrf=test-csrf; Path=/; Secure',
				'session-id=test-session; Path=/; Secure',
			]);
			res.end('ok');
		}, async baseUrl => {
			const controller = new AlexaAuthController({}, {});
			const response = await controller.request({
				method: 'GET',
				url: `${baseUrl}/spa/index.html`,
				headers: {
					'User-Agent': 'test-agent',
				},
			});

			assert.strictEqual(response.statusCode, 200);
			assert.deepStrictEqual(response.headers['set-cookie'], [
				'csrf=test-csrf; Path=/; Secure',
				'session-id=test-session; Path=/; Secure',
			]);
		});
	}
	finally {
		global.fetch = previousFetch;
	}
}

async function testRequestKeepsCookiesAcrossRedirects() {
	const seenCookieHeaders = [];

	await withServer((req, res) => {
		if (req.url === '/redirect') {
			res.statusCode = 302;
			res.setHeader('Location', '/final');
			res.setHeader('Set-Cookie', 'csrf=redirect-csrf; Path=/; Secure');
			res.end();
			return;
		}

		assert.strictEqual(req.url, '/final');
		seenCookieHeaders.push(req.headers.cookie || '');
		res.setHeader('Set-Cookie', 'session-id=final-session; Path=/; Secure');
		res.end('ok');
	}, async baseUrl => {
		const controller = new AlexaAuthController({}, {});
		const response = await controller.request({
			method: 'GET',
			url: `${baseUrl}/redirect`,
			headers: {
				'User-Agent': 'test-agent',
				Cookie: 'csrf=old-csrf; ubid-main=old-ubid',
			},
			followRedirect: true,
		});

		assert.strictEqual(response.statusCode, 200);
		assert.deepStrictEqual(response.headers['set-cookie'], [
			'csrf=redirect-csrf; Path=/; Secure',
			'session-id=final-session; Path=/; Secure',
		]);
		assert.strictEqual(seenCookieHeaders[0], 'csrf=redirect-csrf; ubid-main=old-ubid');
	});
}

Promise.resolve()
	.then(testRequestWorksWithoutGlobalFetch)
	.then(testRequestKeepsCookiesAcrossRedirects)
	.then(() => console.log('auth-controller-request tests passed'))
	.catch(error => {
		console.error(error);
		process.exitCode = 1;
	});
