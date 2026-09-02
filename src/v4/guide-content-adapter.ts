/** Thin G024 input adapter: Guide Content Result -> frozen V4 PageData. */
import { bindTaskMedia } from './media-binding';
import { createPageData, type PageAssetCandidate, type PageData, type PageEvidence, type PrimitiveInstance } from './page-data-contract';
import { composePage, type ComposedPage } from './page-composer';
import { resolveIntent } from './intent-resolver';
import type { PlayerTask, PrimitiveDecision, PrimitiveSupport, ResolvedPageIntent } from './intent-contract';
import { PRIMITIVE_DEFINITIONS } from './primitives';

type Json = Record<string, unknown>;
export interface GuideContentItem { slotRefs: readonly string[]; materialRef: string; type: string; content: string; structuredData?: Json; status: string; confidence?: string; applicability?: Json; mediaRefs: readonly string[]; }
export interface GuideSection { slotRef: string; heading: string; text: string; status: string; materialRefs: readonly string[]; mediaRefs: readonly string[]; }
export interface GuideContentResult { context: { game: string; query: string; playerTask: string; prototype: 'P4'|'P5'|'P6'|'P7'; gameVersion?: string; platform?: string }; quickAnswer?: { text: string; status: string; materialRefs: readonly string[] } | null; sections: readonly GuideSection[]; steps: readonly GuideContentItem[]; tables: readonly GuideContentItem[]; formulas: readonly GuideContentItem[]; measurements?: readonly GuideContentItem[]; locations: readonly GuideContentItem[]; recommendations: readonly GuideContentItem[]; troubleshooting: readonly GuideContentItem[]; mediaPlacements: readonly { mediaRef: string; slotRef: string; materialRefs: readonly string[]; whatItProves: string; placementPurpose: string }[]; nextStep?: { text: string; status: string; materialRefs: readonly string[] } | null; coverage: { filledSlots: readonly string[]; partialSlots: readonly string[]; missingSlots: readonly string[]; unsupportedMaterialOrFacts: number }; sourceMaterialRefs: readonly string[]; }
export interface GuideBuildPackReferences { materials: readonly { materialId: string; type: string; content: string; structuredData?: Json; evidenceRefs: readonly string[]; evidenceTypes?: readonly string[]; mediaRefs: readonly string[]; status: string; confidence: string; applicability?: Json }[]; sources: readonly { sourceId: string; evidenceType: string; url: string; creatorOrPublisher?: string }[]; media: readonly { mediaId: string; sourceRef: string; timestamp?: string; whatItProves: string; claimRefs: readonly string[] }[]; }
export interface GuideV4AdapterReport { blueprintSlotsRendered: readonly string[]; structuredObjectsRendered: readonly string[]; materialsPreserved: readonly string[]; mediaBindingsPreserved: readonly { mediaRef: string; slotRef: string; materialRefs: readonly string[]; renderedAs: 'map'|'evidence' }[]; missingSlotsOmitted: readonly string[]; unsupportedContentAdded: 0; }
export interface AdaptedGuideContent { pageData: PageData; composition: ComposedPage; report: GuideV4AdapterReport; }

const TASK_BY_PROTOTYPE: Record<GuideContentResult['context']['prototype'], PlayerTask> = { P4: 'procedure', P5: 'location', P6: 'progression', P7: 'mechanics' };
const VALID_IDS = new Set(PRIMITIVE_DEFINITIONS.map((item) => item.id));
const object = (value: unknown): Json => value && typeof value === 'object' && !Array.isArray(value) ? value as Json : {};
const text = (value: unknown): string | undefined => typeof value === 'string' && value.trim() ? value : undefined;
const array = (value: unknown): readonly unknown[] => Array.isArray(value) ? value : [];

function materialEvidence(refs: GuideBuildPackReferences, materialId: string): PageEvidence {
	const material = refs.materials.find((item) => item.materialId === materialId);
	const source = refs.sources.find((item) => item.sourceId === material?.evidenceRefs[0]);
	return { evidenceId: materialId, sourceType: source?.evidenceType ?? material?.type ?? 'evidence', sourceRef: source?.url, finding: material?.content ?? materialId };
}

function reliableMapAssets(result: GuideContentResult, refs: GuideBuildPackReferences): PageAssetCandidate[] {
	const needed = new Set(result.mediaPlacements.filter((item) => ['map', 'exactLocation', 'routeSteps', 'landmarks'].includes(item.slotRef)).map((item) => item.mediaRef));
	return refs.media.flatMap((media) => {
		if (!needed.has(media.mediaId)) return [];
		const source = refs.sources.find((item) => item.sourceId === media.sourceRef);
		if (source?.evidenceType !== 'SCREENSHOT_OR_MAP' || !/^https?:\/\//.test(source.url)) return [];
		return [{ mediaId: media.mediaId, role: 'map', path: source.url, alt: media.whatItProves, caption: media.timestamp ? `Evidence timestamp ${media.timestamp}` : undefined, provenance: `Guide Build Pack ${media.mediaId} -> ${source.sourceId}`, usable: true }];
	});
}

function intentFor(result: GuideContentResult, include: ReadonlySet<string>): ResolvedPageIntent {
	const primaryTask = TASK_BY_PROTOTYPE[result.context.prototype];
	const base = resolveIntent({ query: result.context.query, playerProblem: result.context.playerTask, primaryTask });
	const existing = new Map(base.primitiveRecipe.map((item) => [item.primitiveId, item]));
	for (const id of include) if (!VALID_IDS.has(id as never)) throw new Error(`Guide adapter attempted unknown frozen Primitive: ${id}`);
	const recipe: PrimitiveDecision[] = [...existing.values()].map((item) => ({ ...item, status: include.has(item.primitiveId) ? 'include' : 'omit' }));
	for (const id of include) if (!existing.has(id)) recipe.push({ primitiveId: id, status: 'include', reason: 'Guide Blueprint supplied compatible structured material.' });
	return { ...base, prototype: result.context.prototype, primitiveRecipe: recipe };
}

function materialRefs(items: readonly GuideContentItem[]): readonly string[] { return [...new Set(items.map((item) => item.materialRef))]; }
function slotItems(items: readonly GuideContentItem[], slot: string): GuideContentItem[] { return items.filter((item) => item.slotRefs.includes(slot)); }
function idsForMaterials(materialIds: readonly string[], mapMediaIds: ReadonlySet<string>, refs: GuideBuildPackReferences): readonly string[] {
	return [...new Set(materialIds.flatMap((id) => refs.materials.find((item) => item.materialId === id)?.mediaRefs ?? []).filter((id) => mapMediaIds.has(id)))];
}

/** Maps only already-filled Guide Content Result slots into existing V4 primitives. */
export function adaptGuideContentResult(result: GuideContentResult, refs: GuideBuildPackReferences, page: { id: string; title: string; href: string; priority?: number }): AdaptedGuideContent {
	if (result.coverage.unsupportedMaterialOrFacts !== 0) throw new Error('Guide Content Result contains unsupported material/facts');
	const missing = new Set(result.coverage.missingSlots);
	const assets = reliableMapAssets(result, refs);
	const media = bindTaskMedia(TASK_BY_PROTOTYPE[result.context.prototype], assets);
	const mapMediaIds = new Set(media.assets.filter((asset) => asset.role === 'map').map((asset) => asset.mediaId ?? ''));
	const instances: PrimitiveInstance[] = [];
	const include = new Set<string>(['A01']);
	const evidenceIds = new Set(result.sourceMaterialRefs);
	const hasAvailableSlot = (item: { slotRefs: readonly string[]; status: string }) => item.status !== 'MISSING' && item.slotRefs.some((slot) => !missing.has(slot));
	const visibleSections = result.sections.filter((item) => item.status !== 'MISSING' && !missing.has(item.slotRef));
	const visibleSteps = result.steps.filter(hasAvailableSlot);
	const visibleTables = result.tables.filter(hasAvailableSlot);
	const visibleFormulas = result.formulas.filter(hasAvailableSlot);
	const visibleMeasurements = result.measurements?.filter(hasAvailableSlot) ?? [];
	const visibleLocations = result.locations.filter(hasAvailableSlot);
	const visibleRecommendations = result.recommendations.filter(hasAvailableSlot);
	const visibleTroubleshooting = result.troubleshooting.filter(hasAvailableSlot);
	const add = (primitiveId: PrimitiveInstance['primitiveId'], instanceId: string, payload: PrimitiveInstance['payload'], materials: readonly string[] = [], mediaRefs: readonly string[] = []) => {
		include.add(primitiveId); instances.push({ primitiveId, instanceId, payload, evidenceRefs: materials.filter((id) => evidenceIds.has(id)), mediaRefs });
	};
	add('A01', 'guide-answer-header', { title: page.title, task: result.context.playerTask, subject: result.context.game });
	if (result.quickAnswer && result.quickAnswer.status !== 'MISSING' && !missing.has('quickAnswer')) add('A02', 'guide-quick-answer', { answer: result.quickAnswer.text }, result.quickAnswer.materialRefs);

	const factRows: { label: string; value: string; state?: string }[] = [];
	const p4Requirements = visibleSections.filter((item) => item.slotRef === 'requirements');
	if (p4Requirements.length) add('P01', 'guide-requirements', { requirements: p4Requirements.map((item, index) => ({ id: `requirement-${index + 1}`, label: item.text })) }, p4Requirements.flatMap((item) => item.materialRefs));
	const procedureSteps = result.context.prototype === 'P4' ? visibleSteps : result.context.prototype === 'P6' ? slotItems(visibleSteps, 'immediateGoals') : slotItems(visibleSteps, 'interaction');
	if (procedureSteps.length) add('P02', 'guide-steps', { steps: procedureSteps.map((item, index) => ({ id: `step-${index + 1}`, order: Number(object(item.structuredData).order ?? index + 1), action: item.content, result: text(object(item.structuredData).expectedState), evidenceRefs: [item.materialRef] })) }, materialRefs(procedureSteps), idsForMaterials(materialRefs(procedureSteps), mapMediaIds, refs));
	const recoveries = visibleTroubleshooting.filter((item) => text(object(item.structuredData).recovery));
	if (recoveries.length) add('P04', 'guide-recovery', { cases: recoveries.map((item) => ({ symptom: text(object(item.structuredData).symptom) ?? text(object(item.structuredData).failure) ?? item.content, cause: text(object(item.structuredData).cause), recovery: text(object(item.structuredData).recovery)! })) }, materialRefs(recoveries));

	const location = visibleLocations[0];
	if (location) {
		const data = object(location.structuredData);
		const coordinates = object(data.coordinates);
		const landmark = text(data.landmark) ?? text(array(data.landmarks).map(String).join(', '));
		add('L01', 'guide-location', { area: text(data.area) ?? location.content, coordinates: typeof coordinates.x === 'number' && typeof coordinates.y === 'number' ? { x: coordinates.x, y: coordinates.y, region: text(data.region) } : undefined, landmark, access: text(data.destination) }, [location.materialRef]);
		factRows.push({ label: 'Location', value: location.content });
	}
	const route = visibleSteps.find((item) => item.slotRefs.includes('routeSteps'));
	if (route) {
		const routeData = array(object(route.structuredData).route).map(String);
		const locationData = object(location?.structuredData);
		const start = text(locationData.landmark) ?? array(locationData.landmarks).map(String)[0] ?? 'Route start';
		add('L03', 'guide-route', { start, waypoints: routeData.map((label, index) => ({ id: `route-${index + 1}`, label, instruction: label })), destination: text(locationData.name) ?? location?.content ?? route.content }, [route.materialRef], idsForMaterials([route.materialRef], mapMediaIds, refs));
	}
	if (location && mapMediaIds.size) {
		const data = object(location.structuredData); const coordinates = object(data.coordinates);
		add('L02', 'guide-map', { source: 'Guide Build Pack map evidence', markers: typeof coordinates.x === 'number' && typeof coordinates.y === 'number' ? [{ id: 'destination', label: location.content, x: coordinates.x, y: coordinates.y, locationRef: location.materialRef }] : [] }, [location.materialRef], [...mapMediaIds]);
	}

	const milestones = visibleSteps.find((item) => item.slotRefs.includes('milestones'));
	if (milestones) {
		const values = array(object(milestones.structuredData).milestones).map(String);
		add('P03', 'guide-milestones', { milestones: values.map((label, index) => ({ id: `milestone-${index + 1}`, label, next: index + 1 < values.length ? values[index + 1] : undefined })) }, [milestones.materialRef]);
	}
	const table = visibleTables[0];
	if (table) {
		const data = object(table.structuredData); const columns = array(data.columns).map(String);
		add('E03', 'guide-table', { columns: columns.map((id) => ({ id, label: id })), rows: array(data.rows).map((row) => Object.fromEntries(array(row).map((value, index) => [columns[index] ?? `column-${index + 1}`, value as string | number | boolean]))) }, [table.materialRef]);
	}
	const formula = visibleFormulas[0];
	if (formula) {
		const data = object(formula.structuredData); const units = object(data.units);
		const measurement = visibleMeasurements[0]; const measureData = object(measurement?.structuredData);
		add('X03', 'guide-formula', { expression: text(data.expression) ?? formula.content, variables: array(data.variables).map(String).map((name) => ({ name, meaning: name, unit: text(units[name]) })), workedExample: measurement ? { inputs: Object.fromEntries(['value', 'unit'].filter((key) => measureData[key] !== undefined).map((key) => [key, measureData[key] as string | number])), result: measurement.content } : undefined }, [formula.materialRef, ...(measurement ? [measurement.materialRef] : [])]);
	}
	const recommendation = visibleRecommendations[0];
	if (recommendation) {
		const data = object(recommendation.structuredData);
		add('D03', 'guide-recommendation', { scenarios: [{ condition: array(data.conditions).map(String).join('; ') || 'When the stated conditions apply', choice: text(data.advice) ?? recommendation.content, reason: text(data.rationale) ?? recommendation.content }] }, [recommendation.materialRef]);
	}
	for (const section of visibleSections) {
		if (['requirements', 'steps', 'routeSteps', 'milestones', 'dataTables', 'formulas', 'workedExamples', 'edgeCases', 'troubleshooting', 'exactLocation', 'coordinates', 'map', 'startPoint', 'landmarks', 'interaction', 'branches'].includes(section.slotRef)) continue;
		factRows.push({ label: section.heading, value: section.text, state: section.status === 'PARTIAL' ? 'Partial evidence' : undefined });
	}
	if (factRows.length) add('E01', 'guide-facts', { facts: factRows }, result.sections.flatMap((item) => item.materialRefs));
	if (result.context.prototype === 'P7') {
		const rule = visibleSections.find((item) => item.slotRef === 'quickRule');
		if (rule) add('A03', 'guide-rule-context', { scope: rule.text }, rule.materialRefs);
	}
	if (result.nextStep && result.nextStep.status !== 'MISSING' && !missing.has('nextStep')) add('N01', 'guide-next-step', { steps: [{ href: '#next-step', label: result.nextStep.text, reason: result.nextStep.text }] }, result.nextStep.materialRefs);

	const intent = intentFor(result, include);
	const evidence = [...evidenceIds].map((id) => materialEvidence(refs, id));
	const body = { sections: visibleSections.filter((item) => ['applicability', 'expectedResult', 'uiAnchors', 'risks', 'preparation', 'constraints', 'variables', 'units'].includes(item.slotRef)).map((item) => ({ id: item.slotRef, title: item.heading, paragraphs: [item.text], bullets: [] })), faq: [] };
	const pageData = createPageData({ intent, page, facts: factRows.map((fact, index) => ({ id: `guide-fact-${index + 1}`, label: fact.label, value: fact.value, verified: true })), evidence, assets: media.assets, primitiveData: instances, primitiveSupport: { ...media.primitiveSupport, L03: route ? 'available' as PrimitiveSupport : 'unsupported' as PrimitiveSupport }, body, freshness: { version: result.context.gameVersion, platform: result.context.platform } });
	const renderedSlots = new Set<string>([...result.coverage.filledSlots, ...result.coverage.partialSlots].filter((slot) => !missing.has(slot)));
	const mediaBindings = result.mediaPlacements.map((item) => ({ mediaRef: item.mediaRef, slotRef: item.slotRef, materialRefs: item.materialRefs, renderedAs: mapMediaIds.has(item.mediaRef) ? 'map' as const : 'evidence' as const }));
	return { pageData, composition: composePage(pageData), report: { blueprintSlotsRendered: [...renderedSlots], structuredObjectsRendered: instances.filter((item) => item.primitiveId !== 'A01' && item.primitiveId !== 'A02').map((item) => item.primitiveId), materialsPreserved: evidence.map((item) => item.evidenceId ?? '').filter(Boolean), mediaBindingsPreserved: mediaBindings, missingSlotsOmitted: [...missing], unsupportedContentAdded: 0 } };
}
