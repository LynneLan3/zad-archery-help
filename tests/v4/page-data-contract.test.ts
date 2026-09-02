import assert from 'node:assert/strict';
import test from 'node:test';
import { createPageData, includedPrimitiveBehaviors } from '../../src/v4/page-data-contract';
import { resolveIntent } from '../../src/v4/intent-resolver';

const page = { id: 'test-page', title: 'Test Page', href: '/test-page/' };
const intent = (query = 'dream nail', playerProblem = 'look up') => resolveIntent({ query, playerProblem, primaryTask: 'entity-lookup' });

test('PageData has frozen top-level registries and instance shape', () => {
  const result = createPageData({ page, intent: intent(), evidence: [{ evidenceId: 'e1', sourceType: 'official', sourceRef: 'https://example.test', finding: 'supports fact' }], primitiveData: [{ instanceId: 'facts-1', primitiveId: 'E01', payload: { facts: [{ label: 'Type', value: 'Item' }] }, evidenceRefs: ['e1'], mediaRefs: [] }] });
  assert.equal(result.pageDataVersion, 'v4');
  assert.deepEqual(result.page, { ...page, query: 'dream nail', playerProblem: 'look up' });
  assert.deepEqual(Object.keys(result.primitiveData[0] ?? {}).sort(), ['evidenceRefs', 'instanceId', 'mediaRefs', 'payload', 'primitiveId']);
  assert.equal(result.evidence[0]?.evidenceId, 'e1');
});

test('same Primitive supports multiple instances and only included IDs serialize', () => {
  const result = createPageData({ page, intent: intent(), primitiveData: [{ instanceId: 'a', primitiveId: 'E01', payload: { facts: [] }, evidenceRefs: [], mediaRefs: [] }, { instanceId: 'b', primitiveId: 'E01', payload: { facts: [] }, evidenceRefs: [], mediaRefs: [] }, { instanceId: 'omit', primitiveId: 'D02', payload: { entries: [] }, evidenceRefs: [], mediaRefs: [] }] });
  assert.deepEqual(result.primitiveData.map((item) => item.instanceId), ['a', 'b']);
});

test('conditional resolves before composition; unresolved optional data is omitted', () => {
  const result = createPageData({ page, intent: resolveIntent({ query: 'best builds', playerProblem: 'choose', primaryTask: 'recommendation' }), primitiveSupport: { D02: 'unsupported' } });
  assert.equal(result.primitiveRecipe.some((item) => item.status === 'conditional'), false);
  assert.equal(result.primitiveRecipe.find((item) => item.primitiveId === 'D02')?.status, 'omit');
});

test('unsupported map omits L02 while page remains ready', () => {
  const result = createPageData({ page, intent: resolveIntent({ query: 'resource location', playerProblem: 'find', primaryTask: 'location' }), primitiveSupport: { L02: 'unsupported', L03: 'unsupported' }, primitiveData: [{ behavior: 'location-facts', data: [{ value: 'Cave' }] }] });
  assert.equal(result.primitiveData[0]?.primitiveId, 'L01');
  assert.equal(result.primitiveRecipe.find((item) => item.primitiveId === 'L02')?.status, 'omit');
  assert.deepEqual(includedPrimitiveBehaviors(result), ['A01', 'L01']);
});

test('Evidence Registry and Media Registry stay separate from payload', () => {
  const result = createPageData({ page, intent: intent(), evidence: [{ label: 'Official' }], assets: [{ role: 'entity', path: 'entity.png', alt: 'Entity', usable: true }], primitiveData: [{ primitiveId: 'E01', payload: { facts: [] }, instanceId: 'e1', evidenceRefs: ['evidence-1', 'missing'], mediaRefs: ['media-1', 'missing'] }] });
  assert.equal(result.evidence[0]?.finding, 'Official');
  assert.equal(result.media[0]?.mediaId, 'media-1');
  assert.deepEqual(result.primitiveData[0]?.evidenceRefs, ['evidence-1']);
  assert.deepEqual(result.primitiveData[0]?.mediaRefs, ['media-1']);
});
