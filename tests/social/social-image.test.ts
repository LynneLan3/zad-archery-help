import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveSocialImage, toAbsoluteUrl } from '../../src/lib/social';

const defaultImage = { asset: 'social/default-og.svg', alt: 'Default social image' };
const pageImage = { asset: 'social/guide-og.svg', alt: 'Guide social image' };

test('page socialImage wins over site default', () => {
	const resolved = resolveSocialImage({
		pathname: '/mortal-shell-ii/beta-progress-carry-over/',
		pages: [{ slug: 'mortal-shell-ii/beta-progress-carry-over', socialImage: pageImage }],
		defaultImage,
	});
	assert.deepEqual(resolved, pageImage);
});

test('guide without page image uses site default', () => {
	const resolved = resolveSocialImage({
		pathname: '/fixture-game/beginner-guide/',
		pages: [{ slug: 'fixture-game/beginner-guide' }],
		defaultImage,
	});
	assert.deepEqual(resolved, defaultImage);
});

test('hub category and trust inherit default image', () => {
	assert.deepEqual(
		resolveSocialImage({ pathname: '/fixture-game/', pages: [], defaultImage }),
		defaultImage,
	);
	assert.deepEqual(
		resolveSocialImage({ pathname: '/fixture-game/gameplay/', pages: [], defaultImage }),
		defaultImage,
	);
	assert.deepEqual(
		resolveSocialImage({ pathname: '/fixture-game/about/', pages: [], defaultImage }),
		defaultImage,
	);
});

test('root hubPath guide matching works', () => {
	assert.deepEqual(
		resolveSocialImage({
			pathname: '/beta-progress-carry-over/',
			pages: [{ slug: 'beta-progress-carry-over', socialImage: pageImage }],
			defaultImage,
		}),
		pageImage,
	);
	assert.deepEqual(resolveSocialImage({ pathname: '/', defaultImage }), defaultImage);
});

test('no configured image yields undefined', () => {
	assert.equal(resolveSocialImage({ pathname: '/fixture-game/beginner-guide/', pages: [] }), undefined);
});

test('toAbsoluteUrl prefixes site origin', () => {
	assert.equal(
		toAbsoluteUrl('/_astro/default-og.hash.svg', 'https://fixture-wiki.example'),
		'https://fixture-wiki.example/_astro/default-og.hash.svg',
	);
	assert.equal(
		toAbsoluteUrl('https://cdn.example/og.webp', 'https://fixture-wiki.example'),
		'https://cdn.example/og.webp',
	);
});
