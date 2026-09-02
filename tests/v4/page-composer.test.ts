import assert from 'node:assert/strict';
import test from 'node:test';
import { createPageData } from '../../src/v4/page-data-contract';
import { composePage } from '../../src/v4/page-composer';
import { resolveIntent } from '../../src/v4/intent-resolver';

test('composer orders selected behaviors by answer intent, not Article sections', () => {
	const page = createPageData({
		page: { id: 'procedure', title: 'Procedure', href: '/procedure/' },
		intent: resolveIntent({ query: 'how to tame', playerProblem: 'complete the procedure', primaryTask: 'procedure' }),
		primitiveSupport: { P01: 'available', P04: 'available' },
		primitiveData: [
			{ behavior: 'recovery', data: [{ value: 'retry' }] },
			{ behavior: 'ordered-steps', data: [{ step: 1, value: 'Prepare' }] },
			{ behavior: 'requirements', data: [{ value: 'Tool' }] },
		],
	});
	const composed = composePage(page);
	assert.deepEqual(composed.primitives.map((primitive) => primitive.id), ['P01', 'P02', 'P04']);
	assert.equal(composed.surface, 'answer');
	assert.equal(composed.hasPermanentDocsSidebar, false);
});

test('hero is optional and derived from usable task media', () => {
	const intent = resolveIntent({ query: 'dream nail', playerProblem: 'look up the entity', primaryTask: 'entity-lookup' });
	const withoutHero = composePage(createPageData({ page: { id: 'entity', title: 'Entity', href: '/entity/' }, intent }));
	assert.equal(withoutHero.showHero, false);
	const withHero = composePage(createPageData({ page: { id: 'entity', title: 'Entity', href: '/entity/' }, intent, assets: [{ role: 'hero', alt: 'Entity image', usable: true }] }));
	assert.equal(withHero.showHero, true);
});
