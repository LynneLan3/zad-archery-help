import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createPageData, validatePrimitivePayload } from '../../src/v4/page-data-contract';
import { resolveIntent } from '../../src/v4/intent-resolver';
import { generateV4, type V4InputPage } from '../../scripts/v4/generate-v4';

const outDir = path.resolve('artifacts/g016-p2-verification');
const page = { id: 'p2-test', title: 'P2 Test', href: '/p2-test/' };
const intent = resolveIntent({ query: 'dream nail', playerProblem: 'look up the entity', primaryTask: 'entity-lookup' });
const save = (name: string, value: unknown) => writeFileSync(path.join(outDir, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const capture = (fn: () => unknown) => { try { return { ok: true, output: fn() }; } catch (error) { return { ok: false, error: String(error instanceof Error ? error.message : error) }; } };

save('page-data-entrypoint.json', { module: 'src/v4/page-data-contract.ts', function: 'createPageData', input: 'PageDataInput', output: 'PageData', callChain: ['site-input/v4-example/site.json', 'scripts/v4/generate-v4.ts::generateV4', 'resolveIntent', 'bindTaskMedia', 'createPageData', 'composePage'], generatorCallSite: 'scripts/v4/generate-v4.ts:99' });

const validPayloads: Record<string, unknown> = {
  A01: { title: 'Title', task: 'Task', subject: 'Subject' }, A02: { answer: 'Answer' }, A03: { scope: 'Scope' }, S01: { value: '0.9' }, S02: { value: 'PC' }, S03: { value: 'Summer' }, S04: { value: 'Current' },
  E01: { facts: [] }, E02: { entities: [] }, E03: { columns: [], rows: [] }, D01: { options: [], dimensions: [], cells: [] }, D02: { entries: [] }, D03: { scenarios: [] },
  P01: { requirements: [] }, P02: { steps: [] }, P03: { milestones: [] }, P04: { cases: [] }, L01: { area: 'Area' }, L02: { source: 'Map source' }, L03: { start: 'Start', waypoints: [], destination: 'End' },
  X01: { facets: [] }, X02: { columns: [], rows: [] }, X03: { expression: 'a + b', variables: [] }, X04: { inputs: [], calculation: 'a + b', result: { value: 2 } }, X05: { state: {}, controls: [] }, N01: { steps: [] },
};
save('primitive-payload-cases.json', Object.entries(validPayloads).map(([primitiveId, payload]) => ({ primitiveId, validPayload: payload, validationResult: capture(() => validatePrimitivePayload(primitiveId as never, payload)) })));

const malformed = { A02: {}, E03: { columns: 'wrong', rows: [] }, D01: { options: [], dimensions: [] }, P02: { steps: 'wrong' }, L02: { source: 4 }, X05: { state: [], controls: [] } };
const primitiveTasks: Record<string, 'entity-lookup' | 'collection-browse' | 'choice-comparison' | 'procedure' | 'location' | 'tool-database'> = { A02: 'entity-lookup', E03: 'collection-browse', D01: 'choice-comparison', P02: 'procedure', L02: 'location', X05: 'tool-database' };
save('malformed-payload-cases.json', Object.entries(malformed).map(([primitiveId, payload]) => ({ primitiveId, payload, validationResult: capture(() => validatePrimitivePayload(primitiveId as never, payload)), builderResult: capture(() => createPageData({ page, intent: resolveIntent({ query: primitiveId, playerProblem: primitiveId, primaryTask: primitiveTasks[primitiveId] }), primitiveData: [{ instanceId: `bad-${primitiveId}`, primitiveId: primitiveId as never, payload: payload as never, evidenceRefs: [], mediaRefs: [] }] })) })));

const duplicateInstances = capture(() => createPageData({ page, intent, evidence: [{ evidenceId: 'e1', sourceType: 'fixture', finding: 'shared' }], assets: [{ role: 'entity', path: '/entity.svg', alt: 'Entity', usable: true }], primitiveData: [
  { instanceId: 'facts-a', primitiveId: 'E01', payload: { facts: [{ label: 'Type', value: 'Item' }] }, evidenceRefs: ['e1'], mediaRefs: ['media-1'] },
  { instanceId: 'facts-b', primitiveId: 'E01', payload: { facts: [{ label: 'Use', value: 'Forge' }] }, evidenceRefs: ['e1'], mediaRefs: ['media-1'] },
] }));
save('multiple-instances.json', { input: { page, primitiveIds: ['E01', 'E01'], instanceIds: ['facts-a', 'facts-b'] }, output: duplicateInstances });

const registryInput = { page, intent, evidence: [{ evidenceId: 'shared-evidence', sourceType: 'fixture', finding: 'One registry fact' }], assets: [{ role: 'entity' as const, path: '/shared.svg', alt: 'Shared media', usable: true }], primitiveData: [
  { instanceId: 'one', primitiveId: 'E01' as const, payload: { facts: [] }, evidenceRefs: ['shared-evidence', 'missing-evidence'], mediaRefs: ['media-1', 'missing-media'] },
  { instanceId: 'two', primitiveId: 'E01' as const, payload: { facts: [] }, evidenceRefs: ['shared-evidence'], mediaRefs: ['media-1'] },
] };
save('evidence-registry-cases.json', { sharedAndDangling: capture(() => createPageData(registryInput)), duplicateEvidenceId: capture(() => createPageData({ ...registryInput, evidence: [{ evidenceId: 'shared-evidence', sourceType: 'a', finding: 'a' }, { evidenceId: 'shared-evidence', sourceType: 'b', finding: 'b' }] })) });

const mediaOutput = capture(() => createPageData({ ...registryInput, assets: [{ role: 'entity' as const, path: '/same.svg', alt: 'Same one', usable: true }, { role: 'entity' as const, path: '/same.svg', alt: 'Same two', usable: true }] }));
save('media-registry-cases.json', { duplicateSourcePathsProduceUniqueMediaIdentity: mediaOutput, expected: 'media identities are generated uniquely; dangling mediaRefs are filtered; multiple instances may share media-1' });

const activationCases = (support: 'available' | 'unresolved' | 'unsupported') => { const p5 = resolveIntent({ query: 'resource location', playerProblem: 'find a place', primaryTask: 'location' }); return createPageData({ page, intent: p5, primitiveSupport: { L02: support }, primitiveData: [{ instanceId: `map-${support}`, primitiveId: 'L02', payload: { source: 'map' }, evidenceRefs: [], mediaRefs: [] }] }); };
save('activation-serialization.json', ['available', 'unresolved', 'unsupported'].map((support) => ({ support, output: capture(() => activationCases(support as 'available' | 'unresolved' | 'unsupported')) })));

const missingOptional = capture(() => createPageData({ page, intent: resolveIntent({ query: 'resource location', playerProblem: 'find a place', primaryTask: 'location' }), primitiveSupport: { L02: 'unsupported' }, primitiveData: [{ instanceId: 'location', primitiveId: 'L01', payload: { area: 'Cinder Marsh' }, evidenceRefs: [], mediaRefs: [] }] }));
const missingRequired = capture(() => createPageData({ page: undefined as never, intent }));
save('missing-data-cases.json', { optionalPrimitiveUnsupported: missingOptional, requiredPageIdentityMissing: missingRequired });

const source = JSON.parse(readFileSync('site-input/v4-example/site.json', 'utf8')) as { pages: V4InputPage[] };
const generated = generateV4(source);
save('generator-page-samples.json', ['ember-core', 'forge-guide', 'armory-db'].map((id) => { const input = source.pages.find((item) => item.id === id)!; const output = generated.pages.find((item) => item.id === id)!; return { id, upstreamInput: { id: input.id, title: input.title, href: input.href, query: input.query, playerProblem: input.playerProblem, primaryTask: input.primaryTask, resolverEvidence: input.resolverEvidence }, pageData: output.pageData }; }));
