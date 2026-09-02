import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
	PRIMARY_VERCEL_ORG_ID,
	PRIMARY_VERCEL_TEAM_SLUG,
	checkDeploymentIdentity,
	formatCheckReport,
	runDeployCli,
	writeLocalVercelLink,
} from '../../scripts/lib/deployment-identity.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TMP = path.join(ROOT, 'tmp');

const SAMPLE = {
	provider: 'vercel',
	orgId: PRIMARY_VERCEL_ORG_ID,
	projectId: 'prj_exampleProjectPlaceholder01',
	projectName: 'example-game-wiki',
	productionUrl: 'https://example-game-wiki.vercel.app',
	productionBranch: 'feat/example-game-wiki',
};

function yamlQuote(value: string): string {
	return JSON.stringify(value);
}

function writeSpec(
	dir: string,
	overrides: {
		siteUrl?: string;
		deployment?: Record<string, string | undefined> | null;
		omitDeployment?: boolean;
	} = {},
) {
	const deployment =
		overrides.omitDeployment === true
			? null
			: {
					...SAMPLE,
					...(overrides.deployment ?? {}),
				};
	const lines = [
		'schemaVersion: 1',
		'templateVersion: 2.0.0',
		'mode: generated-site',
		'',
		'site:',
		'  id: example-game',
		'  locale: en',
		`  siteUrl: ${yamlQuote(overrides.siteUrl ?? SAMPLE.productionUrl)}`,
		'  hubPath: /example-game/',
		'  title: Example Game Wiki',
		'  shortName: Example Game',
		'  description: test',
		'',
		'game:',
		'  name: Example Game',
	];
	if (deployment) {
		lines.push(
			'',
			'deployment:',
			`  provider: ${yamlQuote(deployment.provider ?? '')}`,
			`  orgId: ${yamlQuote(deployment.orgId ?? '')}`,
			`  projectId: ${yamlQuote(deployment.projectId ?? '')}`,
			`  projectName: ${yamlQuote(deployment.projectName ?? '')}`,
			`  productionUrl: ${yamlQuote(deployment.productionUrl ?? '')}`,
			`  productionBranch: ${yamlQuote(deployment.productionBranch ?? '')}`,
		);
	}
	writeFileSync(path.join(dir, 'site-spec.yaml'), `${lines.join('\n')}\n`);
}

function tempWorkspace(): string {
	mkdirSync(TMP, { recursive: true });
	return mkdtempSync(path.join(TMP, 'gws-deploy-'));
}

test('missing site-spec.yaml blocks deploy', () => {
	const dir = tempWorkspace();
	const result = checkDeploymentIdentity({
		rootDir: dir,
		currentBranch: SAMPLE.productionBranch,
		localLink: null,
	});
	assert.equal(result.ok, false);
	assert.equal(result.blockedReason, 'site-spec.yaml not found');
});

test('complete identity is ready to deploy', () => {
	const dir = tempWorkspace();
	writeSpec(dir);
	const result = checkDeploymentIdentity({
		rootDir: dir,
		currentBranch: SAMPLE.productionBranch,
		localLink: null,
	});
	assert.equal(result.ok, true, result.blockedReason ?? 'expected PASS');
	assert.equal(result.checks.specExists, 'PASS');
	assert.equal(result.checks.provider, 'PASS');
	assert.equal(result.checks.orgId, 'PASS');
	assert.equal(result.checks.projectId, 'PASS');
	assert.equal(result.deployment.projectId, SAMPLE.projectId);
	assert.equal(result.deployment.orgId, PRIMARY_VERCEL_ORG_ID);
});

test('empty orgId defaults to primary team', () => {
	const dir = tempWorkspace();
	writeSpec(dir, { deployment: { orgId: '' } });
	const result = checkDeploymentIdentity({
		rootDir: dir,
		currentBranch: 'any-branch',
		localLink: null,
	});
	assert.equal(result.ok, true, result.blockedReason ?? 'expected PASS');
	assert.equal(result.deployment.orgId, PRIMARY_VERCEL_ORG_ID);
});

test('wrong branch does not block deploy', async () => {
	const dir = tempWorkspace();
	writeSpec(dir);
	const deployCalls: unknown[] = [];
	const outcome = await runDeployCli({
		rootDir: dir,
		currentBranch: 'feat/some-other-game',
		localLink: null,
		deployFn: async () => {
			deployCalls.push('deployed');
			return 0;
		},
	});
	assert.equal(outcome.code, 0);
	assert.equal(outcome.deployed, true);
	assert.equal(deployCalls.length, 1);
});

test('production URL mismatch does not block', () => {
	const dir = tempWorkspace();
	writeSpec(dir, {
		siteUrl: SAMPLE.productionUrl,
		deployment: { productionUrl: 'https://wrong.vercel.app' },
	});
	const result = checkDeploymentIdentity({
		rootDir: dir,
		currentBranch: SAMPLE.productionBranch,
		localLink: null,
	});
	assert.equal(result.ok, true, result.blockedReason ?? 'expected PASS');
});

test('projectName mismatch with local link does not block', async () => {
	const dir = tempWorkspace();
	writeSpec(dir, { deployment: { projectName: 'new-slug-name' } });
	writeLocalVercelLink(dir, {
		orgId: SAMPLE.orgId,
		projectId: SAMPLE.projectId,
		projectName: 'old-historical-name',
	});
	const outcome = await runDeployCli({
		rootDir: dir,
		currentBranch: SAMPLE.productionBranch,
		deployFn: async () => 0,
	});
	assert.equal(outcome.code, 0);
	assert.equal(outcome.deployed, true);
	assert.equal(outcome.relinked, false);
	assert.equal(outcome.result.localLinkStatus, 'MATCH');
});

test('missing projectId blocks and does not use .vercel/project.json', async () => {
	const dir = tempWorkspace();
	writeSpec(dir, { deployment: { projectId: '' } });
	writeLocalVercelLink(dir, SAMPLE);
	const deployCalls: unknown[] = [];
	const outcome = await runDeployCli({
		rootDir: dir,
		currentBranch: SAMPLE.productionBranch,
		deployFn: async () => {
			deployCalls.push('deployed');
			return 0;
		},
	});
	assert.equal(outcome.code, 1);
	assert.equal(outcome.deployed, false);
	assert.equal(deployCalls.length, 0);
	assert.equal(outcome.result.blockedReason, 'incomplete deployment identity');
	assert.match(outcome.result.extraLines.join('\n'), /projectId/);
});

test('local link mismatch rewrites from site-spec target', async () => {
	const dir = tempWorkspace();
	writeSpec(dir);
	const other = {
		orgId: 'team_OTHER',
		projectId: 'prj_OTHER_SITE',
		projectName: 'other-game',
	};
	writeLocalVercelLink(dir, other);

	const check = await runDeployCli({
		rootDir: dir,
		checkOnly: true,
		currentBranch: SAMPLE.productionBranch,
		deployFn: async () => {
			throw new Error('deploy:check must not deploy');
		},
	});
	assert.equal(check.code, 0);
	assert.equal(check.deployed, false);
	assert.equal(check.result.localLinkStatus, 'MISMATCH');
	assert.equal(check.result.deployment.projectId, SAMPLE.projectId);
	assert.match(formatCheckReport(check.result), /local \.vercel link: MISMATCH/i);
	assert.match(formatCheckReport(check.result), /READY TO DEPLOY/);
	assert.match(formatCheckReport(check.result), new RegExp(PRIMARY_VERCEL_TEAM_SLUG));

	const captured: Array<{ env: NodeJS.ProcessEnv }> = [];
	const production = await runDeployCli({
		rootDir: dir,
		currentBranch: SAMPLE.productionBranch,
		deployFn: async (_root, deployment, env) => {
			captured.push({ env });
			assert.equal(deployment.projectId, SAMPLE.projectId);
			assert.equal(env.VERCEL_PROJECT_ID, SAMPLE.projectId);
			assert.equal(env.VERCEL_ORG_ID, SAMPLE.orgId);
			assert.notEqual(env.VERCEL_PROJECT_ID, other.projectId);
			return 0;
		},
	});
	assert.equal(production.code, 0);
	assert.equal(production.deployed, true);
	assert.equal(production.relinked, true);

	const rewritten = JSON.parse(readFileSync(path.join(dir, '.vercel/project.json'), 'utf8')) as {
		projectId: string;
		orgId: string;
	};
	assert.equal(rewritten.projectId, SAMPLE.projectId);
	assert.equal(rewritten.orgId, SAMPLE.orgId);
});

test('deploy:check never invokes the deploy function', async () => {
	const dir = tempWorkspace();
	writeSpec(dir);
	const outcome = await runDeployCli({
		rootDir: dir,
		checkOnly: true,
		currentBranch: SAMPLE.productionBranch,
		localLink: null,
		deployFn: async () => {
			throw new Error('deploy:check must not deploy');
		},
	});
	assert.equal(outcome.code, 0);
	assert.equal(outcome.deployed, false);
});

test('empty projectId cannot fall back to a local Vercel link', async () => {
	const dir = tempWorkspace();
	writeSpec(dir, {
		deployment: {
			provider: 'vercel',
			orgId: '',
			projectId: '',
			projectName: '',
			productionUrl: '',
			productionBranch: '',
		},
	});
	writeLocalVercelLink(dir, SAMPLE);
	const outcome = await runDeployCli({
		rootDir: dir,
		checkOnly: true,
		currentBranch: SAMPLE.productionBranch,
		deployFn: async () => {
			throw new Error('must not deploy');
		},
	});
	assert.equal(outcome.code, 1);
	assert.equal(outcome.result.blockedReason, 'incomplete deployment identity');
	assert.equal(outcome.result.deployment.orgId, PRIMARY_VERCEL_ORG_ID);
});
