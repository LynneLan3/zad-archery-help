import assert from 'node:assert/strict';
import test from 'node:test';
import { mediaAspectRatio, type MediaAsset } from '../../src/lib/media';

test('MediaAsset keeps semantic alt separate from caption and attribution', () => {
	const media: MediaAsset = {
		src: 'evidence/door.svg',
		alt: 'Locked maintenance door beside the red generator',
		caption: 'The door remains locked before the generator is restored.',
		sourceLabel: 'Official press kit',
		sourceUrl: 'https://example.com/press-kit',
		kind: 'evidence',
		aspectRatio: 'auto',
	};
	assert.equal(media.alt, 'Locked maintenance door beside the red generator');
	assert.equal(media.caption, 'The door remains locked before the generator is restored.');
	assert.equal(media.sourceLabel, 'Official press kit');
});

test('media ratio policy maps configured ratios and preserves natural ratio for auto', () => {
	assert.equal(mediaAspectRatio('16:9'), '16 / 9');
	assert.equal(mediaAspectRatio('portrait'), '3 / 4');
	assert.equal(mediaAspectRatio('auto'), undefined);
});
