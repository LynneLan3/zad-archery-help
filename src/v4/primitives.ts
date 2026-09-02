import type { PageData, PrimitiveId } from './page-data-contract';

export const PRIMITIVE_DEFINITIONS = [
 {id:'A01',label:'Answer Header',interactive:false},{id:'A02',label:'Quick Answer',interactive:false},{id:'A03',label:'Task Context',interactive:false},
 {id:'S01',label:'Version State',interactive:false},{id:'S02',label:'Platform State',interactive:true},{id:'S03',label:'Season State',interactive:true},{id:'S04',label:'Data Freshness',interactive:false},
 {id:'E01',label:'Fact Card',interactive:false},{id:'E02',label:'Entity Grid',interactive:false},{id:'E03',label:'Entity Table',interactive:false},
 {id:'D01',label:'Comparison Table',interactive:false},{id:'D02',label:'Ranking List',interactive:false},{id:'D03',label:'Choice Matrix',interactive:false},
 {id:'P01',label:'Requirements',interactive:false},{id:'P02',label:'Step Sequence',interactive:false},{id:'P03',label:'Progress Sequence',interactive:false},{id:'P04',label:'Failure & Recovery',interactive:false},
 {id:'L01',label:'Location Fact',interactive:false},{id:'L02',label:'Map',interactive:true},{id:'L03',label:'Route Sequence',interactive:false},
 {id:'X01',label:'Filter',interactive:true},{id:'X02',label:'Sortable Data',interactive:true},{id:'X03',label:'Formula',interactive:false},{id:'X04',label:'Calculator',interactive:true},{id:'X05',label:'Workspace / Planner',interactive:true},
 {id:'N01',label:'Related Next Step',interactive:false},
] as const;
export type PrimitiveDefinition = (typeof PRIMITIVE_DEFINITIONS)[number];
export interface PrimitiveView { id: PrimitiveId; label: string; interactive: boolean; instanceId: string; payload: unknown; evidenceRefs: readonly string[]; mediaRefs: readonly string[]; /** WIP preview-only compatibility fields; PageData never emits these. */ behavior: string; data: readonly Record<string,string|number|boolean>[]; }
const definitions = new Map<PrimitiveId,PrimitiveDefinition>(PRIMITIVE_DEFINITIONS.map((x)=>[x.id,x]));
export function renderPrimitive(page: PageData, id: PrimitiveId, selectedInstance?: PageData['primitiveData'][number]): PrimitiveView|null {
 const decision=page.primitiveRecipe.find((x)=>x.primitiveId===id); if(!decision||decision.status!=='include') return null;
 const instance=selectedInstance ?? page.primitiveData.find((x)=>x.primitiveId===id); if(!instance||instance.primitiveId!==id) return null; const def=definitions.get(id); if(!def) return null;
 const payload=instance.payload as Record<string,unknown>; const rows=Array.isArray(payload.rows)?payload.rows:Array.isArray(payload.entries)?payload.entries:Array.isArray(payload.markers)?payload.markers:Array.isArray(payload.steps)?payload.steps:Array.isArray(payload.facts)?payload.facts:[];
 const legacy: Record<PrimitiveId,string>={A01:'answer-header',A02:'quick-answer',A03:'task-context',S01:'version-state',S02:'platform-state',S03:'season-state',S04:'data-freshness',E01:'entity-facts',E02:'entity-grid-or-table',E03:'data-table',D01:'comparison',D02:'ranking',D03:'choice-matrix',P01:'requirements',P02:'ordered-steps',P03:'progress-sequence',P04:'recovery',L01:'location-facts',L02:'map',L03:'route',X01:'filter',X02:'sortable-data',X03:'formula',X04:'calculator',X05:'workspace',N01:'related-next-step'};
 return {id,label:def.label,interactive:def.interactive,instanceId:instance.instanceId,payload,evidenceRefs:instance.evidenceRefs,mediaRefs:instance.mediaRefs,behavior:legacy[id],data:rows as readonly Record<string,string|number|boolean>[]};
}
export function renderIncludedPrimitives(page: PageData): readonly PrimitiveView[] { return page.primitiveData.filter((x)=>page.primitiveRecipe.some((d)=>d.primitiveId===x.primitiveId&&d.status==='include')).map((x)=>renderPrimitive(page,x.primitiveId,x)).filter((x):x is PrimitiveView=>x!==null); }
