import assert from 'node:assert/strict';
import {
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
	EXPECTED_REPOSITORY_ID,
	normalizeGitHubRepositoryId,
	verifyRepoBootstrap,
	verifyRepoContext,
} from '../../scripts/lib/verify-repo-context';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function tmpRoot(): string {
	mkdirSync(path.join(ROOT, 'tmp'), { recursive: true });
	return mkdtempSync(path.join(ROOT, 'tmp', 'repo-context-'));
}

function git(cwd: string, args: string[]) {
	const result = spawnSync('git', args, {
		cwd,
		encoding: 'utf8',
		env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
	});
	assert.equal(result.status, 0, result.stderr || result.stdout);
	return result.stdout.trim();
}

function seedMinimalTemplate(dir: string, opts?: { repositoryId?: string | null; omit?: string[] }) {
	const omit = new Set(opts?.omit ?? []);
	const files: Record<string, string> = {
		'TEMPLATE_VERSION': '1.0.0\n',
		'AGENTS.md': '# AGENTS\n',
		'.agents/skills/create-hotword-wiki/SKILL.md': '---\nname: create-hotword-wiki\n---\n',
		'scripts/generate-site.ts': 'export {};\n',
		'scripts/validate-site.mjs': 'console.log("ok");\n',
		'src/config/game.ts': 'export {};\n',
		'src/content.config.ts': 'export {};\n',
		'astro.config.mjs': 'export default {};\n',
		'site-spec.example.yaml': 'schemaVersion: 1\n',
		'package.json': JSON.stringify(
			{
				name: 'game-wiki-starter',
				scripts: {
					'site:generate': 'tsx ./scripts/generate-site.ts',
					validate: 'echo validate',
					'validate:template': 'echo validate-template',
					'validate:generated': 'echo validate-generated',
					'test:generator': 'echo test',
					'verify:context': 'tsx ./scripts/verify-context.ts',
					'verify:bootstrap': 'tsx ./scripts/verify-bootstrap.ts',
				},
			},
			null,
			2,
		) + '\n',
	};
	if (opts?.repositoryId !== null) {
		files['REPOSITORY_ID'] = `${opts?.repositoryId ?? EXPECTED_REPOSITORY_ID}\n`;
	}
	for (const [rel, body] of Object.entries(files)) {
		if (omit.has(rel)) continue;
		const abs = path.join(dir, rel);
		mkdirSync(path.dirname(abs), { recursive: true });
		writeFileSync(abs, body, 'utf8');
	}
}

function initGitRepo(dir: string, branch = 'main') {
	git(dir, ['init']);
	git(dir, ['config', 'user.email', 'test@example.com']);
	git(dir, ['config', 'user.name', 'Context Test']);
	git(dir, ['add', '.']);
	git(dir, ['commit', '-m', 'init']);
	if (branch !== 'main' && branch !== 'master') {
		git(dir, ['branch', '-M', branch]);
	} else {
		// Ensure predictable branch name.
		const current = git(dir, ['branch', '--show-current']);
		if (current && current !== branch) git(dir, ['branch', '-M', branch]);
	}
}

test('normalize GitHub SSH and HTTPS remotes', () => {
	assert.equal(
		normalizeGitHubRepositoryId('git@github.com:LynneLan3/game-wiki-starter.git'),
		'LynneLan3/game-wiki-starter',
	);
	assert.equal(
		normalizeGitHubRepositoryId('https://github.com/LynneLan3/game-wiki-starter.git'),
		'LynneLan3/game-wiki-starter',
	);
	assert.equal(
		normalizeGitHubRepositoryId('https://github.com/LynneLan3/game-wiki-starter'),
		'LynneLan3/game-wiki-starter',
	);
	assert.equal(
		normalizeGitHubRepositoryId('ssh://git@github.com/LynneLan3/game-wiki-starter.git'),
		'LynneLan3/game-wiki-starter',
	);
	assert.equal(normalizeGitHubRepositoryId('git@github.com:other/repo.git'), 'other/repo');
});

test('bootstrap: unborn Git repo + valid V2 structure + no identity binding → pass', () => {
	const dir = tmpRoot();
	try {
		seedMinimalTemplate(dir, { repositoryId: null });
		git(dir, ['init']);
		const result = verifyRepoBootstrap(dir);
		assert.equal(result.ok, true);
		assert.equal(result.identityMode, 'bootstrap-unbound');
		assert.equal(result.verifiedRepositoryId, null);
		assert.equal(result.expectedRepositoryId, 'unbound');
		const cli = spawnSync(
			'npx',
			['tsx', path.join(ROOT, 'scripts/verify-bootstrap.ts'), '--root', dir],
			{ cwd: ROOT, encoding: 'utf8' },
		);
		assert.equal(cli.status, 0, cli.stdout + cli.stderr);
		assert.match(cli.stdout, /identityMode: bootstrap-unbound/);
		assert.match(cli.stdout, /repository identity: unbound/);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test('bootstrap: the same unborn repo remains strict under verify:context', () => {
	const dir = tmpRoot();
	try {
		seedMinimalTemplate(dir, { repositoryId: null });
		git(dir, ['init']);
		const result = verifyRepoContext(dir);
		assert.equal(result.ok, false);
		assert.ok(result.errors.some((error) => /valid Git HEAD is required/i.test(error)));
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test('bootstrap: non-Git directory → fail', () => {
	const dir = tmpRoot();
	try {
		seedMinimalTemplate(dir, { repositoryId: null });
		const result = verifyRepoBootstrap(dir);
		assert.equal(result.ok, false);
		assert.ok(result.errors.some((error) => /initialized Git repository/i.test(error)));
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test('bootstrap: existing remote or marker is never treated as unbound-safe', () => {
	for (const setup of ['remote', 'marker'] as const) {
		const dir = tmpRoot();
		try {
			seedMinimalTemplate(dir, {
				repositoryId: setup === 'marker' ? 'LynneLan3/serious-sam-shatterverse' : null,
			});
			git(dir, ['init']);
			if (setup === 'remote') {
				git(dir, ['remote', 'add', 'origin', 'git@github.com:LynneLan3/inferred.git']);
			}
			const result = verifyRepoBootstrap(dir);
			assert.equal(result.ok, false, setup);
			assert.notEqual(result.identityMode, 'bootstrap-unbound', setup);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	}
});

test('bootstrap: site identity is never inferred from site.id or local files', () => {
	const dir = tmpRoot();
	try {
		seedMinimalTemplate(dir, { repositoryId: null });
		writeFileSync(path.join(dir, 'site-spec.yaml'), 'site:\n  id: serious-sam-shatterverse\n', 'utf8');
		git(dir, ['init']);
		const result = verifyRepoBootstrap(dir);
		assert.equal(result.ok, true);
		assert.equal(result.verifiedRepositoryId, null);
		assert.equal(result.identityMode, 'bootstrap-unbound');
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test('1. correct SSH remote → remote-verified', () => {
	const dir = tmpRoot();
	try {
		seedMinimalTemplate(dir);
		initGitRepo(dir, 'feat/example');
		git(dir, ['remote', 'add', 'origin', 'git@github.com:LynneLan3/game-wiki-starter.git']);
		const result = verifyRepoContext(dir);
		assert.equal(result.ok, true);
		assert.equal(result.identityMode, 'remote-verified');
		assert.equal(result.verifiedRepositoryId, EXPECTED_REPOSITORY_ID);
		assert.equal(result.workBranch, 'feat/example');
		assert.equal(result.detachedHead, false);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test('2. correct HTTPS remote → remote-verified', () => {
	const dir = tmpRoot();
	try {
		seedMinimalTemplate(dir);
		initGitRepo(dir, 'feat/example');
		git(dir, ['remote', 'add', 'origin', 'https://github.com/LynneLan3/game-wiki-starter.git']);
		const result = verifyRepoContext(dir);
		assert.equal(result.ok, true);
		assert.equal(result.identityMode, 'remote-verified');
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test('3. no remote + work branch + correct marker → content-marker-verified with warning', () => {
	const dir = tmpRoot();
	try {
		seedMinimalTemplate(dir);
		initGitRepo(dir, 'work');
		const beforeRemote = spawnSync('git', ['remote', '-v'], { cwd: dir, encoding: 'utf8' });
		assert.equal((beforeRemote.stdout ?? '').trim(), '');
		const result = verifyRepoContext(dir);
		assert.equal(result.ok, true);
		assert.equal(result.identityMode, 'content-marker-verified');
		assert.equal(result.workBranch, 'work');
		assert.equal(result.sourceBranchIndependentlyVerifiable, false);
		assert.ok(
			result.warnings.some((warning) =>
				warning.includes('Git remote is unavailable in this Codex Cloud task'),
			),
		);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test('4. no remote + detached HEAD + correct marker → pass', () => {
	const dir = tmpRoot();
	try {
		seedMinimalTemplate(dir);
		initGitRepo(dir, 'work');
		const head = git(dir, ['rev-parse', 'HEAD']);
		git(dir, ['checkout', '--detach', head]);
		const result = verifyRepoContext(dir);
		assert.equal(result.ok, true);
		assert.equal(result.identityMode, 'content-marker-verified');
		assert.equal(result.detachedHead, true);
		assert.equal(result.workBranch, null);
		assert.equal(result.head, head);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test('5. remote pointing at another repo → fail, no content-marker fallback', () => {
	const dir = tmpRoot();
	try {
		seedMinimalTemplate(dir);
		initGitRepo(dir, 'work');
		git(dir, ['remote', 'add', 'origin', 'git@github.com:other-org/other-repo.git']);
		const result = verifyRepoContext(dir);
		assert.equal(result.ok, false);
		assert.equal(result.identityMode, null);
		assert.ok(result.errors.some((error) => /different repository/i.test(error)));
		assert.ok(!result.warnings.some((warning) => /content-marker/i.test(warning)));
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test('5.1 REPOSITORY_ID marker defines the expected generated-site identity', () => {
	const dir = tmpRoot();
	try {
		const repositoryId = 'LynneLan3/generated-site';
		seedMinimalTemplate(dir, { repositoryId });
		initGitRepo(dir, 'feat/generated-site');
		git(dir, ['remote', 'add', 'origin', `https://github.com/${repositoryId}.git`]);
		const result = verifyRepoContext(dir);
		assert.equal(result.ok, true);
		assert.equal(result.expectedRepositoryId, repositoryId);
		assert.equal(result.verifiedRepositoryId, repositoryId);
		assert.equal(result.identityMode, 'remote-verified');
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test('5.2 generated-site identity does not require template-only files', () => {
	const dir = tmpRoot();
	try {
		const repositoryId = 'LynneLan3/generated-site';
		seedMinimalTemplate(dir, {
			repositoryId,
			omit: ['TEMPLATE_VERSION', 'AGENTS.md', '.agents/skills/create-hotword-wiki/SKILL.md', 'site-spec.example.yaml'],
		});
		initGitRepo(dir, 'feat/generated-site');
		git(dir, ['remote', 'add', 'origin', `https://github.com/${repositoryId}.git`]);
		const result = verifyRepoContext(dir);
		assert.equal(result.ok, true);
		assert.equal(result.verifiedRepositoryId, repositoryId);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test('6. no remote + missing REPOSITORY_ID → fail', () => {
	const dir = tmpRoot();
	try {
		seedMinimalTemplate(dir, { repositoryId: null });
		initGitRepo(dir, 'work');
		const result = verifyRepoContext(dir);
		assert.equal(result.ok, false);
		assert.ok(result.errors.some((error) => /REPOSITORY_ID marker is missing/i.test(error)));
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test('7. no remote + generated-site REPOSITORY_ID → marker verification passes', () => {
	const dir = tmpRoot();
	try {
		const repositoryId = 'SomeoneElse/generated-site';
		seedMinimalTemplate(dir, { repositoryId });
		initGitRepo(dir, 'work');
		const result = verifyRepoContext(dir);
		assert.equal(result.ok, true);
		assert.equal(result.expectedRepositoryId, repositoryId);
		assert.equal(result.verifiedRepositoryId, repositoryId);
		assert.equal(result.identityMode, 'content-marker-verified');
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test('8. missing TEMPLATE_VERSION / structure → fail', () => {
	const dir = tmpRoot();
	try {
		seedMinimalTemplate(dir, { omit: ['TEMPLATE_VERSION'] });
		initGitRepo(dir, 'work');
		const result = verifyRepoContext(dir);
		assert.equal(result.ok, false);
		assert.ok(result.errors.some((error) => /Missing required path: TEMPLATE_VERSION/.test(error)));
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test('9. context ok without site-spec; input stage remains separate', () => {
	const dir = tmpRoot();
	try {
		seedMinimalTemplate(dir);
		initGitRepo(dir, 'work');
		assert.equal(existsSync(path.join(dir, 'site-spec.yaml')), false);
		const result = verifyRepoContext(dir);
		assert.equal(result.ok, true);
		assert.equal(result.identityMode, 'content-marker-verified');
		// Simulate next-stage input failure without treating it as identity failure.
		assert.equal(existsSync(path.join(dir, 'site-spec.yaml')), false);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test('10. precheck does not mutate workspace, remotes, or git config', () => {
	const dir = tmpRoot();
	try {
		seedMinimalTemplate(dir);
		initGitRepo(dir, 'work');
		const beforeFiles = spawnSync('git', ['status', '--porcelain'], { cwd: dir, encoding: 'utf8' });
		const beforeRemotes = spawnSync('git', ['remote', '-v'], { cwd: dir, encoding: 'utf8' });
		const beforeConfig = spawnSync('git', ['config', '--local', '--list'], { cwd: dir, encoding: 'utf8' });
		const markerBefore = readFileSync(path.join(dir, 'REPOSITORY_ID'), 'utf8');

		const result = verifyRepoContext(dir);
		assert.equal(result.ok, true);

		const afterFiles = spawnSync('git', ['status', '--porcelain'], { cwd: dir, encoding: 'utf8' });
		const afterRemotes = spawnSync('git', ['remote', '-v'], { cwd: dir, encoding: 'utf8' });
		const afterConfig = spawnSync('git', ['config', '--local', '--list'], { cwd: dir, encoding: 'utf8' });
		const markerAfter = readFileSync(path.join(dir, 'REPOSITORY_ID'), 'utf8');

		assert.equal(afterFiles.stdout, beforeFiles.stdout);
		assert.equal(afterRemotes.stdout, beforeRemotes.stdout);
		assert.equal(afterConfig.stdout, beforeConfig.stdout);
		assert.equal(markerAfter, markerBefore);
		assert.equal((afterRemotes.stdout ?? '').trim(), '');
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test('Cloud scenario simulation: no remote, work branch, marker + structure', () => {
	const dir = tmpRoot();
	try {
		// Real-structure stand-in: required template files + valid HEAD on `work`, no remotes.
		seedMinimalTemplate(dir);
		cpSync(path.join(ROOT, 'TEMPLATE_VERSION'), path.join(dir, 'TEMPLATE_VERSION'));
		initGitRepo(dir, 'work');

		const beforeRemotes = spawnSync('git', ['remote', '-v'], { cwd: dir, encoding: 'utf8' });
		const beforeStatus = spawnSync('git', ['status', '--porcelain'], { cwd: dir, encoding: 'utf8' });
		const beforeConfig = spawnSync('git', ['config', '--local', '--list'], { cwd: dir, encoding: 'utf8' });
		const markerBefore = readFileSync(path.join(dir, 'REPOSITORY_ID'), 'utf8');
		assert.equal((beforeRemotes.stdout ?? '').trim(), '');
		assert.equal(git(dir, ['branch', '--show-current']), 'work');
		assert.match(git(dir, ['rev-parse', 'HEAD']), /^[0-9a-f]{40}$/);

		const api = verifyRepoContext(dir);
		assert.equal(api.ok, true);
		assert.equal(api.identityMode, 'content-marker-verified');
		assert.equal(api.verifiedRepositoryId, EXPECTED_REPOSITORY_ID);
		assert.equal(api.sourceBranchIndependentlyVerifiable, false);
		assert.equal(api.workBranch, 'work');
		assert.ok(
			api.warnings.some((warning) =>
				warning.includes('Git remote is unavailable in this Codex Cloud task'),
			),
		);

		const cli = spawnSync('npx', ['tsx', path.join(ROOT, 'scripts/verify-context.ts'), '--root', dir], {
			cwd: ROOT,
			encoding: 'utf8',
		});
		assert.equal(cli.status, 0, cli.stdout + cli.stderr);
		assert.match(cli.stdout, /identityMode: content-marker-verified/);
		assert.match(cli.stdout, /Git remote is unavailable in this Codex Cloud task/);
		assert.match(cli.stdout, /verify:context OK/);

		const afterRemotes = spawnSync('git', ['remote', '-v'], { cwd: dir, encoding: 'utf8' });
		const afterStatus = spawnSync('git', ['status', '--porcelain'], { cwd: dir, encoding: 'utf8' });
		const afterConfig = spawnSync('git', ['config', '--local', '--list'], { cwd: dir, encoding: 'utf8' });
		const markerAfter = readFileSync(path.join(dir, 'REPOSITORY_ID'), 'utf8');
		assert.equal(afterRemotes.stdout, beforeRemotes.stdout);
		assert.equal(afterStatus.stdout, beforeStatus.stdout);
		assert.equal(afterConfig.stdout, beforeConfig.stdout);
		assert.equal(markerAfter, markerBefore);
		assert.equal((afterRemotes.stdout ?? '').trim(), '');
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test('current repository context passes using the available identity mode', () => {
	const remotes = spawnSync('git', ['remote', '-v'], {
		cwd: ROOT,
		encoding: 'utf8',
		env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
	});
	assert.equal(remotes.status, 0, remotes.stderr || remotes.stdout);
	const hasRemote = (remotes.stdout ?? '').trim().length > 0;
	const expectedMode = hasRemote ? 'remote-verified' : 'content-marker-verified';

	const result = verifyRepoContext(ROOT);
	const detail = [
		`remotePresent=${hasRemote}`,
		`expectedMode=${expectedMode}`,
		`actualMode=${result.identityMode ?? 'none'}`,
	].join('; ');

	assert.equal(result.ok, true, `context verification failed (${detail})`);
	assert.equal(
		result.identityMode,
		expectedMode,
		`identity mode mismatch (${detail})`,
	);
	assert.equal(result.verifiedRepositoryId, EXPECTED_REPOSITORY_ID, detail);

	if (hasRemote) {
		assert.equal(
			result.sourceBranchIndependentlyVerifiable,
			Boolean(result.workBranch && result.workBranch !== 'work'),
			detail,
		);
		assert.notEqual(
			result.identityMode,
			'content-marker-verified',
			`must not degrade to content-marker-verified when a remote exists (${detail})`,
		);
		assert.ok(
			!result.warnings.some((warning) =>
				warning.includes('Git remote is unavailable in this Codex Cloud task'),
			),
			`must not emit Cloud remote-unavailable warning when remotes exist (${detail})`,
		);
	} else {
		assert.equal(result.sourceBranchIndependentlyVerifiable, false, detail);
		assert.ok(
			result.warnings.some((warning) =>
				warning.includes('Git remote is unavailable in this Codex Cloud task'),
			),
			`expected Codex Cloud / remote-unavailable warning (${detail})`,
		);
		assert.equal(
			readFileSync(path.join(ROOT, 'REPOSITORY_ID'), 'utf8').trim(),
			EXPECTED_REPOSITORY_ID,
			`identity must come from REPOSITORY_ID when remotes are absent (${detail})`,
		);
		const remotesAfter = spawnSync('git', ['remote', '-v'], {
			cwd: ROOT,
			encoding: 'utf8',
			env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
		});
		assert.equal((remotesAfter.stdout ?? '').trim(), '', `must not add remotes (${detail})`);
	}
});
