import assert from 'node:assert/strict';
import test from 'node:test';
import { assertNoAssetUpscale, validateAssetUsage } from '../../scripts/lib/asset-contract';

const asset = { id: 'hero', source: 'hero.svg', target: 'hero.svg', alt: 'Hero', sourceType: 'official' as const, usageStatus: 'approved' as const };

test('Phase 2 asset contract rejects low-resolution hero sources', () => {
	assert.throws(
		() => validateAssetUsage(asset, { width: 1599, height: 900, aspectRatio: 1.7767, fileSize: 10 }, ['homepageHero']),
		/HERO_ASSET_TOO_SMALL/,
	);
});

test('Phase 2 asset contract rejects invalid aspect ratios', () => {
	assert.throws(
		() => validateAssetUsage(asset, { width: 1920, height: 1920, aspectRatio: 1, fileSize: 10 }, ['homepageHero']),
		/ASSET_ASPECT_INVALID/,
	);
});

test('Phase 2 asset contract detects an output width that would upscale the source', () => {
	assert.throws(
		() => assertNoAssetUpscale(asset, { width: 1600, height: 900, aspectRatio: 1.7778, fileSize: 10 }, ['homepageHero']),
		/ASSET_UPSCALE_REQUIRED/,
	);
});
