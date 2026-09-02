import assert from 'node:assert/strict';
import test from 'node:test';
import type { GameRoute } from '../../src/config/game-types';
import { findRoutesForPage, routeHref } from '../../src/lib/routes';

const routes: GameRoute[] = [
	{
		id: 'getting-started',
		title: 'Getting Started',
		description: 'First run prep.',
		href: '/example-game/routes/getting-started/',
		pages: [
			{ pageId: 'beginner-guide', href: '/example-game/beginner-guide/', title: 'Beginner', description: 'First guide' },
			{ pageId: 'gameplay-overview', href: '/example-game/gameplay-overview/', title: 'Gameplay', description: 'Loop' },
		],
	},
	{
		id: 'core-gameplay',
		title: 'Core Gameplay',
		description: 'Systems behind encounters.',
		href: '/example-game/routes/core-gameplay/',
		pages: [{ pageId: 'gameplay-overview', href: '/example-game/gameplay-overview/', title: 'Gameplay', description: 'Loop' }],
	},
];

test('routeHref builds single-segment hub route URLs', () => {
	assert.equal(routeHref('/example-game/', 'getting-started'), '/example-game/routes/getting-started/');
});

test('routeHref builds root hub route URLs', () => {
	assert.equal(routeHref('/', 'getting-started'), '/routes/getting-started/');
});

test('routeHref tolerates slash-padded ids', () => {
	assert.equal(routeHref('/example-game/', '/getting-started/'), '/example-game/routes/getting-started/');
});

test('routeHref rejects nested ids', () => {
	assert.throws(() => routeHref('/example-game/', 'nested/route'), /single path segment/);
	assert.throws(() => routeHref('/example-game/', ''), /single path segment/);
});

test('findRoutesForPage returns every containing route in config order', () => {
	const result = findRoutesForPage('gameplay-overview', routes);
	assert.deepEqual(
		result.map((route) => route.id),
		['getting-started', 'core-gameplay'],
	);
	assert.deepEqual(
		findRoutesForPage('beginner-guide', routes).map((route) => route.id),
		['getting-started'],
	);
});

test('findRoutesForPage returns empty for unknown page and never mutates input', () => {
	assert.deepEqual(findRoutesForPage('missing', routes), []);
	const before = JSON.stringify(routes);
	findRoutesForPage('gameplay-overview', routes);
	assert.equal(JSON.stringify(routes), before);
});

test('findRoutesForPage accepts empty route list', () => {
	assert.deepEqual(findRoutesForPage('beginner-guide', []), []);
});
