import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizePageSlug, pageHref } from '../../src/lib/paths';

test('page slug contract accepts single and nested kebab-case paths', () => {
	assert.equal(normalizePageSlug('system-requirements'), 'system-requirements');
	assert.equal(normalizePageSlug('legacy-game/classes'), 'legacy-game/classes');
	assert.equal(pageHref('/', 'legacy-game/classes'), '/legacy-game/classes/');
});

test('page slug contract rejects unsafe or URL-shaped paths', () => {
	for (const slug of [
		'/legacy-game/classes',
		'legacy-game/classes/',
		'legacy-game//classes',
		'legacy-game/./classes',
		'legacy-game/../classes',
		'legacy-game/classes?tab=answers',
		'legacy-game/classes#answers',
		'https://example.com/classes',
		'',
	]) {
		assert.throws(() => normalizePageSlug(slug), new RegExp('page slug'));
	}
});
