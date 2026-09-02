import assert from 'node:assert/strict';
import test from 'node:test';
import { findOrphanPages } from '../../scripts/lib/link-graph';
import type { SiteSpec } from '../../scripts/lib/site-spec';
import { mergeRelatedSlugs, nextStepSlug, nextStepSlugs } from '../../src/lib/page-relations';

test('mergeRelatedSlugs dedupes legacy related and relations type=related', () => {
	const merged = mergeRelatedSlugs(
		['fixture-game/a', 'fixture-game/b'],
		[
			{ slug: 'fixture-game/a', type: 'related' },
			{ slug: 'fixture-game/c', type: 'related' },
			{ slug: 'fixture-game/d', type: 'next-step' },
		],
	);
	assert.deepEqual(merged, ['fixture-game/a', 'fixture-game/b', 'fixture-game/c']);
});

test('nextStepSlug returns first next-step relation only', () => {
	assert.equal(
		nextStepSlug([
			{ slug: 'fixture-game/related', type: 'related' },
			{ slug: 'fixture-game/next', type: 'next-step' },
		]),
		'fixture-game/next',
	);
	assert.equal(nextStepSlug(undefined), undefined);
});

test('nextStepSlugs returns up to 3 next-step slugs in config order', () => {
	const relations = [
		{ slug: 'g/a', type: 'related' as const },
		{ slug: 'g/b', type: 'next-step' as const },
		{ slug: 'g/c', type: 'next-step' as const },
		{ slug: 'g/d', type: 'next-step' as const },
		{ slug: 'g/e', type: 'next-step' as const },
	];
	const result = nextStepSlugs(relations);
	assert.deepEqual(result, ['g/b', 'g/c', 'g/d']);
});

test('nextStepSlugs deduplicates slugs', () => {
	const result = nextStepSlugs([
		{ slug: 'g/a', type: 'next-step' },
		{ slug: 'g/a', type: 'next-step' },
		{ slug: 'g/b', type: 'next-step' },
	]);
	assert.deepEqual(result, ['g/a', 'g/b']);
});

test('nextStepSlugs returns empty array when no next-steps', () => {
	assert.deepEqual(nextStepSlugs(undefined), []);
	assert.deepEqual(nextStepSlugs([{ slug: 'g/a', type: 'related' }]), []);
});

test('findOrphanPages ignores category landing as inbound relief', () => {
	const spec = {
		pages: [
			{ id: 'linked', slug: 'linked', category: 'getting-started' },
			{ id: 'orphan', slug: 'orphan', category: 'game-info' },
		],
		homepage: {
			startHere: [{ pageId: 'linked' }],
		},
	} as unknown as SiteSpec;

	const orphans = findOrphanPages(spec);
	assert.deepEqual(
		orphans.map((page) => page.id),
		['orphan'],
	);
});
