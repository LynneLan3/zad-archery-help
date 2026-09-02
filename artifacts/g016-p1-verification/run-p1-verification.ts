import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildPrimitiveCandidates, resolveIntent, resolvePrimaryTask, resolvePrimitiveActivation } from '../../src/v4/intent-resolver';

const outDir = path.resolve('artifacts/g016-p1-verification');
const baselinePath = '/Users/lanling/Code/ai-work-rules/projects/game-search-opportunity-engine/goals/G016_V4_EVIDENCE_BASELINE_FROZEN.md';
const shapeForPrototype: Record<string, string> = { P1: 'entity', P2: 'catalog', P3: 'comparison', P4: 'procedure', P5: 'location', P6: 'progression', P7: 'mechanics', P8: 'recommendation', P9: 'tool', P10: 'planning' };

function save(name: string, value: unknown): void {

  writeFileSync(path.join(outDir, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

const precedence = [
  { id: 'A', input: { query: 'terraria bosses', playerProblem: 'choose one', primaryTask: 'choice-comparison' as const }, expectedBasis: 'primary-task' },
  { id: 'B', input: { query: 'diablo 4 build planner', playerProblem: 'operate a workspace' }, expectedBasis: 'query-semantics' },
  { id: 'C', input: { query: 'terraria', playerProblem: 'solve the current task', evidence: { answerShape: 'comparison' as const } }, expectedBasis: 'answer-shape' },
  { id: 'D', input: { query: 'unknown query', playerProblem: 'solve this', evidence: { gameType: 'calendar' } }, expectedBasis: 'game-prior' },
].map(({ id, input, expectedBasis }) => {
  const result = resolveIntent(input);
  return { id, input, resolvedPrimaryTask: result.primaryTask, resolvedPrototype: result.prototype, basis: result.resolution.basis, expectedBasis, match: result.resolution.basis === expectedBasis };
});
save('precedence-cases.json', precedence);

const prototypeInputs = [
  ['P1', { query: 'dream nail', playerProblem: 'look up an entity' }],
  ['P2', { query: 'minecraft mobs', playerProblem: 'browse a collection' }],
  ['P3', { query: 'bg3 classes', playerProblem: 'choose between options' }],
  ['P4', { query: 'ark taming', playerProblem: 'complete a procedure' }],
  ['P5', { query: 'ark resource map the island', playerProblem: 'find a place' }],
  ['P6', { query: 'ark bosses', playerProblem: 'follow progression', evidence: { answerShape: 'progression' as const } }],
  ['P7', { query: 'minecraft enchantments', playerProblem: 'understand a mechanic' }],
  ['P8', { query: 'best minecraft enchantments', playerProblem: 'choose the best option' }],
  ['P9', { query: 'diablo 4 build planner', playerProblem: 'operate a tool' }],
  ['P10', { query: 'stardew valley fall', playerProblem: 'plan around time' }],
] as const;
save('prototype-cases.json', prototypeInputs.map(([expectedPrototype, input]) => {
  const result = resolveIntent(input);
  return { fixture: input.query, input, expectedPrototype, resolvedPrimaryTask: result.primaryTask, actualPrototype: result.prototype, basis: result.resolution.basis, match: result.prototype === expectedPrototype };
}));

const baseline = readFileSync(baselinePath, 'utf8');
const winners = baseline.split('\n').filter((line) => /^\| \d+ \|/.test(line)).map((line) => {
  const fields = line.split('|').map((field) => field.trim());
  return { winnerId: Number(fields[1]), query: fields[3].replaceAll('`', ''), expectedPrototype: fields[4] };
});
const winnerResults = winners.map((winner) => {
  const winnerAnswerShapes: Record<string, 'catalog' | 'progression' | 'tool'> = { 'terraria bosses': 'catalog', 'ark bosses': 'progression', 'diablo 4 uniques': 'tool' };
  const evidence = winnerAnswerShapes[winner.query] ? { answerShape: winnerAnswerShapes[winner.query] } : undefined;
  const input = { query: winner.query, playerProblem: 'answer the query', ...(evidence ? { evidence } : {}) };
  const result = resolveIntent(input);
  return { ...winner, input, actualPrimaryTask: result.primaryTask, actualPrototype: result.prototype, basis: result.resolution.basis, match: result.prototype === winner.expectedPrototype };
});
save('winner-regression.json', { winnerCount: winnerResults.length, results: winnerResults, mismatchCount: winnerResults.filter((item) => !item.match).length });

const representative = ['P1', 'P3', 'P4', 'P5', 'P7', 'P9'] as const;
const representativeInputs = { P1: { query: 'dream nail', playerProblem: 'look up an entity' }, P3: { query: 'bg3 classes', playerProblem: 'choose between options' }, P4: { query: 'ark taming', playerProblem: 'complete a procedure' }, P5: { query: 'ark resource map the island', playerProblem: 'find a place' }, P7: { query: 'minecraft enchantments', playerProblem: 'understand a mechanic' }, P9: { query: 'diablo 4 build planner', playerProblem: 'operate a tool' } };
save('primitive-candidates.json', representative.map((prototype) => {
  const input = representativeInputs[prototype];
  const intent = resolveIntent(input);
  return { prototype, resolvedPrototype: intent.prototype, candidates: buildPrimitiveCandidates(input, intent.prototype) };
}));

const capabilityCases = [
  ['Map', 'P5', 'L02', 'unsupported'], ['Ranking', 'P3', 'D02', 'unsupported'], ['Calculator', 'P7', 'X04', 'unsupported'], ['Filter', 'P9', 'X01', 'unsupported'], ['Planner', 'P9', 'X05', 'unsupported'],
  ['Map available', 'P5', 'L02', 'available'], ['Ranking unresolved', 'P3', 'D02', 'unresolved'], ['Calculator available', 'P7', 'X04', 'available'], ['Filter available', 'P9', 'X01', 'available'], ['Planner unresolved', 'P9', 'X05', 'unresolved'],
] as const;
save('capability-activation.json', capabilityCases.map(([label, prototype, primitiveId, support]) => {
  const input = label === 'Filter available' ? { query: label, playerProblem: label, evidence: { filterFacets: ['class'] } } : { query: label, playerProblem: label };
  const decision = buildPrimitiveCandidates(input, prototype).find((item) => item.primitiveId === primitiveId)!;
  return { label, prototype, primitiveId, availableSupport: support, candidateStatus: decision.status, activationResult: resolvePrimitiveActivation(decision, support), reason: decision.reason };
}));

const taskProbe = resolvePrimaryTask({ query: 'unknown', playerProblem: 'solve this', secondaryTasks: ['planning'], evidence: { gameType: 'calendar' } });
save('ownership-probe.json', { input: { query: 'unknown', playerProblem: 'solve this', secondaryTasks: ['planning'], evidence: { gameType: 'calendar' } }, output: taskProbe, note: 'secondaryTasks is accepted by the input contract but is not used to assign final Prototype; final Prototype is derived from resolved primary task.' });
