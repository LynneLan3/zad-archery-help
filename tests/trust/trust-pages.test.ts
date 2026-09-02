import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeHubPath, pageHref } from '../../src/lib/paths';
import { TRUST_PAGE_KINDS, TRUST_PAGE_SLUGS } from '../../src/lib/trust';
import type { GameConfig } from '../../src/config/game-types';

function configWithHub(hubPath: string): GameConfig {
	const hub = normalizeHubPath(hubPath);
	return {
		name: 'Fixture Game',
		shortName: 'Fixture',
		description: 'Fixture',
		tagline: 'Fixture',
		siteUrl: 'https://fixture.example',
		hubPath: hub,
		releaseStatus: 'released',
		releaseDate: '2026-01-01',
		developer: 'Dev',
		publisher: 'Pub',
		platforms: ['PC'],
		accentColor: '#000000',
		categories: [
			{
				id: 'getting-started',
				label: 'Start',
				description: 'Start',
				icon: 'rocket',
				order: 1,
			},
		],
		trust: {
			enabled: true,
			pages: Object.fromEntries(
				TRUST_PAGE_KINDS.map((kind) => [
					kind,
					{
						enabled: true as const,
						slug: TRUST_PAGE_SLUGS[kind],
						path: pageHref(hub, TRUST_PAGE_SLUGS[kind]),
						title: kind,
						robots: kind === 'privacy' || kind === 'affiliateDisclosure' ? ('noindex,follow' as const) : ('index,follow' as const),
					},
				]),
			),
		},
	};
}

function trustPageParamFromHub(hubPath: string, kind: (typeof TRUST_PAGE_KINDS)[number]): string {
	return pageHref(normalizeHubPath(hubPath), TRUST_PAGE_SLUGS[kind]).replace(/^\/+|\/+$/g, '');
}

test('trust URLs respect root hubPath', () => {
	const hub = normalizeHubPath('/');
	assert.equal(pageHref(hub, TRUST_PAGE_SLUGS.about), '/about/');
	assert.equal(pageHref(hub, TRUST_PAGE_SLUGS.editorialMethod), '/editorial-method/');
	assert.equal(pageHref(hub, TRUST_PAGE_SLUGS.privacy), '/privacy/');
	assert.equal(pageHref(hub, TRUST_PAGE_SLUGS.affiliateDisclosure), '/affiliate-disclosure/');
	assert.equal(trustPageParamFromHub('/', 'about'), 'about');
});

test('trust URLs respect single-segment hubPath', () => {
	const hub = normalizeHubPath('/mortal-shell-ii/');
	assert.equal(pageHref(hub, TRUST_PAGE_SLUGS.about), '/mortal-shell-ii/about/');
	assert.equal(pageHref(hub, TRUST_PAGE_SLUGS.privacy), '/mortal-shell-ii/privacy/');
	assert.equal(trustPageParamFromHub('/mortal-shell-ii/', 'privacy'), 'mortal-shell-ii/privacy');
});

test('generated trust runtime config stores path and robots only', () => {
	const rootConfig = configWithHub('/');
	const nestedConfig = configWithHub('/fixture-game/');
	assert.equal(rootConfig.trust!.pages.about!.path, '/about/');
	assert.equal(nestedConfig.trust!.pages.about!.path, '/fixture-game/about/');
	assert.equal(nestedConfig.trust!.pages.privacy!.robots, 'noindex,follow');
	assert.equal(nestedConfig.trust!.pages.affiliateDisclosure!.robots, 'noindex,follow');
	assert.equal(nestedConfig.trust!.pages.about!.robots, 'index,follow');
});
