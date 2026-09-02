/** V4 Resolver input/output boundary. Research supplies signals; V4 owns the final Prototype and Primitive activation decision. */
export const PROTOTYPES = ['P1','P2','P3','P4','P5','P6','P7','P8','P9','P10'] as const;
export type PrototypeId = (typeof PROTOTYPES)[number];
export const PLAYER_TASKS = ['entity-lookup','collection-browse','choice-comparison','procedure','location','progression','mechanics','recommendation','tool-database','planning'] as const;
export type PlayerTask = (typeof PLAYER_TASKS)[number];
export const PLAYER_TASK_LABELS: Readonly<Record<PlayerTask, string>> = {
	'entity-lookup': 'Item', 'collection-browse': 'Collection', 'choice-comparison': 'Comparison',
	'procedure': 'Guide', 'location': 'Location', 'progression': 'Progression', 'mechanics': 'Mechanics',
	'recommendation': 'Recommendation', 'tool-database': 'Tool', 'planning': 'Planning',
};
export type AnswerShape = 'entity'|'catalog'|'comparison'|'procedure'|'location'|'progression'|'mechanics'|'recommendation'|'tool'|'planning';
export type PrimitiveSupport = 'available'|'unresolved'|'unsupported';
export type PrimitiveStatus = 'include'|'conditional'|'omit';
export interface ResolverEvidence { answerShape?: AnswerShape; gameType?: string; rankingBasis?: PrimitiveSupport; mapData?: PrimitiveSupport; calculatorData?: PrimitiveSupport; filterFacets?: readonly string[]; serpSignals?: readonly string[]; }
export interface ResolverInput { query: string; playerProblem: string; primaryTask?: PlayerTask; secondaryTasks?: readonly PlayerTask[]; priority?: number; evidence?: ResolverEvidence; }
export interface PrimitiveDecision { primitiveId: string; status: PrimitiveStatus; reason: string; }
export interface ResolvedPageIntent { query: string; playerProblem: string; primaryTask: PlayerTask; prototype: PrototypeId; priority: number; primitiveRecipe: readonly PrimitiveDecision[]; resolution: { basis: 'primary-task'|'query-semantics'|'answer-shape'|'game-prior'; confidence: 'high'|'medium'|'low' }; }
