#!/usr/bin/env node
/**
 * Hotword OS Publishing Completion V1.
 *
 * This is the standard production entry point. `deploy:production` and
 * `indexnow` remain low-level primitives and are called by this orchestrator.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	checkDeploymentIdentity,
	normalizePublicUrl,
	readSiteSpecDocument,
	runDeployCli,
	spawnVercelDeploy,
} from './lib/deployment-identity.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const RECEIPT_SCHEMA_VERSION = 'hotword-publish-receipt-v1';
export const LEDGER_SCRIPT = '/Users/lanling/Code/hot_words_websites/gsc_hotword_monitor/scripts/record-publish-receipt.mjs';

function asString(value) {
	return value === undefined || value === null ? '' : String(value).trim();
}

function isRecord(value) {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseJsonFile(receiptPath) {
	const absolutePath = path.resolve(receiptPath);
	let parsed;
	try {
		parsed = JSON.parse(readFileSync(absolutePath, 'utf8'));
	} catch (error) {
		throw new Error(`cannot read receipt JSON: ${error.message}`);
	}
	return { absolutePath, receipt: parsed };
}

export function validateReceiptMinimum(receipt) {
	const errors = [];
	if (!isRecord(receipt)) errors.push('receipt must be a JSON object');
	if (receipt?.schemaVersion !== RECEIPT_SCHEMA_VERSION) {
		errors.push(`schemaVersion must be ${RECEIPT_SCHEMA_VERSION}`);
	}
	const common = receipt?.common;
	if (!isRecord(common)) {
		errors.push('common is required');
	} else {
		for (const field of ['site', 'siteId', 'game', 'batchId']) {
			if (!asString(common[field])) errors.push(`common.${field} is required`);
		}
	}
	if (!Array.isArray(receipt?.interventions) || receipt.interventions.length === 0) {
		errors.push('interventions must be a non-empty array');
	} else {
		receipt.interventions.forEach((intervention, index) => {
			if (!isRecord(intervention)) {
				errors.push(`interventions[${index}] must be an object`);
				return;
			}
			if (!asString(intervention.primaryUrl)) errors.push(`interventions[${index}].primaryUrl is required`);
			const action = asString(intervention.action).toUpperCase();
			const taskId = asString(intervention.developmentTaskId) || asString(common?.developmentTaskId);
			if (!action && !taskId) errors.push(`interventions[${index}].action is required unless developmentTaskId is provided`);
		});
	}
	if (errors.length) {
		throw new Error(`invalid minimum receipt schema:\n- ${errors.join('\n- ')}`);
	}
	return true;
}

function normalizeUrl(value, baseUrl) {
	const parsed = new URL(value, baseUrl);
	return normalizePublicUrl(parsed.href);
}

function sameOrigin(value, originUrl) {
	return new URL(value).origin === new URL(originUrl).origin;
}

export function buildProductionUrls(receipt, productionUrl) {
	const primary = receipt.interventions.map((item) => asString(item.primaryUrl)).filter(Boolean);
	const affected = receipt.interventions.flatMap((item) => Array.isArray(item.affectedUrls) ? item.affectedUrls : []);
	const candidates = [productionUrl, ...primary, ...affected];
	const urls = [];
	const seen = new Set();
	for (const candidate of candidates) {
		const normalized = normalizeUrl(candidate, productionUrl);
		if (!sameOrigin(normalized, productionUrl) || seen.has(normalized)) continue;
		seen.add(normalized);
		urls.push(normalized);
	}
	return urls;
}

export function buildVerificationUrls(receipt, productionUrl) {
	return buildProductionUrls(receipt, productionUrl);
}

function readIndexNowEnabled(document) {
	const indexing = isRecord(document?.indexing) ? document.indexing : {};
	if (typeof indexing.indexnow_enabled === 'boolean') return indexing.indexnow_enabled;
	if (typeof indexing.indexnowEnabled === 'boolean') return indexing.indexnowEnabled;
	return true;
}

function canonicalFromHtml(html, pageUrl) {
	const tags = String(html || '').match(/<link\b[^>]*>/gi) || [];
	for (const tag of tags) {
		const rel = tag.match(/\brel\s*=\s*["']([^"']+)["']/i)?.[1] || '';
		if (!rel.split(/\s+/).map((item) => item.toLowerCase()).includes('canonical')) continue;
		const href = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
		if (href) return normalizeUrl(href, pageUrl);
	}
	return null;
}

export async function verifyProductionUrls(urls, options = {}) {
	const fetchImpl = options.fetchImpl ?? globalThis.fetch;
	if (typeof fetchImpl !== 'function') throw new Error('HTTP verification requires fetch');
	const checks = [];
	for (const url of urls) {
		try {
			const response = await fetchImpl(url, { redirect: 'follow' });
			const body = typeof response.text === 'function' ? await response.text() : '';
			const canonical = canonicalFromHtml(body, url);
			const canonicalOk = !canonical || canonical === normalizePublicUrl(url);
			checks.push({ url, status: response.status, ok: response.status === 200 && canonicalOk, canonical, canonicalOk });
		} catch (error) {
			checks.push({ url, status: 0, ok: false, error: error.message, canonical: null, canonicalOk: false });
		}
	}
	return {
		ok: checks.length > 0 && checks.every((item) => item.ok),
		checks,
	};
}

function gitHead(rootDir) {
	const result = spawnSync('git', ['rev-parse', 'HEAD'], {
		cwd: rootDir,
		encoding: 'utf8',
		env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
	});
	if (result.status !== 0) throw new Error((result.stderr || result.stdout || 'git rev-parse HEAD failed').trim());
	return result.stdout.trim();
}

function runBuildValidation(rootDir) {
	const result = spawnSync('npm', ['run', 'validate:generated'], {
		cwd: rootDir,
		stdio: 'inherit',
	});
	return result.status ?? 1;
}

function invokeIndexNow(rootDir, urls) {
	const tempDir = mkdtempSync(path.join(os.tmpdir(), 'hotword-indexnow-'));
	const urlsFile = path.join(tempDir, 'urls.txt');
	try {
		writeFileSync(urlsFile, `${urls.join('\n')}\n`, 'utf8');
		const result = spawnSync('npm', ['run', 'indexnow', '--', '--urls-file', urlsFile], {
			cwd: rootDir,
			encoding: 'utf8',
			stdio: 'inherit',
		});
		return { ok: (result.status ?? 1) === 0, code: result.status ?? 1 };
	} finally {
		rmSync(tempDir, { recursive: true, force: true });
	}
}

function invokeLedger(normalizedReceiptPath) {
	const claspUser = process.env.HOTWORD_CLASP_USER?.trim() || 'hotword-ledger';
	const result = spawnSync(process.execPath, [LEDGER_SCRIPT, normalizedReceiptPath], {
		cwd: path.dirname(LEDGER_SCRIPT),
		encoding: 'utf8',
		env: { ...process.env, HOTWORD_CLASP_USER: claspUser },
	});
	const output = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
	// Exit 0 = recorded; exit 10 = DEPLOYED_LEDGER_PENDING (production still live).
	const ok = (result.status ?? 1) === 0;
	const ledgerPending = (result.status ?? 1) === 10;
	return { ok, ledgerPending, code: result.status ?? 1, output };
}

function parseLedgerSummary(output) {
	const text = String(output || '');
	return {
		interventionIds: text.match(/interventions=([^\s]+)/i)?.[1]?.split(',').filter(Boolean) ?? [],
		baselineDataDate: text.match(/baseline=([^\s]+)/i)?.[1] || '',
	};
}

function identityForPublish(rootDir) {
	const identity = checkDeploymentIdentity({ rootDir });
	if (!identity.ok) throw new Error(identity.blockedReason || 'repository/deployment identity check failed');
	if (!identity.deployment?.productionUrl) throw new Error('deployment.productionUrl is required for standard production publishing');
	try {
		normalizePublicUrl(identity.deployment.productionUrl);
	} catch {
		throw new Error('deployment.productionUrl must be an absolute public URL');
	}
	const loaded = readSiteSpecDocument(rootDir);
	const siteId = asString(loaded.document?.site?.id);
	if (!siteId) throw new Error('site.id is required in site-spec.yaml for standard production publishing');
	return { identity, document: loaded.document, siteId, productionUrl: normalizePublicUrl(identity.deployment.productionUrl) };
}

function normalizeForPublish(receipt, context, head, deploymentUrl, deployedAt) {
	const normalized = JSON.parse(JSON.stringify(receipt));
	const common = normalized.common;
	if (common.siteId !== context.siteId) {
		throw new Error(`receipt common.siteId does not match site-spec site.id (${context.siteId})`);
	}
	const productionUrl = context.productionUrl;
	if (asString(common.productionUrl) && normalizePublicUrl(common.productionUrl) !== productionUrl) {
		throw new Error(`receipt common.productionUrl does not match deployment.productionUrl (${productionUrl})`);
	}
	if (asString(common.deploymentUrl) && asString(deploymentUrl) && asString(common.deploymentUrl) !== asString(deploymentUrl)) {
		throw new Error(`receipt common.deploymentUrl does not match the captured Vercel deployment URL (${deploymentUrl})`);
	}
	common.commitSha = head;
	common.deploymentUrl = asString(deploymentUrl) || productionUrl;
	common.productionUrl = productionUrl;
	common.deployedAt = asString(deployedAt) || new Date().toISOString();
	for (const intervention of normalized.interventions) {
		if (!Array.isArray(intervention.affectedUrls)) intervention.affectedUrls = [];
		if (intervention.action) intervention.action = String(intervention.action).trim().toUpperCase();
	}
	return normalized;
}

function baseResult(receipt, context, head) {
	return {
		site: asString(receipt?.common?.site) || context?.identity?.siteName || '',
		commit: head || asString(receipt?.common?.commitSha),
		productionUrl: context?.productionUrl || asString(receipt?.common?.productionUrl),
		production: 'FAIL',
		verification: 'FAIL',
		indexNow: 'FAIL',
		indexNowUrls: 0,
		ledger: 'FAIL',
		batchId: asString(receipt?.common?.batchId),
		interventionIds: [],
		baselineDataDate: '',
		attributionMode: asString(receipt?.common?.attributionMode) || (asString(receipt?.common?.decisionId) ? 'FORMAL_DECISION_LINKED' : 'OBSERVATIONAL_ONLY'),
		status: 'PUBLISH_FAILED',
	};
}

export function formatPublishResult(result) {
	return [
		'HOTWORD PRODUCTION PUBLISH',
		'',
		`Site: ${result.site}`,
		`Commit: ${result.commit}`,
		'',
		'Production:',
		result.production,
		'URL:',
		result.productionUrl,
		'',
		'Verification:',
		result.verification,
		'',
		`IndexNow: ${result.indexNow}`,
		`URLs: ${result.indexNowUrls}`,
		'',
		'Ledger writeback:',
		result.ledger,
		'',
		`BatchID: ${result.batchId}`,
		`InterventionIDs: ${result.interventionIds.join(',')}`,
		`BaselineDataDate: ${result.baselineDataDate}`,
		`AttributionMode: ${result.attributionMode}`,
		'',
		...(result.status === 'PRODUCTION_LIVE_LEDGER_INCOMPLETE' ? ['PRODUCTION LIVE', 'LEDGER INCOMPLETE', ''] : []),
		`RESULT: ${result.status}`,
	].join('\n');
}

export async function runProductionPublish(options = {}) {
	const rootDir = options.rootDir ?? ROOT;
	let receipt;
	let context = null;
	let head = '';
	try {
		if (!options.receiptPath) throw new Error('--receipt path/to/receipt.json is required');
		({ receipt } = parseJsonFile(options.receiptPath));
		validateReceiptMinimum(receipt);
		context = identityForPublish(rootDir);
		const result = baseResult(receipt, context, '');
		if (!options.skipBuild) {
			const buildCode = options.runBuild ? await options.runBuild(rootDir) : runBuildValidation(rootDir);
			if ((buildCode?.code ?? buildCode ?? 1) !== 0) {
				console.log(formatPublishResult(result));
				return { ...result, error: 'production build/generated validation failed' };
			}
		}
		head = options.getHead ? await options.getHead(rootDir) : gitHead(rootDir);
		result.commit = head;
		if (asString(receipt.common.commitSha) && asString(receipt.common.commitSha) !== head) {
			throw new Error(`receipt common.commitSha does not match HEAD (${head})`);
		}
		if (options.checkOnly) {
			result.production = 'NOT_RUN';
			result.verification = 'NOT_RUN';
			result.indexNow = 'SKIP';
			result.ledger = 'SKIP';
			result.status = 'CHECK_ONLY';
			console.log(formatPublishResult(result));
			return result;
		}

		let capturedDeploy = null;
		const deployFn = options.deployFn ?? (async (deployRoot, deployment) => {
			capturedDeploy = await spawnVercelDeploy(deployRoot, deployment, { capture: true });
			return capturedDeploy.code;
		});
		const deployment = await runDeployCli({ rootDir, deployFn });
		if (deployment.code !== 0) {
			console.log(formatPublishResult(result));
			return { ...result, error: 'production deployment failed' };
		}
		result.production = 'PASS';
		const normalizedProductionUrl = context.productionUrl;
		result.productionUrl = normalizedProductionUrl;
		const normalizedReceipt = normalizeForPublish(
			receipt,
			context,
			head,
			capturedDeploy?.deploymentUrl || deployment.result.deployment.productionUrl,
			options.now ? options.now() : new Date().toISOString(),
		);
		const verificationUrls = buildVerificationUrls(normalizedReceipt, normalizedProductionUrl);
		const verification = options.verify ? await options.verify(verificationUrls, normalizedProductionUrl) : await verifyProductionUrls(verificationUrls, { fetchImpl: options.fetchImpl });
		result.indexNowUrls = verificationUrls.length;
		if (!verification.ok) {
			result.verification = 'FAIL';
			console.log(formatPublishResult(result));
			return { ...result, verification, error: 'production verification failed' };
		}
		result.verification = 'PASS';

		const urls = buildProductionUrls(normalizedReceipt, normalizedProductionUrl);
		if (!readIndexNowEnabled(context.document)) {
			result.indexNow = 'SKIP';
		} else {
			const indexNow = options.submitIndexNow ? await options.submitIndexNow(rootDir, urls) : invokeIndexNow(rootDir, urls);
			result.indexNow = indexNow.ok ? 'PASS' : 'FAIL';
			result.indexNowUrls = urls.length;
		}

		const tempDir = mkdtempSync(path.join(os.tmpdir(), 'hotword-publish-'));
		const normalizedPath = path.join(tempDir, 'normalized-production-receipt.json');
		try {
			writeFileSync(normalizedPath, `${JSON.stringify(normalizedReceipt, null, 2)}\n`, 'utf8');
			const ledger = options.writeLedger ? await options.writeLedger(normalizedPath, normalizedReceipt) : invokeLedger(normalizedPath);
			result.ledger = ledger.ok ? 'PASS' : 'FAIL';
			Object.assign(result, parseLedgerSummary(ledger.output));
			result.status = ledger.ok && result.indexNow !== 'FAIL'
				? 'PUBLISH_COMPLETE'
				: ledger.ledgerPending
					? 'PRODUCTION_LIVE_LEDGER_INCOMPLETE'
					: ledger.ok
						? 'PUBLISH_FAILED'
						: 'PRODUCTION_LIVE_LEDGER_INCOMPLETE';
			console.log(formatPublishResult(result));
			return { ...result, normalizedReceipt, ledgerResult: ledger };
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	} catch (error) {
		const result = baseResult(receipt, context, head);
		result.error = error.message;
		console.error(`PUBLISH FAILED: ${error.message}`);
		console.log(formatPublishResult(result));
		return result;
	}
}

function parseArgs(argv) {
	let receiptPath = '';
	let checkOnly = false;
	let skipBuild = false;
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === '--receipt') {
			receiptPath = argv[++i] || '';
			continue;
		}
		if (arg.startsWith('--receipt=')) {
			receiptPath = arg.slice('--receipt='.length);
			continue;
		}
		if (arg === '--check') {
			checkOnly = true;
			continue;
		}
		if (arg === '--skip-build') {
			skipBuild = true;
			continue;
		}
		if (arg === '--help' || arg === '-h') {
			console.log('Usage: npm run publish:production -- --receipt <path> [--check] [--skip-build]');
			process.exit(0);
		}
		throw new Error(`Unknown argument: ${arg}`);
	}
	if (!receiptPath) throw new Error('--receipt path/to/receipt.json is required');
	return { receiptPath, checkOnly, skipBuild };
}

if (import.meta.url === `file://${process.argv[1]}`) {
	try {
		const options = parseArgs(process.argv.slice(2));
		const result = await runProductionPublish(options);
		process.exit(result.status === 'PUBLISH_COMPLETE' || result.status === 'CHECK_ONLY' ? 0 : 1);
	} catch (error) {
		console.error(`PUBLISH FAILED: ${error.message}`);
		process.exit(1);
	}
}
