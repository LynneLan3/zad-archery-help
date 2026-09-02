import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateV4Standalone } from '../../scripts/v4/generate-v4';

const fixture = path.resolve('site-input/v4-example/site.json');

test('standalone generator emits a complete canonical V4 site into an empty destination', () => {
	const destination = mkdtempSync(path.join(os.tmpdir(), 'g016-v4-'));
	try {
		const generated = generateV4Standalone(fixture, destination);
		assert.equal(generated.pages.length, 11);
		assert.equal(existsSync(path.join(destination, 'src/pages/index.astro')), true);
		assert.equal(existsSync(path.join(destination, 'src/pages/search.astro')), true);
		assert.equal(existsSync(path.join(destination, 'src/pages/category.astro')), true);
		assert.equal(existsSync(path.join(destination, 'src/pages/[...page].astro')), true);
		assert.equal(existsSync(path.join(destination, 'scripts/v4/standalone/validate-generated-site.ts')), true);
		assert.equal(existsSync(path.join(destination, 'tests')), false);
		assert.equal(existsSync(path.join(destination, 'src/g017')), false);
		assert.equal(existsSync(path.join(destination, 'src/layouts')), false);
		for (const asset of ['emberfall-map.svg', 'emberfall-core.svg', 'emberfall-forge.svg']) {
			assert.equal(existsSync(path.join(destination, 'public/v4', asset)), true, `generated asset copied: ${asset}`);
		}
		const standalonePage = readFileSync(path.join(destination, 'src/pages/[...page].astro'), 'utf8');
		assert.match(standalonePage, /data-v4-map-marker/);
		assert.match(standalonePage, /data-v4-calc-input/);
		assert.match(standalonePage, /addEventListener\('input'/);
		assert.match(standalonePage, /data-v4-workspace-control/);
		const output = readFileSync(path.join(destination, 'src/v4/generated/example-site.json'), 'utf8');
		assert.equal(output.includes('/v4-preview/'), false);
		assert.equal(readdirSync(path.join(destination, 'src/pages')).some((name) => name.includes('getting-started') || name.includes('starter')), false);
		assert.equal(generated.navigation.primary[0].href, '/');
		assert.equal(generated.navigation.utilities?.[0].href, '/search/');
		for (const page of generated.pages) assert.match(page.href, /^\/[a-z0-9-]+\/$/);
	} finally {
		rmSync(destination, { recursive: true, force: true });
	}
});

test('standalone generator refuses a non-empty destination', () => {
	const destination = mkdtempSync(path.join(os.tmpdir(), 'g016-v4-nonempty-'));
	try {
		writeFileSync(path.join(destination, 'existing.txt'), 'keep');
		assert.throws(() => generateV4Standalone(fixture, destination), /must be empty/);
	} finally {
		rmSync(destination, { recursive: true, force: true });
	}
});
