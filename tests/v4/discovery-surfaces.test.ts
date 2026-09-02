import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCategorySurface, buildHomepage, buildSearchSurface, isAnswerHub } from '../../src/v4/discovery-surfaces';
import { resolveIntent } from '../../src/v4/intent-resolver';

function entry(id: string, query: string, priority: number) {
	return { id, title: query, description: `${query} answer`, href: `/${id}/`, priority, intent: resolveIntent({ query, playerProblem: query }) };
}

test('homepage ordering is research-priority driven and stable', () => {
	const surface = buildHomepage([entry('b', 'dream nail', 2), entry('a', 'minecraft mobs', 5), entry('c', 'minecraft cake', 5)]);
	assert.deepEqual(surface.items.map((item) => item.id), ['a', 'c', 'b']);
	assert.equal(surface.answerBearing, false);
});

test('search and navigation category are distinct discovery surfaces', () => {
	const entries = [entry('mobs', 'minecraft mobs', 1), entry('cake', 'minecraft cake', 1)];
	assert.deepEqual(buildSearchSurface('mobs', entries).items.map((item) => item.id), ['mobs']);
	assert.deepEqual(buildCategorySurface(entries).items.map((item) => item.id), ['mobs', 'cake']);
	assert.equal(buildSearchSurface('mobs', entries).kind, 'search');
	assert.equal(buildCategorySurface(entries).kind, 'category');
});

test('catalog prototype remains an answer-bearing hub candidate', () => {
	const catalog = entry('mobs', 'minecraft mobs', 1);
	assert.equal(isAnswerHub(catalog), true);
	assert.equal(catalog.intent.prototype, 'P2');
});
