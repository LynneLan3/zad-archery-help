import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
	GENERATOR_VERSION,
	MANIFEST_FILENAME,
	SITE_SPEC_SCHEMA_VERSION,
	sha256Text,
	type SiteSpec,
} from './site-spec';

export interface ManagedFileEntry {
	path: string;
	sha256: string;
	kind: 'config' | 'page' | 'hub' | 'trust' | 'asset' | 'manifest' | 'spec' | 'other';
}

export interface ManagedAssetEntry {
	id: string;
	target: string;
	source: string;
	sha256: string;
	usageStatus: string;
	sourceType: string;
}

export interface SiteGeneratorManifest {
	schemaVersion: number;
	templateVersion: string;
	generatorVersion: string;
	specHash: string;
	siteId: string;
	createdFromSpec: string;
	managedFiles: ManagedFileEntry[];
	managedAssets: ManagedAssetEntry[];
}

export function manifestPath(rootDir: string): string {
	return path.join(rootDir, MANIFEST_FILENAME);
}

export function readManifest(rootDir: string): SiteGeneratorManifest | null {
	const file = manifestPath(rootDir);
	if (!existsSync(file)) return null;
	const raw = JSON.parse(readFileSync(file, 'utf8')) as SiteGeneratorManifest;
	return raw;
}

export function buildManifest(input: {
	spec: SiteSpec;
	specHash: string;
	specRelativePath: string;
	managedFiles: ManagedFileEntry[];
	managedAssets: ManagedAssetEntry[];
}): SiteGeneratorManifest {
	const managedFiles = [...input.managedFiles].sort((a, b) => a.path.localeCompare(b.path));
	const managedAssets = [...input.managedAssets].sort((a, b) => a.id.localeCompare(b.id));
	return {
		schemaVersion: SITE_SPEC_SCHEMA_VERSION,
		templateVersion: input.spec.templateVersion,
		generatorVersion: GENERATOR_VERSION,
		specHash: input.specHash,
		siteId: input.spec.site.id,
		createdFromSpec: input.specRelativePath.replace(/\\/g, '/'),
		managedFiles,
		managedAssets,
	};
}

export function serializeManifest(manifest: SiteGeneratorManifest): string {
	return `${JSON.stringify(manifest, null, 2)}\n`;
}

export function writeManifest(rootDir: string, manifest: SiteGeneratorManifest): string {
	const file = manifestPath(rootDir);
	const body = serializeManifest(manifest);
	mkdirSync(path.dirname(file), { recursive: true });
	writeFileSync(file, body, 'utf8');
	return sha256Text(body);
}

export function isPathManaged(manifest: SiteGeneratorManifest | null, relativePath: string): boolean {
	if (!manifest) return false;
	const normalized = relativePath.replace(/\\/g, '/');
	return manifest.managedFiles.some((entry) => entry.path === normalized);
}
