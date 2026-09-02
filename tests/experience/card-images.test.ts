import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveGuideCardImage, sortGuidesByCardImage } from '../../src/lib/card-images';
import type { GuideEntry } from '../../src/lib/guides';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function cssBlock(file: string, selector: string): string {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const match = readFileSync(path.join(ROOT, file), 'utf8').match(
		new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`),
	);
	assert.ok(match, `${selector} must have a CSS block in ${file}`);
	return match[1];
}

function guide(id: string, image = false) {
	return {
		id,
		data: {
			title: id,
			...(image ? { cover: { src: `${id}.svg` } } : {}),
		},
	} as never;
}

test('card image resolver prefers explicit card image, then thumbnail, then cover', () => {
	const entry = {
		data: {
			title: 'Guide',
			cover: { src: 'cover.svg' },
			thumbnail: { src: 'thumbnail.svg' },
			cardImage: { src: 'card.svg' },
		},
	} as never;
	assert.equal(resolveGuideCardImage(entry)?.src, 'card.svg');
});

test('card sorting puts image-bearing guides first without changing relative order', () => {
	const entries = [guide('text-a'), guide('image-a', true), guide('text-b'), guide('image-b', true)];
	assert.deepEqual(sortGuidesByCardImage(entries).map((entry) => entry.id), ['image-a', 'image-b', 'text-a', 'text-b']);
});

test('starter placeholders are treated as missing Experience card media', () => {
	const entry = { data: { title: 'Demo', cover: { src: '/_astro/placeholder.svg' } } } as GuideEntry;
	assert.equal(resolveGuideCardImage(entry), undefined);
});

test('thumbnail container respects card bounds for img and picture output', () => {
	for (const file of ['src/styles/custom.css', 'src/styles/experience.css']) {
		const block = cssBlock(file, '.card-thumbnail');
		for (const declaration of [
			'display:\\s*block',
			'width:\\s*100%',
			'min-width:\\s*0',
			'max-width:\\s*100%',
			'min-height:\\s*0',
			'overflow:\\s*hidden',
			'aspect-ratio:\\s*16\\s*/\\s*9',
		]) {
			assert.match(block, new RegExp(declaration), `${file} .card-thumbnail is missing ${declaration}`);
		}
	}
	const custom = readFileSync(path.join(ROOT, 'src/styles/custom.css'), 'utf8');
	assert.match(custom, /\.card-thumbnail img,\s*\.card-thumbnail picture,\s*\.card-thumbnail picture img/);
	assert.match(custom, /\.gw-card\s*\{[^}]*min-width:\s*0[^}]*overflow:\s*hidden/s);
	assert.match(custom, /\.gw-related a\s*\{[^}]*min-width:\s*0[^}]*overflow:\s*hidden/s);
});
