import assert from 'node:assert/strict';
import test from 'node:test';
import {
	validateUrls,
	deduplicateUrls,
	buildPayload,
	submitToIndexNow,
	type IndexNowPayload,
} from '../../src/lib/indexnow';

// ── URL validation ─────────────────────────────────────────────────────

test('valid absolute HTTPS URL passes', () => {
	const errors = validateUrls(['https://example.com/page/'], 'example.com');
	assert.equal(errors.length, 0);
});

test('valid absolute HTTP URL passes', () => {
	const errors = validateUrls(['http://example.com/page/'], 'example.com');
	assert.equal(errors.length, 0);
});

test('malformed URL fails', () => {
	const errors = validateUrls(['not-a-url'], 'example.com');
	assert.equal(errors.length, 1);
	assert.match(errors[0].reason, /Malformed URL/);
});

test('cross-host URL fails', () => {
	const errors = validateUrls(['https://other.com/page/'], 'example.com');
	assert.equal(errors.length, 1);
	assert.match(errors[0].reason, /Cross-host/);
	assert.match(errors[0].reason, /other\.com/);
});

test('localhost URL fails', () => {
	const errors = validateUrls(['https://localhost/page/'], 'localhost');
	assert.equal(errors.length, 1);
	assert.match(errors[0].reason, /Localhost/);
});

test('127.0.0.1 URL fails', () => {
	const errors = validateUrls(['http://127.0.0.1/page/'], 'example.com');
	assert.equal(errors.length, 1);
	assert.match(errors[0].reason, /Localhost/);
});

test('ftp protocol fails', () => {
	const errors = validateUrls(['ftp://example.com/page/'], 'example.com');
	assert.equal(errors.length, 1);
	assert.match(errors[0].reason, /Unsupported protocol/);
});

test('multiple URLs with mixed validity', () => {
	const errors = validateUrls(
		['https://example.com/a/', 'https://other.com/b/', 'bad-url'],
		'example.com',
	);
	assert.equal(errors.length, 2);
});

// ── Dedup ──────────────────────────────────────────────────────────────

test('dedup removes duplicate URLs', () => {
	const result = deduplicateUrls([
		'https://example.com/page/',
		'https://example.com/page/',
		'https://example.com/other/',
	]);
	assert.equal(result.length, 2);
});

test('dedup normalises trailing slash', () => {
	const result = deduplicateUrls([
		'https://example.com/page/',
		'https://example.com/page',
	]);
	assert.equal(result.length, 1);
});

test('dedup preserves order', () => {
	const result = deduplicateUrls([
		'https://example.com/a/',
		'https://example.com/b/',
		'https://example.com/a/',
	]);
	assert.deepEqual(result, ['https://example.com/a/', 'https://example.com/b/']);
});

// ── Payload ────────────────────────────────────────────────────────────

test('buildPayload constructs correct structure', () => {
	const payload = buildPayload('example.com', 'test-key-123', [
		'https://example.com/page/',
	]);
	assert.deepEqual(payload, {
		host: 'example.com',
		key: 'test-key-123',
		keyLocation: 'https://example.com/test-key-123.txt',
		urlList: ['https://example.com/page/'],
	});
});

// ── Submit (mocked) ────────────────────────────────────────────────────

function mockFetch(status: number, body?: string) {
	return async (_url: string | URL | Request, _init?: RequestInit): Promise<Response> => {
		return new Response(body ?? null, { status });
	};
}

test('dry-run does not call fetch', () => {
	let called = false;
	const fakeFetch = async () => {
		called = true;
		return new Response(null, { status: 200 });
	};

	submitToIndexNow({
		canonicalHost: 'example.com',
		key: 'test-key',
		urls: ['https://example.com/page/'],
		dryRun: true,
		fetchImpl: fakeFetch as typeof fetch,
	});

	assert.equal(called, false, 'fetch should not be called in dry-run');
});

test('200 → accepted', async () => {
	const result = await submitToIndexNow({
		canonicalHost: 'example.com',
		key: 'test-key',
		urls: ['https://example.com/page/'],
		fetchImpl: mockFetch(200) as typeof fetch,
	});
	assert.equal(result.ok, true);
	assert.equal(result.status, 200);
	assert.match(result.message, /received/);
	assert.doesNotMatch(result.message, /[Ii]ndexed/);
});

test('202 → received', async () => {
	const result = await submitToIndexNow({
		canonicalHost: 'example.com',
		key: 'test-key',
		urls: ['https://example.com/page/'],
		fetchImpl: mockFetch(202) as typeof fetch,
	});
	assert.equal(result.ok, true);
	assert.equal(result.status, 202);
	assert.match(result.message, /received/);
	assert.doesNotMatch(result.message, /[Ii]ndexed/);
});

test('400 → error message', async () => {
	const result = await submitToIndexNow({
		canonicalHost: 'example.com',
		key: 'test-key',
		urls: ['https://example.com/page/'],
		fetchImpl: mockFetch(400) as typeof fetch,
	});
	assert.equal(result.ok, false);
	assert.equal(result.status, 400);
	assert.match(result.message, /bad request/);
});

test('403 → error message', async () => {
	const result = await submitToIndexNow({
		canonicalHost: 'example.com',
		key: 'test-key',
		urls: ['https://example.com/page/'],
		fetchImpl: mockFetch(403) as typeof fetch,
	});
	assert.equal(result.ok, false);
	assert.match(result.message, /forbidden/);
});

test('422 → error message', async () => {
	const result = await submitToIndexNow({
		canonicalHost: 'example.com',
		key: 'test-key',
		urls: ['https://example.com/page/'],
		fetchImpl: mockFetch(422) as typeof fetch,
	});
	assert.equal(result.ok, false);
	assert.match(result.message, /unprocessable/);
});

test('429 → error message', async () => {
	const result = await submitToIndexNow({
		canonicalHost: 'example.com',
		key: 'test-key',
		urls: ['https://example.com/page/'],
		fetchImpl: mockFetch(429) as typeof fetch,
	});
	assert.equal(result.ok, false);
	assert.match(result.message, /rate limited/);
});

test('500 → generic error', async () => {
	const result = await submitToIndexNow({
		canonicalHost: 'example.com',
		key: 'test-key',
		urls: ['https://example.com/page/'],
		fetchImpl: mockFetch(500) as typeof fetch,
	});
	assert.equal(result.ok, false);
	assert.match(result.message, /HTTP 500/);
});

test('network failure → error message', async () => {
	const failFetch = async () => {
		throw new Error('fetch failed');
	};
	const result = await submitToIndexNow({
		canonicalHost: 'example.com',
		key: 'test-key',
		urls: ['https://example.com/page/'],
		fetchImpl: failFetch as typeof fetch,
	});
	assert.equal(result.ok, false);
	assert.match(result.message, /Network error/);
});

// ── No-URL CLI guard ───────────────────────────────────────────────────

test('validateUrls with empty array returns no errors', () => {
	const errors = validateUrls([], 'example.com');
	assert.equal(errors.length, 0);
});
