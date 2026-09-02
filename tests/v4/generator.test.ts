import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateV4, generateV4File } from '../../scripts/v4/generate-v4';

test('V4 generator deterministically connects intent, data, media, and composition', () => {
	const generated = generateV4({
		game: { name: 'Fixture Game', slug: 'fixture-game', accent: '#f59e0b' },
		pages: [
			{ id: 'map', title: 'Map', href: '/map/', query: 'resource map', playerProblem: 'find a place', primaryTask: 'location', priority: 2, assets: [{ role: 'map', path: 'map.svg', alt: 'Map', usable: true }], primitiveData: [{ behavior: 'map', data: [{ value: 'Cave' }] }] },
			{ id: 'entity', title: 'Entity', href: '/entity/', query: 'entity', playerProblem: 'look it up', primaryTask: 'entity-lookup', priority: 5 },
		],
	});
	assert.deepEqual(generated.homepage.pageIds, ['entity', 'map']);
	assert.equal(generated.theme.base, 'neutral-dark');
	assert.equal(generated.pages[0]?.pageData.intent.prototype, 'P5');
	assert.equal(generated.pages[0]?.composition.showHero, false);
});

test('hero media defaults to homepage and does not leak into content pages', () => {
	const generated = generateV4({
		game: { name: 'Scarlet-compatible Game', slug: 'scarlet-compatible' },
		pages: [{
			id: 'release', title: 'Release', href: '/release/', query: 'release', playerProblem: 'check release facts', primaryTask: 'entity-lookup',
			assets: [{ role: 'hero', path: '/v4/cover.jpg', alt: 'Official cover', usable: true }],
			primitiveData: [{ primitiveId: 'A01', instanceId: 'answer', payload: { title: 'Release', task: 'Check facts', subject: 'Scarlet-compatible Game' }, evidenceRefs: [], mediaRefs: [] }],
		}],
	});
	assert.deepEqual(generated.homepage.assets.map((asset) => asset.path), ['/v4/cover.jpg']);
	assert.deepEqual(generated.pages[0]?.pageData.media, []);
	assert.equal(generated.pages[0]?.composition.showHero, false);
});

test('explicit content-page media binding is preserved', () => {
	const generated = generateV4({
		game: { name: 'Bound Game', slug: 'bound-game' },
		pages: [{
			id: 'entity', title: 'Entity', href: '/entity/', query: 'entity', playerProblem: 'look up entity', primaryTask: 'entity-lookup',
			assets: [{ role: 'hero', path: '/v4/entity.jpg', alt: 'Entity', usable: true }],
			primitiveData: [{ primitiveId: 'A01', instanceId: 'answer', payload: { title: 'Entity', task: 'Look up', subject: 'Bound Game' }, evidenceRefs: [], mediaRefs: ['media-1'] }],
		}],
	});
	assert.deepEqual(generated.homepage.assets, []);
	assert.deepEqual(generated.pages[0]?.pageData.media.map((asset) => asset.localRef), ['/v4/entity.jpg']);
});

test('V4 generator writes only its requested output artifact', () => {
	const dir = mkdtempSync(path.join(os.tmpdir(), 'g016-v4-'));
	try {
		const input = path.join(dir, 'input.json');
		const output = path.join(dir, 'generated', 'site.json');
		const data = { game: { name: 'Fixture', slug: 'fixture' }, pages: [] };
		writeFileSync(input, `${JSON.stringify(data)}\n`, 'utf8');
		// The pure function is the contract used by the CLI; verify serialized output separately.
		generateV4File(input, output);
		assert.deepEqual(JSON.parse(readFileSync(output, 'utf8')).homepage.pageIds, []);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});
