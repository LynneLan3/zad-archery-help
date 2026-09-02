import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

/** Default marker value shipped by the template repository. */
export const EXPECTED_REPOSITORY_ID = 'LynneLan3/game-wiki-starter';
export const REPOSITORY_ID_FILENAME = 'REPOSITORY_ID';

export type IdentityMode = 'remote-verified' | 'content-marker-verified' | 'bootstrap-unbound';

export class RepoContextError extends Error {
	constructor(
		message: string,
		readonly field: string,
		readonly value: unknown,
		readonly location: string,
		readonly hint: string,
	) {
		super(
			[
				message,
				`  field: ${field}`,
				`  value: ${stringifyValue(value)}`,
				`  location: ${location}`,
				`  fix: ${hint}`,
			].join('\n'),
		);
		this.name = 'RepoContextError';
	}
}

function stringifyValue(value: unknown): string {
	if (typeof value === 'string') return JSON.stringify(value);
	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}

export interface RepoContextResult {
	ok: boolean;
	identityMode: IdentityMode | null;
	expectedRepositoryId: string;
	verifiedRepositoryId: string | null;
	workBranch: string | null;
	detachedHead: boolean;
	head: string | null;
	sourceBranchIndependentlyVerifiable: boolean;
	warnings: string[];
	errors: string[];
}

const REQUIRED_STRUCTURE = [
	'TEMPLATE_VERSION',
	'AGENTS.md',
	'.agents/skills/create-hotword-wiki/SKILL.md',
	'scripts/generate-site.ts',
	'scripts/validate-site.mjs',
	'site-spec.example.yaml',
	'package.json',
	REPOSITORY_ID_FILENAME,
] as const;

const REQUIRED_SCRIPTS = [
	'site:generate',
	'validate',
	'validate:template',
	'validate:generated',
	'test:generator',
	'verify:context',
] as const;

const BOOTSTRAP_REQUIRED_STRUCTURE = [
	'package.json',
	'scripts/generate-site.ts',
	'scripts/validate-site.mjs',
	'src/config/game.ts',
	'src/content.config.ts',
	'astro.config.mjs',
] as const;

const BOOTSTRAP_REQUIRED_SCRIPTS = ['site:generate', 'validate', 'validate:generated'] as const;

function runGit(rootDir: string, args: string[]): { status: number; stdout: string; stderr: string } {
	const result = spawnSync('git', args, {
		cwd: rootDir,
		encoding: 'utf8',
		env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
	});
	return {
		status: result.status ?? 1,
		stdout: (result.stdout ?? '').trim(),
		stderr: (result.stderr ?? '').trim(),
	};
}

/** Normalize common GitHub SSH/HTTPS clone URLs to `owner/name`. */
export function normalizeGitHubRepositoryId(remoteUrl: string): string | null {
	const raw = remoteUrl.trim();
	if (!raw) return null;

	const withoutGitSuffix = raw.replace(/\.git$/i, '');

	const sshMatch = withoutGitSuffix.match(/^git@github\.com:([^/]+)\/([^/]+)$/i);
	if (sshMatch) return `${sshMatch[1]}/${sshMatch[2]}`;

	const sshAlt = withoutGitSuffix.match(/^ssh:\/\/git@github\.com\/([^/]+)\/([^/]+)$/i);
	if (sshAlt) return `${sshAlt[1]}/${sshAlt[2]}`;

	try {
		const withProtocol = /^https?:\/\//i.test(withoutGitSuffix)
			? withoutGitSuffix
			: withoutGitSuffix.startsWith('github.com/')
				? `https://${withoutGitSuffix}`
				: null;
		if (withProtocol) {
			const url = new URL(withProtocol);
			if (!/^(www\.)?github\.com$/i.test(url.hostname)) return null;
			const parts = url.pathname.replace(/^\/+|\/+$/g, '').split('/');
			if (parts.length >= 2 && parts[0] && parts[1]) {
				return `${parts[0]}/${parts[1]}`;
			}
		}
	} catch {
		return null;
	}

	return null;
}

function readRepositoryMarker(rootDir: string): string | null {
	const file = path.join(rootDir, REPOSITORY_ID_FILENAME);
	if (!existsSync(file)) return null;
	const marker = readFileSync(file, 'utf8').trim();
	return marker || null;
}

function assertRequiredStructure(rootDir: string, errors: string[], repositoryId: string | null): void {
	const required =
		repositoryId === EXPECTED_REPOSITORY_ID
			? REQUIRED_STRUCTURE
			: REQUIRED_STRUCTURE.filter(
					(rel) =>
						rel !== 'TEMPLATE_VERSION' &&
						rel !== 'AGENTS.md' &&
						rel !== '.agents/skills/create-hotword-wiki/SKILL.md' &&
						rel !== 'site-spec.example.yaml',
				);

	for (const rel of required) {
		if (!existsSync(path.join(rootDir, rel))) {
			errors.push(`Missing required path: ${rel}`);
		}
	}

	const packagePath = path.join(rootDir, 'package.json');
	if (!existsSync(packagePath)) return;
	try {
		const pkg = JSON.parse(readFileSync(packagePath, 'utf8')) as {
			scripts?: Record<string, string>;
		};
		const scripts = pkg.scripts ?? {};
		for (const name of REQUIRED_SCRIPTS) {
			if (!scripts[name]) {
				errors.push(`package.json is missing required script: ${name}`);
			}
		}
	} catch (error) {
		errors.push(`package.json could not be parsed: ${String(error)}`);
	}
}

function readWorkBranchAndHead(rootDir: string): {
	workBranch: string | null;
	detachedHead: boolean;
	head: string | null;
	errors: string[];
} {
	const errors: string[] = [];
	const headResult = runGit(rootDir, ['rev-parse', 'HEAD']);
	if (headResult.status !== 0 || !/^[0-9a-f]{40}$/i.test(headResult.stdout)) {
		errors.push('Valid Git HEAD is required for repository context verification.');
		return { workBranch: null, detachedHead: false, head: null, errors };
	}

	const symbolic = runGit(rootDir, ['symbolic-ref', '-q', '--short', 'HEAD']);
	if (symbolic.status === 0 && symbolic.stdout) {
		return {
			workBranch: symbolic.stdout,
			detachedHead: false,
			head: headResult.stdout,
			errors,
		};
	}

	// Detached HEAD or unusual states are acceptable for Codex Cloud.
	return {
		workBranch: null,
		detachedHead: true,
		head: headResult.stdout,
		errors,
	};
}

function isGitWorkTree(rootDir: string): boolean {
	if (runGit(rootDir, ['rev-parse', '--is-inside-work-tree']).stdout !== 'true') return false;
	const topLevel = runGit(rootDir, ['rev-parse', '--show-toplevel']).stdout;
	return topLevel !== '' && path.resolve(topLevel) === path.resolve(rootDir);
}

function assertBootstrapStructure(rootDir: string, errors: string[]): void {
	for (const rel of BOOTSTRAP_REQUIRED_STRUCTURE) {
		if (!existsSync(path.join(rootDir, rel))) {
			errors.push(`Missing required bootstrap path: ${rel}`);
		}
	}

	const packagePath = path.join(rootDir, 'package.json');
	if (!existsSync(packagePath)) return;
	try {
		const pkg = JSON.parse(readFileSync(packagePath, 'utf8')) as {
			scripts?: Record<string, string>;
		};
		const scripts = pkg.scripts ?? {};
		for (const name of BOOTSTRAP_REQUIRED_SCRIPTS) {
			if (!scripts[name]) {
				errors.push(`package.json is missing required bootstrap script: ${name}`);
			}
		}
	} catch (error) {
		errors.push(`package.json could not be parsed: ${String(error)}`);
	}
}

function listRemotes(rootDir: string): Array<{ name: string; url: string }> {
	const result = runGit(rootDir, ['remote', '-v']);
	if (result.status !== 0 || !result.stdout) return [];
	const remotes: Array<{ name: string; url: string }> = [];
	const seen = new Set<string>();
	for (const line of result.stdout.split(/\r?\n/)) {
		const match = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/);
		if (!match) continue;
		const key = `${match[1]}|${match[2]}`;
		if (seen.has(key)) continue;
		seen.add(key);
		remotes.push({ name: match[1]!, url: match[2]! });
	}
	return remotes;
}

/**
 * Deterministic repository-context precheck.
 * Does not require site-spec.yaml. Does not mutate the workspace, remotes, or git config.
 */
export function verifyRepoContext(rootDir: string): RepoContextResult {
	const warnings: string[] = [];
	const errors: string[] = [];
	const repositoryMarker = readRepositoryMarker(rootDir);
	const expectedRepositoryId = repositoryMarker ?? EXPECTED_REPOSITORY_ID;

	assertRequiredStructure(rootDir, errors, repositoryMarker);
	const branchInfo = readWorkBranchAndHead(rootDir);
	errors.push(...branchInfo.errors);

	const remotes = listRemotes(rootDir);
	const origin = remotes.find((remote) => remote.name === 'origin') ?? remotes[0];

	let identityMode: IdentityMode | null = null;
	let verifiedRepositoryId: string | null = null;
	let sourceBranchIndependentlyVerifiable = false;

	if (origin) {
		const normalized = normalizeGitHubRepositoryId(origin.url);
		if (!normalized) {
			errors.push(
				`Unable to normalize Git remote URL to a GitHub repository id: ${origin.url}`,
			);
		} else if (repositoryMarker === null) {
			errors.push(
				[
					'Git remote is present but REPOSITORY_ID marker is missing.',
					`  field: ${REPOSITORY_ID_FILENAME}`,
					`  value: null`,
					`  location: ${REPOSITORY_ID_FILENAME}`,
					'  fix: Add REPOSITORY_ID with the exact GitHub owner/repository identity.',
				].join('\n'),
			);
		} else if (normalized !== repositoryMarker) {
			errors.push(
				[
					'Git remote points at a different repository.',
					`  field: remote`,
					`  value: ${JSON.stringify(origin.url)}`,
					`  location: git remote (${origin.name})`,
					`  fix: Set ${REPOSITORY_ID_FILENAME} to the exact normalized remote identity.`,
				].join('\n'),
			);
		} else {
			identityMode = 'remote-verified';
			verifiedRepositoryId = normalized;
			sourceBranchIndependentlyVerifiable = Boolean(
				branchInfo.workBranch && branchInfo.workBranch !== 'work',
			);
		}
	} else {
		const marker = repositoryMarker;
		if (marker === null) {
			errors.push(
				[
					'Git remote is unavailable and REPOSITORY_ID marker is missing.',
					`  field: ${REPOSITORY_ID_FILENAME}`,
					`  value: null`,
					`  location: ${REPOSITORY_ID_FILENAME}`,
					`  fix: Restore ${REPOSITORY_ID_FILENAME} with exact contents "${expectedRepositoryId}". Do not invent a remote.`,
				].join('\n'),
			);
		} else if (errors.length === 0) {
			identityMode = 'content-marker-verified';
			verifiedRepositoryId = marker;
			sourceBranchIndependentlyVerifiable = false;
			warnings.push(
				'Git remote is unavailable in this Codex Cloud task; repository identity was verified using the repository marker and required template structure.',
			);
		}
	}

	const ok = errors.length === 0 && identityMode !== null;
	return {
		ok,
		identityMode: ok ? identityMode : null,
		expectedRepositoryId,
		verifiedRepositoryId: ok ? verifiedRepositoryId : null,
		workBranch: branchInfo.workBranch,
		detachedHead: branchInfo.detachedHead,
		head: branchInfo.head,
		sourceBranchIndependentlyVerifiable: ok ? sourceBranchIndependentlyVerifiable : false,
		warnings,
		errors,
	};
}

/**
 * Read-only precheck for a new generated-site workspace before its first commit.
 * It deliberately does not establish or infer repository identity.
 */
export function verifyRepoBootstrap(rootDir: string): RepoContextResult {
	const errors: string[] = [];
	const warnings: string[] = [];
	const repositoryMarker = readRepositoryMarker(rootDir);
	const remotes = listRemotes(rootDir);
	const hasHead = runGit(rootDir, ['rev-parse', '--verify', 'HEAD']).status === 0;

	if (!isGitWorkTree(rootDir)) {
		errors.push('An initialized Git repository is required for bootstrap verification.');
	}
	if (hasHead) {
		errors.push('Bootstrap verification requires an unborn HEAD with no commits.');
	}
	if (remotes.length > 0) {
		errors.push('Bootstrap verification requires no Git remote; repository identity is not yet bound.');
	}
	if (repositoryMarker !== null) {
		errors.push(
		`Bootstrap verification requires no ${REPOSITORY_ID_FILENAME} marker; an existing marker is a bound-identity claim.`,
	);
	}
	assertBootstrapStructure(rootDir, errors);

	const ok = errors.length === 0;
	return {
		ok,
		identityMode: ok ? 'bootstrap-unbound' : null,
		expectedRepositoryId: 'unbound',
		verifiedRepositoryId: null,
		workBranch: isGitWorkTree(rootDir)
			? runGit(rootDir, ['symbolic-ref', '-q', '--short', 'HEAD']).stdout || null
			: null,
		detachedHead: false,
		head: null,
		sourceBranchIndependentlyVerifiable: false,
		warnings,
		errors,
	};
}

export function formatRepoContextReport(result: RepoContextResult): string {
	const lines = [
		'verify:context',
		`  ok: ${result.ok}`,
		`  identityMode: ${result.identityMode ?? 'none'}`,
		`  expectedRepositoryId: ${result.expectedRepositoryId}`,
		`  verifiedRepositoryId: ${result.verifiedRepositoryId ?? 'none'}`,
		`  workBranch: ${result.workBranch ?? '(detached)'}`,
		`  detachedHead: ${result.detachedHead}`,
		`  head: ${result.head ?? 'none'}`,
		`  sourceBranchIndependentlyVerifiable: ${result.sourceBranchIndependentlyVerifiable}`,
	];
	for (const warning of result.warnings) {
		lines.push(`  warning: ${warning}`);
	}
	for (const error of result.errors) {
		lines.push(`  error: ${error}`);
	}
	return lines.join('\n');
}

export function formatRepoBootstrapReport(result: RepoContextResult): string {
	const lines = [
		'verify:bootstrap',
		`  ok: ${result.ok}`,
		`  identityMode: ${result.identityMode ?? 'none'}`,
		'  repository identity: unbound',
		'  commit/push/deploy: blocked until a later binding/release phase',
	];
	for (const warning of result.warnings) lines.push(`  warning: ${warning}`);
	for (const error of result.errors) lines.push(`  error: ${error}`);
	return lines.join('\n');
}
