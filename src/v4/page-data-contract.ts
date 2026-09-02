import type { PrimitiveDecision, PrimitiveSupport, ResolvedPageIntent } from './intent-contract';

export interface PageFact { id: string; label: string; value: string; verified: boolean; }
export interface PageFaq { id: string; question: string; answer: string; }
export interface PageBodySection { id: string; title: string; paragraphs: readonly string[]; bullets: readonly string[]; }
export interface PageBody { intro?: string; sections: readonly PageBodySection[]; faq: readonly PageFaq[]; }
export interface EvidenceEntry { evidenceId: string; sourceType: string; sourceRef?: string; finding: string; supportRole?: string; freshness?: string; applicability?: string; }
/** Input-only compatibility shape for the previous WIP fixture. */
export interface PageEvidence { evidenceId?: string; sourceType?: string; sourceRef?: string; finding?: string; label?: string; url?: string; quote?: string; lastVerified?: string; }
export interface PageFreshness { version?: string; platform?: string; season?: string; dataWindow?: string; }
export interface MediaEntry { mediaId: string; role: 'hero'|'entity'|'map'|'step'|'evidence'|'decorative'; source?: string; localRef?: string; alt: string; caption?: string; provenance?: string; width?: number; height?: number; type?: string; }
export interface PageAssetCandidate { mediaId?: string; role: MediaEntry['role']; path?: string; alt: string; usable: boolean; caption?: string; provenance?: string; width?: number; height?: number; type?: string; evidenceRefs?: readonly string[]; }

export interface AnswerHeaderPayload { title?: string; task?: string; subject?: string; state?: string; }
export interface QuickAnswerPayload { answer: string; qualifier?: string; nextAction?: string; }
export interface TaskContextPayload { scope: string; conditions?: readonly string[]; caveat?: string; }
export interface StatePayload { label?: string; value: string; applicability?: string; options?: readonly string[]; currentDay?: string; events?: readonly { date: string; title: string; detail?: string; availability?: string; economics?: string; current?: boolean; deadline?: boolean }[]; }
export interface FactCardPayload { facts: readonly { label: string; value: string; state?: string }[]; }
export interface EntityGridPayload { group?: string; entities: readonly { id: string; name: string; href?: string; imageRef?: string; summary?: string; meta?: string }[]; }
export interface EntityTablePayload { columns: readonly { id: string; label: string }[]; rows: readonly Record<string, string|number|boolean>[]; notes?: readonly string[]; }
export interface ComparisonTablePayload { options: readonly { id: string; label: string }[]; dimensions: readonly { id: string; label: string }[]; cells: readonly { optionId: string; dimensionId: string; value: string; note?: string }[]; recommendation?: { optionId: string; reason: string }; }
export interface RankingListPayload { entries: readonly { rank: number; choice: string; reason: string; state?: string }[]; methodology?: string; }
export interface ChoiceMatrixPayload { scenarios: readonly { condition: string; choice: string; reason: string }[]; }
export interface RequirementsPayload { requirements: readonly { id: string; label: string; status?: string; howToMeet?: string }[]; }
export interface StepSequencePayload { steps: readonly { id: string; order: number; action: string; result?: string; evidenceRefs?: readonly string[] }[]; }
export interface ProgressSequencePayload { milestones: readonly { id: string; label: string; status?: string; next?: string }[]; }
export interface FailureRecoveryPayload { cases: readonly { symptom: string; cause?: string; recovery: string }[]; }
export interface LocationFactPayload { area?: string; coordinates?: { x: number; y: number; region?: string }; landmark?: string; access?: string; }
export interface MapPayload { source: string; markers?: readonly { id: string; label: string; x: number; y: number; locationRef?: string }[]; layers?: readonly { id: string; label: string; enabled?: boolean }[]; }
export interface RouteSequencePayload { start: string; waypoints: readonly { id: string; label: string; instruction?: string }[]; destination: string; }
export interface FilterPayload { facets: readonly { id: string; label: string; values: readonly string[] }[]; selected?: Readonly<Record<string,string>>; resultCount?: number; }
export interface SortableDataPayload { columns: readonly { id: string; label: string }[]; rows: readonly Record<string,string|number|boolean>[]; sort?: { column: string; direction: 'asc'|'desc' }; }
export interface FormulaPayload { expression: string; variables: readonly { name: string; meaning: string; unit?: string }[]; workedExample?: { inputs: Readonly<Record<string,string|number>>; result: string }; }
export interface CalculatorPayload { inputs: readonly { id: string; label: string; unit?: string; value?: number|string }[]; calculation: string; result: { value: string|number; interpretation?: string }; }
export interface WorkspacePayload { state: Record<string,string|number|boolean>; controls: readonly { id: string; label: string; type: string }[]; data?: readonly Record<string,string|number|boolean>[]; result?: string; saveShare?: { saved?: boolean; shareRef?: string }; }
export interface RelatedNextStepPayload { steps: readonly { href: string; label: string; reason: string }[]; }

export type PrimitivePayload =
 | { primitiveId:'A01'; payload:AnswerHeaderPayload } | { primitiveId:'A02'; payload:QuickAnswerPayload } | { primitiveId:'A03'; payload:TaskContextPayload }
 | { primitiveId:'S01'|'S02'|'S03'|'S04'; payload:StatePayload }
 | { primitiveId:'E01'; payload:FactCardPayload } | { primitiveId:'E02'; payload:EntityGridPayload } | { primitiveId:'E03'; payload:EntityTablePayload }
 | { primitiveId:'D01'; payload:ComparisonTablePayload } | { primitiveId:'D02'; payload:RankingListPayload } | { primitiveId:'D03'; payload:ChoiceMatrixPayload }
 | { primitiveId:'P01'; payload:RequirementsPayload } | { primitiveId:'P02'; payload:StepSequencePayload } | { primitiveId:'P03'; payload:ProgressSequencePayload } | { primitiveId:'P04'; payload:FailureRecoveryPayload }
 | { primitiveId:'L01'; payload:LocationFactPayload } | { primitiveId:'L02'; payload:MapPayload } | { primitiveId:'L03'; payload:RouteSequencePayload }
 | { primitiveId:'X01'; payload:FilterPayload } | { primitiveId:'X02'; payload:SortableDataPayload } | { primitiveId:'X03'; payload:FormulaPayload } | { primitiveId:'X04'; payload:CalculatorPayload } | { primitiveId:'X05'; payload:WorkspacePayload }
 | { primitiveId:'N01'; payload:RelatedNextStepPayload };
export type PrimitiveId = PrimitivePayload['primitiveId'];
export const PRIMITIVE_PAYLOAD_REQUIRED_FIELDS: Readonly<Record<PrimitiveId, readonly string[]>> = {
 A01:['title','task','subject'],A02:['answer'],A03:['scope'],S01:['value'],S02:['value'],S03:['value'],S04:['value'],
 E01:['facts'],E02:['entities'],E03:['columns','rows'],D01:['options','dimensions','cells'],D02:['entries'],D03:['scenarios'],
 P01:['requirements'],P02:['steps'],P03:['milestones'],P04:['cases'],L01:['area'],L02:['source'],L03:['start','waypoints','destination'],
 X01:['facets'],X02:['columns','rows'],X03:['expression','variables'],X04:['inputs','calculation','result'],X05:['state','controls'],N01:['steps'],
};
export interface PrimitiveInstance { instanceId: string; primitiveId: PrimitiveId; payload: PrimitivePayload['payload']; evidenceRefs: readonly string[]; mediaRefs: readonly string[]; }
export interface LegacyPrimitivePayload { behavior: string; data: readonly Record<string,string|number|boolean>[]; instanceId?: string; evidenceRefs?: readonly string[]; mediaRefs?: readonly string[]; }

export interface PageIdentity { id: string; title: string; href: string; }
export interface PageDataInput { intent: ResolvedPageIntent; page: PageIdentity; body?: PageBody; facts?: readonly PageFact[]; evidence?: readonly PageEvidence[]; freshness?: PageFreshness; assets?: readonly PageAssetCandidate[]; primitiveData?: readonly (PrimitiveInstance|LegacyPrimitivePayload)[]; primitiveSupport?: Readonly<Record<string,PrimitiveSupport>>; }
export interface PageData { pageDataVersion: 'v4'; page: PageIdentity & { query: string; playerProblem: string }; state: PageFreshness; intent: ResolvedPageIntent; body: PageBody; facts: readonly PageFact[]; evidence: readonly EvidenceEntry[]; media: readonly MediaEntry[]; freshness?: PageFreshness; assets: readonly PageAssetCandidate[]; primitiveData: readonly PrimitiveInstance[]; primitiveRecipe: readonly PrimitiveDecision[]; }

const LEGACY_TO_ID: Record<string, PrimitiveId> = {'answer-header':'A01','entity-facts':'E01','entity-grid-or-table':'E02','ranking':'D02','comparison':'D01','requirements':'P01','ordered-steps':'P02','recovery':'P04','location-facts':'L01','map':'L02','route':'L03','progress-sequence':'P03','version-state':'S01','platform-state':'S02','season-state':'S03','data-freshness':'S04','rule-constraints':'A03','search':'X02','formula':'X03','calculator':'X04','filter':'X01','data-table':'E03','workspace':'X05','calendar':'S03','availability':'S03','economics':'D03'};
function legacyPayload(id: PrimitiveId, data: readonly Record<string,string|number|boolean>[]): PrimitivePayload['payload'] {
	const text = (key: string, fallback='') => String(data[0]?.[key] ?? data[0]?.value ?? fallback);
	switch(id) {
		case 'A01': return {title:text('title'),task:text('task'),subject:text('subject')}; case 'A02': return {answer:text('answer','')}; case 'A03': return {scope:text('scope',text('value'))};
		case 'E01': return {facts:data.map((x)=>({label:String(x.label??''),value:String(x.value??''),state:x.state?String(x.state):undefined}))}; case 'E02': return {entities:data.map((x,i)=>({id:String(x.id??i),name:String(x.name??x.value??'')}))}; case 'E03': return {columns:Object.keys(data[0]??{}).map((id)=>({id,label:id})),rows:data};
		case 'D01': return {options:[],dimensions:[],cells:[],recommendation:undefined}; case 'D02': return {entries:data.map((x,i)=>({rank:Number(x.rank??i+1),choice:String(x.choice??x.value??''),reason:String(x.reason??'')}))}; case 'D03': return {scenarios:data.map(x=>({condition:String(x.condition??''),choice:String(x.choice??x.value??''),reason:String(x.reason??'')}))};
		case 'P01': return {requirements:data.map((x,i)=>({id:String(x.id??i),label:String(x.label??x.value??'')}))}; case 'P02': return {steps:data.map((x,i)=>({id:String(x.id??i),order:Number(x.order??x.step??i+1),action:String(x.action??x.value??'')}))}; case 'P03': return {milestones:data.map((x,i)=>({id:String(x.id??i),label:String(x.label??x.value??''),status:x.status?String(x.status):undefined}))}; case 'P04': return {cases:data.map(x=>({symptom:String(x.symptom??''),recovery:String(x.recovery??x.value??'')}))};
		case 'L01': return {area:text('area',text('value')),landmark:data[0]?.landmark?String(data[0].landmark):undefined,access:data[0]?.access?String(data[0].access):undefined}; case 'L02': return {source:text('source','fixture'),markers:data.map((x,i)=>({id:String(x.id??i),label:String(x.label??x.value??''),x:Number(x.x??0),y:Number(x.y??0)}))}; case 'L03': return {start:text('start'),waypoints:[],destination:text('destination')};
		case 'X01': return {facets:data.map((x,i)=>({id:String(x.id??i),label:String(x.facet??x.label??''),values:[String(x.value??'')]}))}; case 'X02': return {columns:Object.keys(data[0]??{}).map((id)=>({id,label:id})),rows:data}; case 'X03': return {expression:text('expression',text('value')),variables:[]}; case 'X04': return {inputs:[],calculation:text('calculation'),result:{value:String(data[0]?.result??'')}}; case 'X05': return {state:{},controls:[],data}; case 'N01': return {steps:[]};
		case 'S01': case 'S02': case 'S03': case 'S04': return {value:text('value')};
	}
}
const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
export function validatePrimitivePayload(primitiveId: PrimitiveId, payload: unknown): void {
	if (!isObject(payload)) throw new Error(`Invalid ${primitiveId} payload: expected object`);
	for (const field of PRIMITIVE_PAYLOAD_REQUIRED_FIELDS[primitiveId]) if (!(field in payload)) throw new Error(`Invalid ${primitiveId} payload: missing ${field}`);
	const arrays: Partial<Record<PrimitiveId, readonly string[]>> = { E01:['facts'], E02:['entities'], E03:['columns','rows'], D01:['options','dimensions','cells'], D02:['entries'], D03:['scenarios'], P01:['requirements'], P02:['steps'], P03:['milestones'], P04:['cases'], L03:['waypoints'], X01:['facets'], X02:['columns','rows'], X03:['variables'], X04:['inputs'], X05:['controls'], N01:['steps'] };
	for (const field of arrays[primitiveId] ?? []) if (!Array.isArray(payload[field])) throw new Error(`Invalid ${primitiveId} payload: ${field} must be an array`);
	const strings: Partial<Record<PrimitiveId, readonly string[]>> = { A01:['title','task','subject'], A02:['answer'], A03:['scope'], S01:['value'], S02:['value'], S03:['value'], S04:['value'], L01:['area'], L02:['source'], L03:['start','destination'], X03:['expression'], X04:['calculation'] };
	for (const field of strings[primitiveId] ?? []) if (!isNonEmptyString(payload[field])) throw new Error(`Invalid ${primitiveId} payload: ${field} must be a string`);
	if (primitiveId === 'X04' && !isObject(payload.result)) throw new Error('Invalid X04 payload: result must be an object');
	if (primitiveId === 'X05' && !isObject(payload.state)) throw new Error('Invalid X05 payload: state must be an object');
}
function registryEvidence(items: readonly PageEvidence[]): EvidenceEntry[] { return items.map((x,i)=>({evidenceId:x.evidenceId??`evidence-${i+1}`,sourceType:x.sourceType??'unspecified',sourceRef:x.sourceRef??x.url,finding:x.finding??x.quote??x.label??'',freshness:x.lastVerified})); }
function registryMedia(items: readonly PageAssetCandidate[]): MediaEntry[] { return items.filter(x=>x.usable).map((x,i)=>({mediaId:x.mediaId ?? `media-${i+1}`,role:x.role,source:x.path,localRef:x.path,alt:x.alt,caption:x.caption,provenance:x.provenance,width:x.width,height:x.height,type:x.type})); }
function normalizeDisplayValue(value: unknown): unknown {
	if (typeof value === 'string') return value.replace(/[\uFFFD]/g, '').replace(/[·•—–−]/g, ' - ').replace(/[↗→]/g, '->').replace(/[×]/g, 'x').replace(/[\u2028\u2029]/g, ' ');
	if (Array.isArray(value)) return value.map(normalizeDisplayValue);
	if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeDisplayValue(item)]));
	return value;
}
export function createPageData(input: PageDataInput): PageData {
	if (!input.page || !isNonEmptyString(input.page.id) || !isNonEmptyString(input.page.title) || !isNonEmptyString(input.page.href)) throw new Error('Page Data requires page id, title, and href');
	const support=input.primitiveSupport??{};
	const primitiveRecipe=input.intent.primitiveRecipe.map((d)=>({...d,status:d.status==='conditional' ? (support[d.primitiveId]??'unsupported')==='available'?'include':'omit' : d.status}));
	const included=new Set(primitiveRecipe.filter(d=>d.status==='include').map(d=>d.primitiveId));
	const evidence=registryEvidence(input.evidence??[]); const evidenceIdsSeen=new Set<string>(); for (const entry of evidence) { if (evidenceIdsSeen.has(entry.evidenceId)) throw new Error(`Duplicate evidenceId: ${entry.evidenceId}`); evidenceIdsSeen.add(entry.evidenceId); } const media=registryMedia(input.assets??[]);
	const evidenceIds=new Set(evidence.map((x)=>x.evidenceId)); const mediaIds=new Set(media.map((x)=>x.mediaId));
	const instanceIds=new Set<string>(); const instances=(input.primitiveData??[]).flatMap((raw,i)=>{ const old='behavior' in raw; const id=(old?LEGACY_TO_ID[raw.behavior]:raw.primitiveId) as PrimitiveId|undefined; if(!id||!included.has(id)) return []; const instanceId=raw.instanceId??`${id}-${i+1}`; if(instanceIds.has(instanceId)) throw new Error(`Duplicate instanceId: ${instanceId}`); instanceIds.add(instanceId); const p=old?legacyPayload(id,raw.data):raw.payload; validatePrimitivePayload(id,p); return [{instanceId,primitiveId:id,payload:normalizeDisplayValue(p) as PrimitivePayload['payload'],evidenceRefs:(raw.evidenceRefs??[]).filter((x)=>evidenceIds.has(x)),mediaRefs:(raw.mediaRefs??[]).filter((x)=>mediaIds.has(x))} as PrimitiveInstance]; });
	return {pageDataVersion:'v4',page:{...input.page,query:input.intent.query,playerProblem:input.intent.playerProblem},state:input.freshness??{},intent:input.intent,body:input.body??{sections:[],faq:[]},facts:input.facts??[],evidence,media,freshness:input.freshness,assets:(input.assets??[]).filter(x=>x.usable),primitiveData:instances,primitiveRecipe};
}
export function includedPrimitiveBehaviors(page: PageData): readonly string[] { return page.primitiveRecipe.filter((d): d is PrimitiveDecision & {status:'include'}=>d.status==='include').map(d=>d.primitiveId); }
