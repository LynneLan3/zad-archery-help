import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { generateV4Standalone } from '../../scripts/v4/generate-v4';
import { adaptGuideContentResult } from '../../src/v4/guide-content-adapter';
import { createV4Theme } from '../../src/v4/visual-system';
import { guideFixtures } from './fixtures/g024-guide-content-fixtures';

function run(destination: string, command: string, args: string[]) {
	const result = spawnSync(command, args, { cwd: destination, encoding: 'utf8', env: { ...process.env, npm_config_audit: 'false', npm_config_fund: 'false', npm_config_update_notifier: 'false' } });
	assert.equal(result.status, 0, `${command} ${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`);
}

test('G024 P5 standalone renders structured P4/P5/P6/P7 Guide Content Results without article fallback', { timeout: 300_000 }, () => {
	const workspace = mkdtempSync(path.join(os.tmpdir(), 'g024-p5-v4-render-'));
	try {
		const destination = path.join(workspace, 'site');
		generateV4Standalone(path.resolve('site-input/v4-example/site.json'), destination);
		const pages = (Object.keys(guideFixtures) as Array<keyof typeof guideFixtures>).map((prototype) => {
			const fixture = guideFixtures[prototype];
			const adapted = adaptGuideContentResult(fixture.result, fixture.refs, fixture.page);
			return { id: fixture.page.id, title: fixture.page.title, href: fixture.page.href, pageData: adapted.pageData, composition: adapted.composition };
		});
		const generated = { game: { name: 'G024 Fixture World', slug: 'g024-fixtures', accent: '#1d6fa5' }, theme: createV4Theme('#1d6fa5'), navigation: { primary: [] }, homepage: { pageIds: pages.map((page) => page.id), assets: [], surfaces: [{ id: 'guide-fixtures', label: 'Guide fixtures', pageIds: pages.map((page) => page.id) }] }, pages };
		writeFileSync(path.join(destination, 'src/v4/generated/example-site.json'), `${JSON.stringify(generated, null, 2)}\n`, 'utf8');
		run(destination, 'npm', ['install']);
		run(destination, 'npm', ['run', 'check']);
		run(destination, 'npm', ['run', 'build']);
		const html = (id: string) => readFileSync(path.join(destination, 'dist', id, 'index.html'), 'utf8');
		const p4 = html('forge-procedure'); const p5 = html('crystal-cave-location'); const p6 = html('observatory-progression'); const p7 = html('charge-mechanics');
		assert.equal(existsSync(path.join(destination, 'dist', 'forge-procedure', 'index.html')), true);
		assert.match(p4, /v4-steps/); assert.match(p4, /v4-recovery/); assert.doesNotMatch(p4, />FAQ</);
		assert.match(p5, /v4-location/); assert.match(p5, /v4-map/); assert.match(p5, /v4-route/); assert.match(p5, /crystal-cave\.png/); assert.doesNotMatch(p5, />FAQ</);
		assert.match(p6, /v4-progress/); assert.match(p6, /v4-choice-matrix/); assert.match(p6, /v4-next/);
		assert.match(p7, /v4-table-wrap/); assert.match(p7, /v4-formula/); assert.match(p7, /v4-recovery/); assert.match(p7, /Worked example/);
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});
