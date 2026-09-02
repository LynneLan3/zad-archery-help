#!/usr/bin/env node
/**
 * Deterministic site generator: site-spec.yaml → managed site files.
 *
 * Usage:
 *   npm run site:generate -- --spec site-spec.yaml
 *   npm run site:generate -- --spec site-spec.yaml --dry-run
 *   npm run site:generate -- --spec site-spec.yaml --check
 */
import path from 'node:path';
import {
	DEFAULT_ROOT,
	generateSite,
	printPlan,
	SpecValidationError,
} from './lib/generator';

function parseArgs(argv: string[]) {
	let spec: string | undefined;
	let root = DEFAULT_ROOT;
	let dryRun = false;
	let check = false;

	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i]!;
		if (arg === '--spec') {
			spec = argv[++i];
			continue;
		}
		if (arg.startsWith('--spec=')) {
			spec = arg.slice('--spec='.length);
			continue;
		}
		if (arg === '--root') {
			root = path.resolve(argv[++i] ?? '');
			continue;
		}
		if (arg.startsWith('--root=')) {
			root = path.resolve(arg.slice('--root='.length));
			continue;
		}
		if (arg === '--dry-run') {
			dryRun = true;
			continue;
		}
		if (arg === '--check') {
			check = true;
			continue;
		}
		if (arg === '--help' || arg === '-h') {
			console.log(`Usage: site:generate --spec <path> [--root <dir>] [--dry-run|--check]`);
			process.exit(0);
		}
		throw new Error(`Unknown argument: ${arg}`);
	}

	if (!spec) {
		throw new Error('Missing --spec path/to/site-spec.yaml');
	}
	if (dryRun && check) {
		throw new Error('Use only one of --dry-run or --check.');
	}
	return { spec, root, dryRun, check };
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	const result = generateSite({
		specPath: path.resolve(options.spec),
		rootDir: options.root,
		dryRun: options.dryRun,
		check: options.check,
	});

	if (options.dryRun) {
		printPlan(result.plan);
		console.log('dry-run OK (no files modified)');
		return;
	}

	if (options.check) {
		if (!result.ok) {
			console.error('site:generate --check FAILED — managed files drifted:');
			for (const file of result.drift) {
				console.error(`  • ${file}`);
			}
			console.error('Fix: restore generated files or re-run npm run site:generate after reviewing diffs.');
			process.exit(1);
		}
		console.log('site:generate --check OK');
		return;
	}

	printPlan(result.plan);
	console.log('site:generate OK');
	console.log(`  written: ${result.written.length}`);
	console.log(`  deleted: ${result.deleted.length}`);
	console.log(`  skipped: ${result.skipped.length}`);
}

main().catch((error) => {
	if (error instanceof SpecValidationError || error?.name === 'SpecValidationError') {
		console.error('\nsite:generate FAILED:\n');
		console.error(String(error.message));
		process.exit(1);
	}
	console.error('site:generate crashed:');
	console.error(error);
	process.exit(1);
});
