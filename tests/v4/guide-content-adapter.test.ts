import assert from 'node:assert/strict';
import test from 'node:test';
import { adaptGuideContentResult } from '../../src/v4/guide-content-adapter';
import { PRIMITIVE_DEFINITIONS } from '../../src/v4/primitives';
import { guideFixtures } from './fixtures/g024-guide-content-fixtures';

const adapt = (prototype: keyof typeof guideFixtures) => {
	const fixture = guideFixtures[prototype];
	return adaptGuideContentResult(fixture.result, fixture.refs, fixture.page);
};
const primitiveIds = (prototype: keyof typeof guideFixtures) => adapt(prototype).composition.primitives.map((item) => item.id);

test('G024 P5 maps all four filled Guide Content Result fixtures only through frozen V4 primitives', () => {
	const frozen = new Set(PRIMITIVE_DEFINITIONS.map((item) => item.id));
	for (const prototype of ['P4', 'P5', 'P6', 'P7'] as const) {
		const fixture = guideFixtures[prototype]; const adapted = adapt(prototype);
		assert.equal(adapted.pageData.pageDataVersion, 'v4');
		assert.deepEqual(adapted.report.missingSlotsOmitted, fixture.result.coverage.missingSlots);
		assert.equal(adapted.report.unsupportedContentAdded, 0);
		assert.deepEqual(adapted.report.materialsPreserved.sort(), [...fixture.result.sourceMaterialRefs].sort());
		assert.equal(adapted.pageData.body.faq.length, 0, 'P5 must not manufacture FAQ sections');
		for (const primitive of adapted.composition.primitives) assert.equal(frozen.has(primitive.id), true, `${prototype} used an unknown V4 primitive`);
	}
});

test('P4 renders ordered procedure and recovery while preserving non-image video evidence provenance', () => {
	const adapted = adapt('P4'); const steps = adapted.pageData.primitiveData.find((item) => item.primitiveId === 'P02');
	assert.deepEqual(primitiveIds('P4').filter((id) => ['P01', 'P02', 'P04'].includes(id)), ['P01', 'P02', 'P04']);
	assert.equal((steps?.payload as { steps: readonly { order: number }[] }).steps[0]?.order, 1);
	assert.equal(adapted.pageData.primitiveData.some((item) => item.primitiveId === 'P04'), true);
	assert.equal(adapted.pageData.media.length, 0, 'DIRECT_GAMEPLAY must not be rendered as a copied image');
	assert.deepEqual(adapted.report.mediaBindingsPreserved, [{ mediaRef: 'p4-video-step', slotRef: 'steps', materialRefs: ['p4-step-1'], renderedAs: 'evidence' }]);
	assert.equal(adapted.pageData.evidence.some((item) => item.sourceType === 'DIRECT_GAMEPLAY'), true);
});

test('P5 renders exact location, reliable map, route and route-bound media; missing edge cases remain omitted', () => {
	const adapted = adapt('P5');
	assert.deepEqual(primitiveIds('P5').filter((id) => ['L01', 'L02', 'L03'].includes(id)), ['L01', 'L02', 'L03']);
	assert.equal(adapted.pageData.media[0]?.mediaId, 'p5-map-anchor');
	assert.equal(adapted.pageData.primitiveData.find((item) => item.primitiveId === 'L03')?.mediaRefs.includes('p5-map-anchor'), true);
	assert.equal(adapted.report.blueprintSlotsRendered.includes('edgeCases'), false);
	assert.equal(adapted.pageData.primitiveData.some((item) => item.primitiveId === 'P04'), false);
});

test('P5 omits the map, but retains location and route, when no reliable map material exists', () => {
	const fixture = guideFixtures.P5;
	const refs = { ...fixture.refs, sources: fixture.refs.sources.map((item) => item.sourceId === 'p5-map' ? { ...item, evidenceType: 'VIDEO' } : item) };
	const adapted = adaptGuideContentResult(fixture.result, refs, fixture.page);
	assert.equal(adapted.pageData.primitiveData.some((item) => item.primitiveId === 'L02'), false);
	assert.equal(adapted.pageData.primitiveData.some((item) => item.primitiveId === 'L01'), true);
	assert.equal(adapted.pageData.primitiveData.some((item) => item.primitiveId === 'L03'), true);
	assert.equal(adapted.pageData.media.length, 0);
});

test('an upstream MISSING slot is omitted even when a stale content item is present', () => {
	const fixture = guideFixtures.P4;
	const result = { ...fixture.result, coverage: { ...fixture.result.coverage, missingSlots: [...fixture.result.coverage.missingSlots, 'failures'] } };
	const adapted = adaptGuideContentResult(result, fixture.refs, fixture.page);
	assert.equal(adapted.pageData.primitiveData.some((item) => item.primitiveId === 'P04'), false);
	assert.equal(adapted.pageData.body.sections.some((item) => item.id === 'failures'), false);
});

test('P6 renders ordered milestones, branch recommendation, and next gate without changing recommendation into a fact', () => {
	const adapted = adapt('P6');
	assert.equal(adapted.pageData.primitiveData.some((item) => item.primitiveId === 'P03'), true);
	assert.equal(adapted.pageData.primitiveData.some((item) => item.primitiveId === 'D03'), true);
	assert.equal(adapted.pageData.primitiveData.some((item) => item.primitiveId === 'N01'), true);
	const facts = adapted.pageData.primitiveData.find((item) => item.primitiveId === 'E01');
	assert.equal(JSON.stringify(facts?.payload).includes('Prepare before entering'), false, 'recommendation must remain in D03, not E01 fact card');
});

test('P7 renders a structured table, formula with measurement-bound example, and troubleshooting', () => {
	const adapted = adapt('P7');
	assert.equal(adapted.pageData.primitiveData.some((item) => item.primitiveId === 'E03'), true);
	assert.equal(adapted.pageData.primitiveData.some((item) => item.primitiveId === 'X03'), true);
	assert.equal(adapted.pageData.primitiveData.some((item) => item.primitiveId === 'P04'), true);
	const formula = adapted.pageData.primitiveData.find((item) => item.primitiveId === 'X03');
	assert.equal((formula?.payload as { expression: string }).expression, 'charge = flow * time');
	assert.equal(JSON.stringify(formula?.payload).includes('Observed charge was 20 units in this setup.'), true);
	const facts = adapted.pageData.primitiveData.find((item) => item.primitiveId === 'E01');
	assert.equal(JSON.stringify(facts?.payload).includes('Observed charge was 20 units in this setup.'), false, 'measurement must not be presented as a universal fact');
});
