/**
 * Generated-site validation workflow.
 *
 * Explicitly does NOT run verify:template, test:context, or test:generator.
 */
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { generateSite } from './generator';
import { validateGeneratedHtml } from './validate-generated';
import { MANIFEST_FILENAME } from './site-spec';

export type ValidateGeneratedOptions = {
	/** Run `astro check`. Default true. */
	runAstroCheck?: boolean;
	/** Run `astro build`. Default true. */
	runAstroBuild?: boolean;
};

export type ValidateGeneratedResult = {
	ok: boolean;
	failedStep: string | null;
	message: string | null;
	stepsRun: string[];
};

function fail(stepsRun: string[], failedStep: string, message: string): ValidateGeneratedResult {
	return { ok: false, failedStep, message, stepsRun };
}

function runNpmScript(
	rootDir: string,
	scriptArgs: string[],
	stepsRun: string[],
	stepName: string,
): ValidateGeneratedResult | null {
	stepsRun.push(stepName);
	const result = spawnSync('npm', ['run', ...scriptArgs], {
		cwd: rootDir,
		encoding: 'utf8',
		env: process.env,
	});
	if (result.status !== 0) {
		const detail = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
		return fail(
			stepsRun,
			stepName,
			detail || `${stepName} failed with exit code ${result.status ?? 1}`,
		);
	}
	return null;
}

/**
 * Validate a generated site workspace.
 * Callers must pass an absolute root directory; mode is always generated-site (no guessing).
 */
export function runValidateGenerated(
	rootDir: string,
	options: ValidateGeneratedOptions = {},
): ValidateGeneratedResult {
	const runAstroCheck = options.runAstroCheck !== false;
	const runAstroBuild = options.runAstroBuild !== false;
	const stepsRun: string[] = [];
	const absRoot = path.resolve(rootDir);

	const manifest = path.join(absRoot, MANIFEST_FILENAME);
	stepsRun.push('assert-manifest');
	if (!existsSync(manifest)) {
		return fail(
			stepsRun,
			'assert-manifest',
			[
				`Missing ${MANIFEST_FILENAME}.`,
				'  fix: Run `npm run site:generate -- --spec site-spec.yaml` before validate:generated.',
				'  note: validate:generated never runs verify:template.',
			].join('\n'),
		);
	}

	const specPath = path.join(absRoot, 'site-spec.yaml');
	stepsRun.push('generator-check');
	if (!existsSync(specPath)) {
		return fail(
			stepsRun,
			'generator-check',
			'Missing site-spec.yaml required for generator --check.',
		);
	}
	try {
		const check = generateSite({
			specPath,
			rootDir: absRoot,
			check: true,
		});
		if (!check.ok) {
			return fail(
				stepsRun,
				'generator-check',
				[
					'Generator --check failed: managed output drifted from site-spec.yaml.',
					`  drift: ${check.drift.join(', ') || '(unknown)'}`,
					'  fix: Re-run site:generate or restore managed files. Do not hand-edit generated output.',
				].join('\n'),
			);
		}
	} catch (error) {
		return fail(
			stepsRun,
			'generator-check',
			error instanceof Error ? error.message : String(error),
		);
	}

	const siteResult = runNpmScript(
		absRoot,
		['validate:site', '--', '--mode=generated-site'],
		stepsRun,
		'validate:site:generated-site',
	);
	if (siteResult) return siteResult;

	if (runAstroCheck) {
		const checkResult = runNpmScript(absRoot, ['check'], stepsRun, 'astro-check');
		if (checkResult) return checkResult;
	}

	if (runAstroBuild) {
		const buildResult = runNpmScript(absRoot, ['build'], stepsRun, 'astro-build');
		if (buildResult) return buildResult;
		stepsRun.push('generated-structure');
		try {
			validateGeneratedHtml(absRoot);
		} catch (error) {
			return fail(stepsRun, 'generated-structure', error instanceof Error ? error.message : String(error));
		}
	}

	return { ok: true, failedStep: null, message: null, stepsRun };
}
