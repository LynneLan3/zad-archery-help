import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { generateSite } from '../../scripts/lib/generator';
import { clearToolkitProgress, readToolkitProgress, writeToolkitProgress, type ToolkitItem } from '../../src/lib/toolkit';
import { getCanonicalGuideUrlForMapMarker, getMapTargetsForGuideUrl, getToolkitMapGuideGroups } from '../../src/lib/toolkit-map';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FIXTURES = path.join(ROOT, 'tests/site-generator/fixtures');

function copyTemplateWorkspace(): string {
	mkdirSync(path.join(ROOT, 'tmp'), { recursive: true });
	const dir = mkdtempSync(path.join(ROOT, 'tmp', 'gws-toolkit-'));
	for (const entry of ['package.json', 'package-lock.json', 'astro.config.mjs', 'tsconfig.json', 'TEMPLATE_VERSION', '.gitignore', 'public', 'src', 'scripts']) {
		cpSync(path.join(ROOT, entry), path.join(dir, entry), { recursive: true });
	}
	symlinkSync(path.relative(dir, path.join(ROOT, 'node_modules')), path.join(dir, 'node_modules'));
	return dir;
}

function installValidFixture(workspace: string) {
	cpSync(path.join(FIXTURES, 'valid-site/site-spec.yaml'), path.join(workspace, 'site-spec.yaml'));
	cpSync(path.join(FIXTURES, 'valid-site/site-input'), path.join(workspace, 'site-input'), { recursive: true });
	generateSite({ specPath: path.join(workspace, 'site-spec.yaml'), rootDir: workspace });
}

function build(workspace: string) {
	return spawnSync('npx', ['astro', 'build'], {
		cwd: workspace,
		encoding: 'utf8',
		env: { ...process.env, VALIDATE_MODE: 'template' },
	});
}

test('generic toolkit progress filters unknown IDs and clears only its namespace', () => {
	const values = new Map<string, string>();
	const storage = {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => values.set(key, value),
		removeItem: (key: string) => values.delete(key),
	} as unknown as Storage;
	const items: ToolkitItem[] = [
		{ id: 'one', name: 'One', category: 'World', mapMarkerId: 'marker-one' },
		{ id: 'two', name: 'Two', category: 'World', mapMarkerId: 'marker-two' },
		{ id: 'three', name: 'Three', category: 'World' },
	];
	const validIds = new Set(items.map((item) => item.id));
	writeToolkitProgress(storage, 'fixture-toolkit-v1', new Set(['one', 'unknown']));
	values.set('unrelated-key', 'preserve-me');
	assert.deepEqual([...readToolkitProgress(storage, 'fixture-toolkit-v1', validIds)], ['one']);
	clearToolkitProgress(storage, 'fixture-toolkit-v1');
	assert.equal(values.has('fixture-toolkit-v1'), false);
	assert.equal(values.get('unrelated-key'), 'preserve-me');
});

test('generic guide-to-map resolver supports zero, one, and many verified targets', () => {
	const markers = [
		{ id: 'marker-one', href: '/example-game/legacy-guide/' },
		{ id: 'marker-two', href: '/example-game/guide-b/' },
		{ id: 'marker-three', href: '/example-game/guide-b/' },
	];
	const items: ToolkitItem[] = [
		{ id: 'one', name: 'Guide A item', category: 'World', guideUrl: '/example-game/guide-a/', mapMarkerId: 'marker-one' },
		{ id: 'two', name: 'Guide B first item', category: 'World', guideUrl: '/example-game/guide-b/', mapMarkerId: 'marker-two' },
		{ id: 'three', name: 'Guide B second item', category: 'World', guideUrl: '/example-game/guide-b/', mapMarkerId: 'marker-three' },
		{ id: 'off-map', name: 'Guide C item', category: 'World', guideUrl: '/example-game/guide-c/' },
	];
	assert.deepEqual(getMapTargetsForGuideUrl('/example-game/guide-a/', items, markers).map((target) => target.mapMarkerId), ['marker-one']);
	assert.deepEqual(getMapTargetsForGuideUrl('/example-game/guide-b/', items, markers).map((target) => target.mapMarkerId), ['marker-two', 'marker-three']);
	assert.deepEqual(getMapTargetsForGuideUrl('/example-game/guide-c/', items, markers), []);
	assert.deepEqual(getMapTargetsForGuideUrl('/example-game/guide-d/', items, markers), []);
	assert.equal(getCanonicalGuideUrlForMapMarker('marker-one', items, markers), '/example-game/guide-a/');
	assert.equal(getCanonicalGuideUrlForMapMarker('unknown-marker', items, markers), undefined);
	assert.deepEqual(getToolkitMapGuideGroups(items, markers).map((group) => [group.key, group.targets.length]), [['guide-a', 1], ['guide-b', 2]]);
});

test('opt-in LocationExplorer fixture renders map/checklist contract and legacy build stays unmodified', { timeout: 240_000 }, () => {
	const workspace = copyTemplateWorkspace();
	try {
		installValidFixture(workspace);
		writeFileSync(path.join(workspace, 'src/pages/toolkit-fixture.astro'), `---
import LocationExplorer from '../components/experience/LocationExplorer.astro';
import GuideMapAction from '../components/experience/GuideMapAction.astro';
import ProgressReadiness from '../components/experience/ProgressReadiness.astro';
const markers = [
  { id: 'marker-one', name: 'One Marker', category: 'World', region: 'North', x: 25, y: 30, href: '/example-game/legacy-guide/' },
  { id: 'marker-two', name: 'Two Marker', category: 'World', region: 'South', x: 55, y: 60, href: '/example-game/guide-b/' },
  { id: 'marker-three', name: 'Three Marker', category: 'World', region: 'East', x: 70, y: 45, href: '/example-game/guide-b/' },
];
const toolkitItems = [
  { id: 'one', name: 'Guide A item', category: 'World', region: 'North', mapMarkerId: 'marker-one', guideUrl: '/example-game/guide-a/' },
  { id: 'two', name: 'Guide B first item', category: 'World', region: 'South', mapMarkerId: 'marker-two', guideUrl: '/example-game/guide-b/' },
  { id: 'three', name: 'Guide B second item', category: 'World', region: 'East', mapMarkerId: 'marker-three', guideUrl: '/example-game/guide-b/' },
  { id: 'off-map', name: 'Guide C item', category: 'World', region: 'Off-map', guideUrl: '/example-game/guide-c/' },
];
const readinessRules = [
  { id: 'critical-manual', title: 'Critical manual check', tier: 'critical', description: 'Confirm this before continuing.', statusResolver: 'manual', manualKey: 'critical', manualOptions: [{ value: 'unknown', label: 'Unknown' }, { value: 'confirmed', label: 'Confirmed' }] },
  { id: 'recommended-toolkit', title: 'Recommended tracked cleanup', tier: 'recommended', description: 'Reuse the existing toolkit state.', recoverability: 'next-cycle', toolkitItemIds: ['one', 'two', 'three'], guideUrl: '/example-game/guide-b/' },
  { id: 'current-run-rule', title: 'Current-run rule', tier: 'recommended', description: 'This recommendation belongs to the current run.', recoverability: 'current-run', statusResolver: 'informational' },
  { id: 'fresh-save-rule', title: 'Fresh-save-only rule', tier: 'critical', description: 'A missed opening cannot be restored in this save.', statusResolver: 'manual', manualKey: 'opening', recoverability: 'fresh-save-only', manualOptions: [{ value: 'unknown', label: 'Unknown' }, { value: 'missed', label: 'Missed' }] },
  { id: 'safe-info', title: 'Safe informational rule', tier: 'safe', description: 'This carries over.', recoverability: 'not-applicable', carryOver: 'Carries over' },
];
---
<LocationExplorer title="Toolkit Fixture" markers={markers} toolkit={{ enabled: true, storageKey: 'fixture-toolkit-v1', title: 'Fixture Tracker' }} toolkitItems={toolkitItems} />
<ProgressReadiness rules={readinessRules} toolkitItems={toolkitItems} markers={markers} toolkitStorageKey="fixture-toolkit-v1" readinessStorageKey="fixture-readiness-v1" mapPath="/toolkit-fixture/" />
<section data-guide-fixture>
  <GuideMapAction guideUrl="/example-game/guide-a/" mapPath="/toolkit-fixture/" toolkitItems={toolkitItems} markers={markers} />
  <GuideMapAction guideUrl="/example-game/guide-b/" mapPath="/toolkit-fixture/" toolkitItems={toolkitItems} markers={markers} />
  <GuideMapAction guideUrl="/example-game/guide-c/" mapPath="/toolkit-fixture/" toolkitItems={toolkitItems} markers={markers} />
  <GuideMapAction guideUrl="/example-game/guide-d/" mapPath="/toolkit-fixture/" toolkitItems={toolkitItems} markers={markers} />
</section>
`, 'utf8');
		const fixtureBuild = build(workspace);
		assert.equal(fixtureBuild.status, 0, fixtureBuild.stdout + fixtureBuild.stderr);
		const fixtureHtml = readFileSync(path.join(workspace, 'dist/toolkit-fixture/index.html'), 'utf8');
		assert.match(fixtureHtml, /data-location-toolkit/);
		assert.match(fixtureHtml, /data-progress-readiness/);
		assert.match(fixtureHtml, /fixture-readiness-v1/);
		assert.match(fixtureHtml, /CRITICAL/);
		assert.match(fixtureHtml, /SAFE/);
		assert.match(fixtureHtml, /href="\/toolkit-fixture\/\?guide=guide-b"/);
		assert.match(fixtureHtml, /Fresh-save-only rule/);
		assert.match(fixtureHtml, /data-readiness-recoverability="current-run"/);
		assert.match(fixtureHtml, /data-readiness-recoverability="next-cycle"/);
		assert.match(fixtureHtml, /data-readiness-recoverability="fresh-save-only"/);
		assert.match(fixtureHtml, /data-readiness-recoverability="not-applicable"/);
		assert.equal((fixtureHtml.match(/data-toolkit-item=/g) ?? []).length, 4);
		assert.equal((fixtureHtml.match(/data-location-marker=/g) ?? []).length, 3);
		assert.equal((fixtureHtml.match(/data-toolkit-show-on-map=/g) ?? []).length, 3);
		assert.match(fixtureHtml, /fixture-toolkit-v1/);
		assert.match(fixtureHtml, /href="\/toolkit-fixture\/\?marker=marker-one"/);
		assert.match(fixtureHtml, /href="\/toolkit-fixture\/\?guide=guide-b"/);
		assert.equal((fixtureHtml.match(/class="guide-map-action"/g) ?? []).length, 3);
		assert.equal((fixtureHtml.match(/data-location-guide-key=/g) ?? []).length, 3);
		assert.match(fixtureHtml, /data-location-guide-context/);

		const legacyWorkspace = copyTemplateWorkspace();
		try {
			installValidFixture(legacyWorkspace);
			const legacyBuild = build(legacyWorkspace);
			assert.equal(legacyBuild.status, 0, legacyBuild.stdout + legacyBuild.stderr);
			const legacyHtml = readFileSync(path.join(legacyWorkspace, 'dist/fixture-game/index.html'), 'utf8');
			assert.doesNotMatch(legacyHtml, /data-location-toolkit|data-toolkit-item|fixture-toolkit-v1/);
			assert.ok(existsSync(path.join(legacyWorkspace, 'dist/fixture-game/beginner-guide/index.html')));
		} finally {
			rmSync(legacyWorkspace, { recursive: true, force: true });
		}
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});
