import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveOutboundClick } from '../../src/lib/outbound';

const hosts = ['fixture-wiki.example'];
const origin = 'https://fixture-wiki.example';

test('external https link is outbound content by default', () => {
	const event = resolveOutboundClick({
		href: 'https://store.steampowered.com/app/123?utm_source=wiki#reviews',
		linkText: 'Steam page',
		siteHosts: hosts,
		baseOrigin: origin,
	});
	assert.deepEqual(event, {
		link_url: 'https://store.steampowered.com/app/123',
		link_domain: 'store.steampowered.com',
		link_text: 'Steam page',
		outbound_kind: 'content',
	});
});

test('source and evidence dataset kinds are preserved', () => {
	assert.equal(
		resolveOutboundClick({
			href: 'https://example.com/faq',
			datasetKind: 'source',
			siteHosts: hosts,
			baseOrigin: origin,
		})?.outbound_kind,
		'source',
	);
	assert.equal(
		resolveOutboundClick({
			href: 'https://example.com/still',
			datasetKind: 'evidence',
			siteHosts: hosts,
			baseOrigin: origin,
		})?.outbound_kind,
		'evidence',
	);
});

test('affiliate dataset kind is preserved on outbound_click', () => {
	assert.equal(
		resolveOutboundClick({
			href: 'https://store.steampowered.com/app/1',
			datasetKind: 'affiliate',
			linkText: 'Buy',
			siteHosts: hosts,
			baseOrigin: origin,
		})?.outbound_kind,
		'affiliate',
	);
});

test('same-domain and relative links are not outbound', () => {
	assert.equal(
		resolveOutboundClick({
			href: 'https://fixture-wiki.example/fixture-game/about/',
			siteHosts: hosts,
			baseOrigin: origin,
		}),
		null,
	);
	assert.equal(
		resolveOutboundClick({
			href: '/fixture-game/beginner-guide/',
			siteHosts: hosts,
			baseOrigin: origin,
		}),
		null,
	);
});

test('mailto tel javascript and hash links are not outbound', () => {
	assert.equal(resolveOutboundClick({ href: 'mailto:hi@example.com', siteHosts: hosts, baseOrigin: origin }), null);
	assert.equal(resolveOutboundClick({ href: 'tel:+15555550100', siteHosts: hosts, baseOrigin: origin }), null);
	assert.equal(resolveOutboundClick({ href: 'javascript:void(0)', siteHosts: hosts, baseOrigin: origin }), null);
	assert.equal(resolveOutboundClick({ href: '#browse-guides', siteHosts: hosts, baseOrigin: origin }), null);
});
