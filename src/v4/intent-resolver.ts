import type { AnswerShape, PlayerTask, PrimitiveDecision, PrimitiveSupport, PrototypeId, ResolverInput, ResolvedPageIntent } from './intent-contract';

export const TASK_TO_PROTOTYPE: Readonly<Record<PlayerTask, PrototypeId>> = {
	'entity-lookup':'P1','collection-browse':'P2','choice-comparison':'P3','procedure':'P4','location':'P5','progression':'P6','mechanics':'P7','recommendation':'P8','tool-database':'P9','planning':'P10',
};
const ANSWER_SHAPE_TO_TASK: Record<AnswerShape, PlayerTask> = { entity:'entity-lookup',catalog:'collection-browse',comparison:'choice-comparison',procedure:'procedure',location:'location',progression:'progression',mechanics:'mechanics',recommendation:'recommendation',tool:'tool-database',planning:'planning' };
const QUERY_SEMANTICS: Array<{ pattern: RegExp; task: PlayerTask }> = [
		{pattern:/\b(build planner|planner|database|loadouts?)\b/i,task:'tool-database'}, {pattern:/\b(hardmode guide)\b/i,task:'progression'}, {pattern:/\b(fluids guide)\b/i,task:'mechanics'}, {pattern:/\b(calendar|fall|winter|availability)\b/i,task:'planning'}, {pattern:/\b(best|god rolls?|builds?|recommend|tier list)\b/i,task:'recommendation'}, {pattern:/\b(map|location|where|resource map|forge)\b/i,task:'location'}, {pattern:/\b(how to|guide|taming|crafting|dedicated server|blueprints?)\b/i,task:'procedure'}, {pattern:/\b(quests?|farming|hardmode|walkthrough)\b/i,task:'progression'}, {pattern:/\b(compare|classes?|ascendancy|choice|versus|vs\.?)\b/i,task:'choice-comparison'}, {pattern:/\b(mechanics?|enchantments?|currency|skill gems?|power|fluids?|throughput|shimmer)\b/i,task:'mechanics'}, {pattern:/\b(companions?|weapons?|charms?|mobs?|npcs?|creatures?|wings?)\b/i,task:'collection-browse'},
];
const taskFromText = (text: string) => QUERY_SEMANTICS.find(({pattern}) => pattern.test(text))?.task;

/** Stage 1: explicit player task > query semantics > answer shape > game-context prior. */
export function resolvePrimaryTask(input: ResolverInput): { task: PlayerTask; basis: ResolvedPageIntent['resolution']['basis']; confidence: ResolvedPageIntent['resolution']['confidence'] } {
	if (input.primaryTask) return {task:input.primaryTask,basis:'primary-task',confidence:'high'};
	const queryTask = taskFromText(input.query);
	if (queryTask) return {task:queryTask,basis:'query-semantics',confidence:'medium'};
	const answerTask = input.evidence?.answerShape ? ANSWER_SHAPE_TO_TASK[input.evidence.answerShape] : undefined;
	if (answerTask) return {task:answerTask,basis:'answer-shape',confidence:'low'};
	const prior = taskFromText(`${input.playerProblem} ${input.evidence?.gameType ?? ''} ${(input.evidence?.serpSignals ?? []).join(' ')}`);
	return {task:prior ?? 'entity-lookup',basis:'game-prior',confidence:'low'};
}

/** Stage 2: taxonomy mapping is separate and directly testable. */
export function resolvePrimaryPrototype(task: PlayerTask): PrototypeId { return TASK_TO_PROTOTYPE[task]; }

function activation(support: PrimitiveSupport | undefined): PrimitiveDecision['status'] { return support === 'available' ? 'include' : support === 'unsupported' ? 'omit' : 'conditional'; }
function add(list: PrimitiveDecision[], primitiveId: string, reason: string, support?: PrimitiveSupport): void { list.push({primitiveId,status:activation(support),reason}); }

/** Stage 3: candidate pool for the selected Prototype; no generic Article sections. */
export function buildPrimitiveCandidates(input: ResolverInput, prototype: PrototypeId): readonly PrimitiveDecision[] {
	const e = input.evidence ?? {}; const list: PrimitiveDecision[] = [{primitiveId:'A01',status:'include',reason:'Every answer surface identifies its task.'}];
	switch (prototype) {
		case 'P1': add(list,'A02','Entity lookup needs a direct answer.','available'); add(list,'E01','Entity facts use structured facts.','available'); add(list,'N01','A related next task continues the lookup.','available'); break;
		case 'P2': add(list,'E02','Collection browse needs a scannable entity set.','available'); add(list,'E03','A table is a candidate when structured rows exist.','unresolved'); add(list,'X01','Filter needs task-reducing facets',e.filterFacets?.length?'available':'unsupported'); add(list,'X02','Sort needs an ordered dataset.','unresolved'); break;
		case 'P3': add(list,'S02','Choice can depend on platform state.','available'); add(list,'D01','Choice needs alternatives and dimensions.','available'); add(list,'D02','Ranking needs a credible current basis.',e.rankingBasis); add(list,'D03','Choice conditions explain selection.','available'); break;
		case 'P4': add(list,'P01','Requirements need real prerequisites.','unresolved'); add(list,'P02','Procedure answers are ordered actions.','available'); add(list,'P04','Recovery needs real failure states.','unresolved'); add(list,'N01','A next task continues the procedure.','available'); break;
		case 'P5': add(list,'L01','Spatial intent can be answered with location facts.','available'); add(list,'L02','Map needs reliable spatial data.',e.mapData); add(list,'L03','Route needs reliable route data.',e.mapData === 'available'?'available':'unsupported'); break;
		case 'P6': add(list,'P03','Progression needs milestones and state.','available'); add(list,'P02','Stages may contain actionable steps.','unresolved'); add(list,'P04','Recovery needs real failure states.','unresolved'); add(list,'N01','A next task continues the route.','available'); break;
		case 'P7': add(list,'A03','Mechanics need scope and conditions.','available'); add(list,'X03','Formula needs an explicit relationship.',e.calculatorData === 'available'?'available':'unsupported'); add(list,'X04','Calculator needs meaningful variables and decision value.',e.calculatorData); break;
		case 'P8': add(list,'S01','Applicability may depend on version.','unresolved'); add(list,'S03','Recommendation may depend on season.','unresolved'); add(list,'S04','Freshness qualifies current advice.','unresolved'); add(list,'D02','Ranking needs a credible current basis.',e.rankingBasis); add(list,'D01','Comparison explains option tradeoffs.','unresolved'); break;
		case 'P9': add(list,'X01','Filter needs useful facets.',e.filterFacets?.length?'available':'unsupported'); add(list,'X02','Sortable data needs a dataset.','unresolved'); add(list,'X05','Workspace needs a real planning task.','unresolved'); add(list,'E03','A tool needs structured result rows.','available'); break;
		case 'P10': add(list,'S03','Planning needs a season/time state.','available'); add(list,'S04','Freshness qualifies time-sensitive data.','unresolved'); add(list,'N01','Next steps help continue the plan.','unresolved'); break;
	}
	return list;
}

/** Stage 4: activation can be tested without invoking task/prototype inference. */
export function resolvePrimitiveActivation(decision: PrimitiveDecision, support: PrimitiveSupport | undefined): PrimitiveDecision['status'] {
	if (decision.status === 'omit') return 'omit';
	return support === 'available' ? 'include' : support === 'unsupported' ? 'omit' : 'conditional';
}

export function resolveIntent(input: ResolverInput): ResolvedPageIntent {
	const task = resolvePrimaryTask(input); const prototype = resolvePrimaryPrototype(task.task);
	return {query:input.query,playerProblem:input.playerProblem,primaryTask:task.task,prototype,priority:input.priority??0,primitiveRecipe:buildPrimitiveCandidates(input,prototype),resolution:{basis:task.basis,confidence:task.confidence}};
}
