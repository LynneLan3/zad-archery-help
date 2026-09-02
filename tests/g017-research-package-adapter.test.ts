import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { adaptResearchPackage, type ResearchPackageInput } from '../src/g017/research-package-adapter';
import { resolveIntent } from '../src/v4/intent-resolver';
import type { ResolverInput } from '../src/v4/intent-contract';

const fixture = (name: string) => JSON.parse(fs.readFileSync(`site-input/research/${name}`, 'utf8')) as ResearchPackageInput;

test('G017 P1 maps a Research Package to the frozen ResolverInput without resolving it', () => {
	const output = adaptResearchPackage(fixture('g017-p1-artificial-emberfall.json'));
	assert.deepEqual(output.resolverInput, {
		query: 'artificial emberfall ember core',
		playerProblem: 'find the Ember Core requirements and where to get it',
		primaryTask: 'entity-lookup',
		secondaryTasks: ['location'],
		priority: 1,
		evidence: { serpSignals: ['Search results indicate players seek the item\'s location.'] },
	});
	assert.equal('prototype' in output.resolverInput, false);
	assert.equal('primitiveRecipe' in output.resolverInput, false);
	assert.equal('recommendation' in output.resolverInput, false);
	assert.equal(resolveIntent(output.resolverInput).prototype, 'P1');
});

test('G017 P1 preserves evidence identity, freshness, and asset intent/candidate links', () => {
	const output = adaptResearchPackage(fixture('g017-p1-artificial-emberfall.json'));
	assert.deepEqual(output.normalizedResearch.evidence.map((entry) => entry.evidenceId), ['serp-ember-core', 'evidence-ember-core']);
	assert.equal(output.normalizedResearch.evidence[1]?.lastVerified, '2026-08-30T00:00:00Z');
	assert.deepEqual(output.normalizedResearch.freshness, { version: 'fixture-1', platform: 'PC', dataWindow: '2026-08-30' });
	assert.deepEqual(output.normalizedResearch.assetIntents[0]?.evidence_refs, ['evidence-ember-core']);
	assert.deepEqual(output.normalizedResearch.assetCandidates[0]?.evidenceRefs, ['evidence-ember-core']);
	assert.equal(output.pageDataInput.assets?.[0]?.role, 'entity');
});

test('G017 P1 normalizes absent optional data without blocking ResolverInput', () => {
	const output = adaptResearchPackage(fixture('g017-p1-missing-optional.json'));
	assert.deepEqual(output.resolverInput, { query: 'artificial emberfall ember rule', playerProblem: 'understand the Ember rule' });
	assert.deepEqual(output.normalizedResearch.secondaryTaskSignals, []);
	assert.deepEqual(output.normalizedResearch.evidence, []);
	assert.deepEqual(output.normalizedResearch.freshness, {});
	assert.deepEqual(output.pageDataInput.assets, []);
	assert.equal(resolveIntent(output.resolverInput).query, output.resolverInput.query);
});

test('G017 P1 rejects missing required fields clearly', () => {
	assert.throws(() => adaptResearchPackage({ ...fixture('g017-p1-missing-optional.json'), query: '' }), /query is required/);
	assert.throws(() => adaptResearchPackage({ ...fixture('g017-p1-missing-optional.json'), page: { id: '' } }), /page\.id is required/);
});

test('adapter output resolverInput is assignable to the frozen contract', () => {
	const output = adaptResearchPackage(fixture('g017-p1-artificial-emberfall.json'));
	const input: ResolverInput = output.resolverInput;
	assert.equal(typeof input.query, 'string');
	assert.equal(typeof input.playerProblem, 'string');
});
