import assert from 'node:assert/strict';
import test from 'node:test';
import { bindTaskMedia } from '../../src/v4/media-binding';
import { createPageData } from '../../src/v4/page-data-contract';
import { resolveIntent } from '../../src/v4/intent-resolver';

test('functional media is prioritized over decorative media', () => {
	const result = bindTaskMedia('location', [
		{ role: 'decorative', alt: 'Decorative art', usable: true },
		{ role: 'map', path: 'map.svg', alt: 'Reliable map', usable: true },
	]);
	assert.equal(result.assets[0]?.role, 'map');
	assert.equal(result.primitiveSupport.L02, 'available');
});

test('missing map media does not block location binding', () => {
	const result = bindTaskMedia('location', []);
	assert.equal(result.assets.length, 0);
	assert.equal(result.primitiveSupport.L02, 'unsupported');
	assert.equal(result.primitiveSupport.L03, 'unsupported');
});

test('entity assets bind only to their relevant task behavior', () => {
	assert.equal(bindTaskMedia('entity-lookup', [{ role: 'entity', path: 'entity.svg', alt: 'Entity', usable: true }]).primitiveSupport.E01, 'available');
});

test('valid media binds into the registry and can be referenced by multiple primitives', () => {
	const bound = bindTaskMedia('entity-lookup', [{ role: 'entity', path: '/v4/entity.svg', alt: 'Entity', usable: true }]);
	const page = createPageData({
		page: { id: 'entity', title: 'Entity', href: '/entity/' },
		intent: resolveIntent({ query: 'entity', playerProblem: 'look up an entity', primaryTask: 'entity-lookup' }),
		assets: bound.assets,
		primitiveData: [
			{ instanceId: 'header', primitiveId: 'A01', payload: { title: 'Entity', task: 'Lookup', subject: 'Entity' }, evidenceRefs: [], mediaRefs: ['media-1'] },
			{ instanceId: 'facts', primitiveId: 'E01', payload: { facts: [] }, evidenceRefs: [], mediaRefs: ['media-1'] },
		],
	});
	assert.deepEqual(page.media.map((item) => [item.mediaId, item.localRef]), [['media-1', '/v4/entity.svg']]);
	assert.deepEqual(page.primitiveData.map((item) => item.mediaRefs), [['media-1'], ['media-1']]);
});

test('invalid or unsupported media is dropped before the registry and cannot create a broken reference', () => {
	const bound = bindTaskMedia('entity-lookup', [
		{ role: 'entity', path: '', alt: 'Empty path', usable: true },
		{ role: 'entity', path: 'javascript:alert(1)', alt: 'Unsupported scheme', usable: true },
		{ role: 'entity', path: '/v4/entity.svg', alt: 'Valid entity', usable: false },
	]);
	assert.equal(bound.assets.length, 0);
	const page = createPageData({
		page: { id: 'entity', title: 'Entity', href: '/entity/' },
		intent: resolveIntent({ query: 'entity', playerProblem: 'look up an entity', primaryTask: 'entity-lookup' }),
		assets: bound.assets,
		primitiveData: [{ instanceId: 'header', primitiveId: 'A01', payload: { title: 'Entity', task: 'Lookup', subject: 'Entity' }, evidenceRefs: [], mediaRefs: ['media-1'] }],
	});
	assert.deepEqual(page.media, []);
	assert.deepEqual(page.primitiveData[0]?.mediaRefs, []);
});
