import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAffiliateLinkAttrs, rehypeAffiliateLinks } from '../../src/lib/affiliate-link';

test('title affiliate mark becomes rel=sponsored and outbound_kind=affiliate', () => {
	const attrs = applyAffiliateLinkAttrs({
		title: 'affiliate',
		rel: 'noopener',
		target: '_blank',
	});
	assert.ok(attrs);
	assert.match(attrs.rel, /\bsponsored\b/);
	assert.match(attrs.rel, /\bnoopener\b/);
	assert.equal(attrs.outboundKind, 'affiliate');
	assert.equal(attrs.title, undefined);
});

test('class affiliate mark does not rewrite href', () => {
	const attrs = applyAffiliateLinkAttrs({ className: 'affiliate extra' });
	assert.ok(attrs);
	assert.equal(attrs.rel, 'sponsored');
	assert.equal(attrs.outboundKind, 'affiliate');
});

test('unmarked links are left unchanged', () => {
	assert.equal(applyAffiliateLinkAttrs({ title: 'Steam store' }), null);
});

test('rehype plugin writes data-outbound-kind without hiding the URL', () => {
	const tree = {
		type: 'element',
		tagName: 'a',
		properties: {
			href: 'https://store.steampowered.com/app/1',
			title: 'affiliate',
		},
		children: [],
	};
	rehypeAffiliateLinks()({ type: 'root', children: [tree] });
	assert.equal(tree.properties.href, 'https://store.steampowered.com/app/1');
	assert.deepEqual(tree.properties.rel, ['sponsored']);
	assert.equal(tree.properties.dataOutboundKind, 'affiliate');
	assert.equal(tree.properties.title, undefined);
});
