import type { PlayerTask, ResolverEvidence, ResolverInput } from '../v4/intent-contract';
import type { PageAssetCandidate, PageDataInput, PageEvidence, PageFact, PageFreshness } from '../v4/page-data-contract';
import { normalizePagePackage, type ApimartPagePackage } from '../v4/page-package';

export const RESEARCH_PACKAGE_SCHEMA = 'hotword-research-package-v1' as const;

export interface ResearchTaskSignal {
	task?: string;
	label?: string;
	evidence_refs?: readonly string[];
	confidence?: string;
}

export interface ResearchFact {
	fact_id: string;
	claim: string;
	value: string;
	certainty?: 'VERIFIED' | 'PARTIAL' | 'UNCONFIRMED';
	evidence_refs?: readonly string[];
	observed_at?: string | null;
	caveat?: string | null;
}

export interface ResearchEvidence {
	evidence_id: string;
	source_type: string;
	source_ref?: string;
	query_or_topic?: string;
	summary: string;
	claim_relation?: string;
	captured_at?: string | null;
	freshness?: string | null;
	limitations?: string | null;
}

export interface ResearchFreshness {
	version?: string;
	platform?: string;
	season?: string;
	data_window?: string;
	policy?: string;
}

export interface ResearchAssetCandidate {
	asset_id: string;
	role_hint?: string;
	path?: string;
	alt: string;
	usable?: boolean;
	caption?: string;
	provenance?: string;
	width?: number;
	height?: number;
	type?: string;
	evidence_refs?: readonly string[];
}

export interface ResearchAssetIntent {
	asset_id: string;
	purpose: string;
	role_hint?: string;
	target_page_id?: string;
	evidence_refs?: readonly string[];
}

/** P1 input shape. It is deliberately semantic and does not add V4 vocabulary. */
export interface ResearchPackageInput {
	schema_version?: typeof RESEARCH_PACKAGE_SCHEMA;
	package_type?: 'INITIAL' | 'PATCH';
	research_package_id?: string;
	target: { game_name: string; canonical_game_id?: string | null; canonical_site_id?: string | null };
	page: { id: string; title?: string; href?: string; topic?: string };
	query: string;
	player_problem: string;
	primary_task_signals?: readonly ResearchTaskSignal[];
	secondary_task_signals?: readonly ResearchTaskSignal[];
	game_facts?: readonly ResearchFact[];
	search_evidence?: readonly ResearchEvidence[];
	evidence?: readonly ResearchEvidence[];
	priority?: number;
	freshness?: ResearchFreshness | null;
	asset_intent?: readonly ResearchAssetIntent[];
	asset_candidates?: readonly ResearchAssetCandidate[];
	page_package?: ApimartPagePackage;
}

export interface NormalizedResearchData {
	page: ResearchPackageInput['page'];
	query: string;
	playerProblem: string;
	primaryTaskSignals: readonly ResearchTaskSignal[];
	secondaryTaskSignals: readonly ResearchTaskSignal[];
	facts: readonly PageFact[];
	evidence: readonly PageEvidence[];
	evidenceRecords: readonly ResearchEvidence[];
	freshness: PageFreshness;
	assetIntents: readonly ResearchAssetIntent[];
	assetCandidates: readonly (ResearchAssetCandidate & { role: string; evidenceRefs: readonly string[] })[];
}

export interface ResearchPackageAdapterOutput {
	resolverInput: ResolverInput;
	normalizedResearch: NormalizedResearchData;
	/** Input fields consumed after the Resolver creates PageData.intent. */
	pageDataInput: Omit<PageDataInput, 'intent'>;
}

const TASKS = new Set<PlayerTask>(['entity-lookup', 'collection-browse', 'choice-comparison', 'procedure', 'location', 'progression', 'mechanics', 'recommendation', 'tool-database', 'planning']);
const MEDIA_ROLES = new Set(['hero', 'entity', 'map', 'step', 'evidence', 'decorative']);

function requiredString(value: unknown, field: string): string {
	if (typeof value !== 'string' || value.trim() === '') throw new Error(`Research Package invalid: ${field} is required`);
	return value.trim();
}

function taskFromSignal(signal: ResearchTaskSignal | undefined): PlayerTask | undefined {
	return signal?.task && TASKS.has(signal.task as PlayerTask) ? signal.task as PlayerTask : undefined;
}

function mediaRole(roleHint: string | undefined): PageAssetCandidate['role'] {
	if (roleHint && MEDIA_ROLES.has(roleHint)) return roleHint as PageAssetCandidate['role'];
	if (roleHint === 'map') return 'map';
	if (roleHint === 'entity') return 'entity';
	if (roleHint === 'step') return 'step';
	if (roleHint === 'hero') return 'hero';
	return roleHint === 'none' ? 'decorative' : 'evidence';
}

function toEvidence(input: ResearchEvidence): PageEvidence {
	return { evidenceId: input.evidence_id, sourceType: input.source_type, sourceRef: input.source_ref, finding: input.summary, lastVerified: input.captured_at ?? input.freshness ?? undefined };
}

function toFact(input: ResearchFact): PageFact {
	return { id: input.fact_id, label: input.claim, value: input.value, verified: input.certainty === 'VERIFIED' };
}

export function adaptResearchPackage(input: ResearchPackageInput): ResearchPackageAdapterOutput {
	const query = requiredString(input.query, 'query');
	const playerProblem = requiredString(input.player_problem, 'player_problem');
	const pageId = requiredString(input.page?.id, 'page.id');
	const pageTitle = typeof input.page?.title === 'string' && input.page.title.trim() ? input.page.title.trim() : pageId;
	const pageHref = typeof input.page?.href === 'string' && input.page.href.trim() ? input.page.href.trim() : `/${pageId}/`;
	requiredString(input.target?.game_name, 'target.game_name');
	const primarySignals = input.primary_task_signals ?? [];
	const secondarySignals = input.secondary_task_signals ?? [];
	const packageData = normalizePagePackage(input.page_package);
	const evidenceRecords = [...(input.search_evidence ?? []), ...(input.evidence ?? [])];
	const evidence = evidenceRecords.map(toEvidence);
	const facts = input.game_facts?.length ? input.game_facts.map(toFact) : packageData.facts;
	const freshness: PageFreshness = input.freshness ? {
		...(input.freshness.version === undefined ? {} : { version: input.freshness.version }),
		...(input.freshness.platform === undefined ? {} : { platform: input.freshness.platform }),
		...(input.freshness.season === undefined ? {} : { season: input.freshness.season }),
		...(input.freshness.data_window === undefined ? {} : { dataWindow: input.freshness.data_window }),
	} : {};
	const assetIntents = input.asset_intent ?? [];
	const assetCandidates = [...(input.asset_candidates ?? []).map((candidate) => ({
		...candidate,
		role: mediaRole(candidate.role_hint),
		evidenceRefs: candidate.evidence_refs ?? [],
	})), ...packageData.assets.map((candidate, index) => ({ ...candidate, asset_id: candidate.mediaId ?? `package-media-${index + 1}`, role: candidate.role, evidenceRefs: candidate.evidenceRefs ?? [] }))];
	const primaryTask = taskFromSignal(primarySignals[0]);
	const serpSignals = evidenceRecords.filter((record) => record.source_type === 'serp').map((record) => record.summary);
	const resolverEvidence: ResolverEvidence | undefined = serpSignals.length ? { serpSignals } : undefined;
	const resolverInput: ResolverInput = { query, playerProblem, ...(primaryTask ? { primaryTask } : {}), ...(secondarySignals.length ? { secondaryTasks: secondarySignals.flatMap((signal) => { const task = taskFromSignal(signal); return task ? [task] : []; }) } : {}), ...(input.priority === undefined ? {} : { priority: input.priority }), ...(resolverEvidence ? { evidence: resolverEvidence } : {}) };
	const normalizedResearch: NormalizedResearchData = { page: { ...input.page, id: pageId }, query, playerProblem, primaryTaskSignals: primarySignals, secondaryTaskSignals: secondarySignals, facts, evidence, evidenceRecords, freshness, assetIntents, assetCandidates };
	const pageDataInput: Omit<PageDataInput, 'intent'> = { page: { id: pageId, title: pageTitle, href: pageHref }, body: packageData.body, facts, evidence: evidence.length ? evidence : packageData.evidence, freshness, assets: assetCandidates.map((candidate) => ({ mediaId: candidate.asset_id, path: candidate.path, alt: candidate.alt, caption: candidate.caption, provenance: candidate.provenance, width: candidate.width, height: candidate.height, type: candidate.type, evidenceRefs: candidate.evidenceRefs, role: candidate.role as PageAssetCandidate['role'], usable: candidate.usable ?? false })) };
	return { resolverInput, normalizedResearch, pageDataInput };
}
