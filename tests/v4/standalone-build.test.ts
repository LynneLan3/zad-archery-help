import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { generateV4Standalone } from '../../scripts/v4/generate-v4';

const emberfallFixture = path.resolve('site-input/v4-example/site.json');

function run(destination: string, command: string, args: string[]) {
	const result = spawnSync(command, args, {
		cwd: destination,
		encoding: 'utf8',
		env: { ...process.env, npm_config_audit: 'false', npm_config_fund: 'false', npm_config_update_notifier: 'false' },
	});
	assert.equal(result.status, 0, `${command} ${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`);
}

function makeScarletFixture(directory: string) {
	const input = path.join(directory, 'scarlet-compatible.json');
	writeFileSync(input, `${JSON.stringify({
		game: { name: 'Scarlet-compatible Game', slug: 'scarlet-compatible', accent: '#d94f70' },
		pages: [{
			id: 'release-and-steam-facts', title: 'Release & Steam Facts', href: '/release-and-steam-facts/',
			query: 'scarlet-compatible release', playerProblem: 'check release facts', primaryTask: 'entity-lookup',
			assets: [{ role: 'hero', path: '/v4/scarlet-compatible.jpg', alt: 'Official cover', usable: true }],
			primitiveData: [{ primitiveId: 'A01', instanceId: 'release-answer', payload: { title: 'Release & Steam Facts', task: 'Check facts', subject: 'Scarlet-compatible Game' }, evidenceRefs: [], mediaRefs: [] }],
		}],
	}, null, 2)}\n`, 'utf8');
	return input;
}

test('fresh Emberfall sparse and Scarlet-compatible destinations are self-contained', { timeout: 300_000 }, () => {
	const workspace = mkdtempSync(path.join(os.tmpdir(), 'g016-v4-standalone-build-'));
	try {
		const scarletFixture = makeScarletFixture(workspace);
		for (const [name, fixture] of [['emberfall-sparse', emberfallFixture], ['scarlet-compatible', scarletFixture]]) {
			const destination = path.join(workspace, name);
			generateV4Standalone(fixture, destination);
			assert.equal(existsSync(path.join(destination, 'src/v4/generated/example-site.json')), true);
			assert.equal(JSON.parse(readFileSync(path.join(destination, 'tsconfig.json'), 'utf8')).exclude.includes('scripts'), true);
			run(destination, 'npm', ['install']);
			run(destination, 'npm', ['run', 'check']);
			run(destination, 'npm', ['run', 'build']);
		}
	} finally {
		rmSync(workspace, { recursive: true, force: true });
	}
});
