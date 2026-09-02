import type { GuideBuildPackReferences, GuideContentResult } from '../../../src/v4/guide-content-adapter';

type Fixture = { result: GuideContentResult; refs: GuideBuildPackReferences; page: { id: string; title: string; href: string } };
const material = (materialId: string, type: string, content: string, evidenceRefs: readonly string[], mediaRefs: readonly string[] = [], structuredData?: Record<string, unknown>) => ({ materialId, type, content, evidenceRefs, mediaRefs, structuredData, status: 'VERIFIED', confidence: 'HIGH' });
const source = (sourceId: string, evidenceType: string, url: string) => ({ sourceId, evidenceType, url, creatorOrPublisher: 'Fixture Evidence' });
const coverage = (filledSlots: readonly string[], partialSlots: readonly string[] = [], missingSlots: readonly string[] = []) => ({ filledSlots, partialSlots, missingSlots, unsupportedMaterialOrFacts: 0 });
const item = (slotRefs: readonly string[], materialRef: string, type: string, content: string, structuredData: Record<string, unknown> = {}, mediaRefs: readonly string[] = []) => ({ slotRefs, materialRef, type, content, structuredData, mediaRefs, status: 'VERIFIED', confidence: 'HIGH' });
const section = (slotRef: string, heading: string, text: string, materialRefs: readonly string[]) => ({ slotRef, heading, text, materialRefs, mediaRefs: [], status: 'VERIFIED' });

export const guideFixtures: Readonly<Record<'P4'|'P5'|'P6'|'P7', Fixture>> = {
	P4: {
		page: { id: 'forge-procedure', title: 'Forge Procedure', href: '/forge-procedure/' },
		refs: {
			materials: [
				material('p4-requirement', 'FACT', 'Carry a forge key.', ['p4-gameplay']),
				material('p4-step-1', 'STEP', 'Insert the mould into the forge.', ['p4-gameplay'], ['p4-video-step'], { order: 1, expectedState: 'The mould slot is occupied.' }),
				material('p4-step-2', 'STEP', 'Pull the hammer lever.', ['p4-gameplay'], [], { order: 2, expectedState: 'The hammer starts its cycle.' }),
				material('p4-recovery', 'EDGE_CASE', 'If the hammer does not start, reopen the UI and pull the lever again.', ['p4-gameplay'], [], { symptom: 'Hammer remains idle.', cause: 'The interaction did not register.', recovery: 'Reopen the UI and pull the lever again.' }),
			], sources: [source('p4-gameplay', 'DIRECT_GAMEPLAY', 'https://video.example.test/forge')], media: [{ mediaId: 'p4-video-step', sourceRef: 'p4-gameplay', timestamp: '00:42', whatItProves: 'The lever is pulled after the mould is inserted.', claimRefs: ['p4-step-1'] }],
		},
		result: {
			context: { game: 'Fixture Forge', query: 'use the forge', playerTask: 'Complete the forge sequence', prototype: 'P4', gameVersion: '1.0', platform: 'PC' },
			quickAnswer: { text: 'Insert the mould, then pull the hammer lever.', status: 'VERIFIED', materialRefs: ['p4-step-1', 'p4-step-2'] },
			sections: [section('requirements', 'Requirements', 'Carry a forge key.', ['p4-requirement']), section('uiAnchors', 'UI anchor', 'The mould slot becomes occupied before the lever is used.', ['p4-step-1'])],
			steps: [item(['steps'], 'p4-step-1', 'STEP', 'Insert the mould into the forge.', { order: 1, expectedState: 'The mould slot is occupied.' }, ['p4-video-step']), item(['steps'], 'p4-step-2', 'STEP', 'Pull the hammer lever.', { order: 2, expectedState: 'The hammer starts its cycle.' })],
			tables: [], formulas: [], locations: [], recommendations: [], troubleshooting: [item(['failures'], 'p4-recovery', 'EDGE_CASE', 'If the hammer does not start, reopen the UI and pull the lever again.', { symptom: 'Hammer remains idle.', cause: 'The interaction did not register.', recovery: 'Reopen the UI and pull the lever again.' })],
			mediaPlacements: [{ mediaRef: 'p4-video-step', slotRef: 'steps', materialRefs: ['p4-step-1'], whatItProves: 'The lever is pulled after the mould is inserted.', placementPurpose: 'Show the operation state.' }], nextStep: null,
			coverage: coverage(['quickAnswer', 'requirements', 'steps', 'uiAnchors', 'failures'], [], ['referenceData']), sourceMaterialRefs: ['p4-requirement', 'p4-step-1', 'p4-step-2', 'p4-recovery'],
		},
	},
	P5: {
		page: { id: 'crystal-cave-location', title: 'Crystal Cave Location', href: '/crystal-cave-location/' },
		refs: {
			materials: [
				material('p5-location', 'LOCATION', 'Crystal Cave is in Frost Basin at 184,72.', ['p5-map'], ['p5-map-anchor'], { area: 'Frost Basin', coordinates: { x: 184, y: 72, region: 'North' }, landmarks: ['East Camp', 'Broken arch'], destination: 'Crystal Cave' }),
				material('p5-route', 'STEP', 'Walk from East Camp through the broken arch to Crystal Cave.', ['p5-gameplay'], ['p5-map-anchor'], { route: ['Start at East Camp.', 'Pass the broken arch.', 'Enter Crystal Cave.'] }),
			], sources: [source('p5-map', 'SCREENSHOT_OR_MAP', 'https://maps.example.test/crystal-cave.png'), source('p5-gameplay', 'DIRECT_GAMEPLAY', 'https://video.example.test/crystal-cave')], media: [{ mediaId: 'p5-map-anchor', sourceRef: 'p5-map', whatItProves: 'The route passes East Camp and the broken arch before Crystal Cave.', claimRefs: ['p5-location', 'p5-route'] }],
		},
		result: {
			context: { game: 'Fixture World', query: 'Crystal Cave location', playerTask: 'Find Crystal Cave', prototype: 'P5', gameVersion: '1.0', platform: 'PC' },
			quickAnswer: { text: 'Crystal Cave is in Frost Basin at 184,72.', status: 'VERIFIED', materialRefs: ['p5-location'] },
			sections: [section('exactLocation', 'Exact Location', 'Crystal Cave is in Frost Basin at 184,72.', ['p5-location']), section('coordinates', 'Coordinates', '184,72 in North Frost Basin.', ['p5-location']), section('landmarks', 'Landmarks', 'Use East Camp and the broken arch as anchors.', ['p5-location'])],
			steps: [item(['routeSteps'], 'p5-route', 'STEP', 'Walk from East Camp through the broken arch to Crystal Cave.', { route: ['Start at East Camp.', 'Pass the broken arch.', 'Enter Crystal Cave.'] }, ['p5-map-anchor'])],
			tables: [], formulas: [], locations: [item(['exactLocation', 'coordinates', 'landmarks'], 'p5-location', 'LOCATION', 'Crystal Cave is in Frost Basin at 184,72.', { area: 'Frost Basin', coordinates: { x: 184, y: 72, region: 'North' }, landmarks: ['East Camp', 'Broken arch'], destination: 'Crystal Cave' }, ['p5-map-anchor'])], recommendations: [], troubleshooting: [],
			mediaPlacements: [{ mediaRef: 'p5-map-anchor', slotRef: 'routeSteps', materialRefs: ['p5-route'], whatItProves: 'The route passes East Camp and the broken arch before Crystal Cave.', placementPurpose: 'Anchor the route.' }], nextStep: { text: 'Enter Crystal Cave after reaching the marker.', status: 'VERIFIED', materialRefs: ['p5-location'] },
			coverage: coverage(['quickAnswer', 'exactLocation', 'coordinates', 'routeSteps', 'landmarks', 'nextStep'], [], ['edgeCases']), sourceMaterialRefs: ['p5-location', 'p5-route'],
		},
	},
	P6: {
		page: { id: 'observatory-progression', title: 'Observatory Progression', href: '/observatory-progression/' },
		refs: {
			materials: [material('p6-current', 'UI_STATE', 'The observatory gate is locked.', ['p6-gameplay']), material('p6-milestones', 'STEP', 'Restore power, activate the console, then enter the observatory.', ['p6-gameplay'], [], { milestones: ['Restore power.', 'Activate the console.', 'Enter the observatory.'] }), material('p6-branch', 'RECOMMENDATION', 'Prepare before entering if the power room is unsafe.', ['p6-gameplay'], [], { advice: 'Prepare before entering.', conditions: ['The power room is unsafe.'], rationale: 'It reduces the observed risk.' })], sources: [source('p6-gameplay', 'DIRECT_GAMEPLAY', 'https://video.example.test/observatory')], media: [{ mediaId: 'p6-trigger', sourceRef: 'p6-gameplay', timestamp: '01:10', whatItProves: 'Activating the console changes the next gate.', claimRefs: ['p6-milestones'] }],
		},
		result: {
			context: { game: 'Fixture World', query: 'what to do after the locked observatory', playerTask: 'Progress past the observatory gate', prototype: 'P6', gameVersion: '1.0', platform: 'PC' }, quickAnswer: null,
			sections: [section('currentState', 'Current State', 'The observatory gate is locked.', ['p6-current']), section('trigger', 'Trigger', 'Restore power before using the console.', ['p6-milestones']), section('branches', 'Branch', 'Prepare before entering if the power room is unsafe.', ['p6-branch'])],
			steps: [item(['milestones'], 'p6-milestones', 'STEP', 'Restore power, activate the console, then enter the observatory.', { milestones: ['Restore power.', 'Activate the console.', 'Enter the observatory.'] })],
			tables: [], formulas: [], locations: [], recommendations: [item(['branches'], 'p6-branch', 'RECOMMENDATION', 'Prepare before entering if the power room is unsafe.', { advice: 'Prepare before entering.', conditions: ['The power room is unsafe.'], rationale: 'It reduces the observed risk.' })], troubleshooting: [], mediaPlacements: [{ mediaRef: 'p6-trigger', slotRef: 'milestones', materialRefs: ['p6-milestones'], whatItProves: 'Activating the console changes the next gate.', placementPurpose: 'Show the gate trigger.' }], nextStep: { text: 'Enter the observatory after activating the console.', status: 'VERIFIED', materialRefs: ['p6-milestones'] },
			coverage: coverage(['currentState', 'trigger', 'milestones', 'branches', 'nextStep']), sourceMaterialRefs: ['p6-current', 'p6-milestones', 'p6-branch'],
		},
	},
	P7: {
		page: { id: 'charge-mechanics', title: 'Charge Mechanics', href: '/charge-mechanics/' },
		refs: {
			materials: [material('p7-rule', 'MECHANIC', 'Charge depends on flow and time.', ['p7-rule']), material('p7-table', 'DATA_TABLE', 'Observed charge values.', ['p7-rule'], [], { columns: ['Flow', 'Charge'], rows: [[1, 10], [2, 20]] }), material('p7-formula', 'FORMULA', 'charge = flow * time', ['p7-rule'], [], { expression: 'charge = flow * time', variables: ['flow', 'time'], units: { flow: 'units/s', time: 's' } }), material('p7-measurement', 'MEASUREMENT', 'Observed charge was 20 units in this setup.', ['p7-measurement'], [], { value: 20, unit: 'units', setup: 'fixture rig', method: 'single observed run' }), material('p7-trouble', 'EDGE_CASE', 'If flow stops, restart the input before measuring again.', ['p7-rule'], [], { symptom: 'Flow stops.', cause: 'Input is inactive.', recovery: 'Restart the input before measuring again.' })], sources: [source('p7-rule', 'GAME_RULE', 'https://rules.example.test/charge'), source('p7-measurement', 'DIRECT_MEASUREMENT', 'https://measure.example.test/charge')], media: [],
		},
		result: {
			context: { game: 'Fixture Systems', query: 'charge mechanics', playerTask: 'Understand charge', prototype: 'P7', gameVersion: '1.0', platform: 'PC' }, quickAnswer: { text: 'Charge depends on flow and time.', status: 'VERIFIED', materialRefs: ['p7-rule'] },
			sections: [section('quickRule', 'Core Rule', 'Charge depends on flow and time.', ['p7-rule']), section('variables', 'Variables', 'Flow is measured in units/s; time is measured in s.', ['p7-formula']), section('constraints', 'Constraints', 'Use the observed setup when applying the measurement.', ['p7-measurement'])],
			steps: [], tables: [item(['dataTables'], 'p7-table', 'DATA_TABLE', 'Observed charge values.', { columns: ['Flow', 'Charge'], rows: [[1, 10], [2, 20]] })], formulas: [item(['formulas'], 'p7-formula', 'FORMULA', 'charge = flow * time', { expression: 'charge = flow * time', variables: ['flow', 'time'], units: { flow: 'units/s', time: 's' } })], measurements: [item(['workedExamples'], 'p7-measurement', 'MEASUREMENT', 'Observed charge was 20 units in this setup.', { value: 20, unit: 'units', setup: 'fixture rig', method: 'single observed run' })], locations: [], recommendations: [], troubleshooting: [item(['troubleshooting'], 'p7-trouble', 'EDGE_CASE', 'If flow stops, restart the input before measuring again.', { symptom: 'Flow stops.', cause: 'Input is inactive.', recovery: 'Restart the input before measuring again.' })], mediaPlacements: [], nextStep: null,
			coverage: coverage(['quickAnswer', 'quickRule', 'variables', 'constraints', 'dataTables', 'formulas', 'workedExamples', 'troubleshooting']), sourceMaterialRefs: ['p7-rule', 'p7-table', 'p7-formula', 'p7-measurement', 'p7-trouble'],
		},
	},
};
