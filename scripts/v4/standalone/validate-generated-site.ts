#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? '.');
const generatedPath = path.join(root, 'src/v4/generated/example-site.json');
const required = [
  'astro.config.mjs',
  'package.json',
  'tsconfig.json',
  'src/pages/index.astro',
  'src/pages/search.astro',
  'src/pages/category.astro',
  'src/pages/[...page].astro',
  generatedPath,
];
const forbidden = [
  'src/g017',
  'src/layouts',
  'src/content',
  'src/lib',
  'src/config',
  'tests',
  'scripts/lib',
  'scripts/validate-generated-site.ts',
];

for (const entry of required) {
  if (!existsSync(path.isAbsolute(entry) ? entry : path.join(root, entry))) {
    throw new Error(`V4 standalone validation failed: missing ${entry}`);
  }
}
for (const entry of forbidden) {
  if (existsSync(path.join(root, entry))) {
    throw new Error(`V4 standalone validation failed: non-runtime source present: ${entry}`);
  }
}

const generated = JSON.parse(readFileSync(generatedPath, 'utf8')) as {
  game?: { name?: string; slug?: string };
  navigation?: { primary?: Array<{ href?: string; groups?: Array<{ items?: Array<{ href?: string }> }> }>; utilities?: Array<{ href?: string }> };
  pages?: Array<{ id?: string; href?: string; pageData?: { facts?: unknown[]; evidence?: unknown[]; primitiveData?: unknown[] }; composition?: { primitives?: unknown[] } }>;
};
if (!generated.game?.name?.trim() || !generated.pages?.length) {
  throw new Error('V4 standalone validation failed: generated site has no game identity or pages.');
}
const ids = new Set<string>();
for (const page of generated.pages) {
  if (!page.id || !page.href?.startsWith('/')) throw new Error('V4 standalone validation failed: invalid generated page.');
  if (ids.has(page.id)) throw new Error(`V4 standalone validation failed: duplicate page id ${page.id}.`);
  ids.add(page.id);
  const facts = page.pageData?.facts?.length ?? 0;
  const evidence = page.pageData?.evidence?.length ?? 0;
  const primitiveData = page.pageData?.primitiveData?.length ?? 0;
  const composed = page.composition?.primitives?.length ?? 0;
  if ((facts || evidence) && (!primitiveData || !composed)) throw new Error(`V4 standalone validation failed: page ${page.id} has facts/evidence but empty primitiveData or composition.primitives.`);
  if (!composed) throw new Error(`V4 standalone validation failed: page ${page.id} has empty composition.primitives.`);
}
const hrefs = [
  ...(generated.navigation?.primary ?? []).flatMap((item) => [item.href, ...(item.groups ?? []).flatMap((group) => (group.items ?? []).map((child) => child.href))]),
  ...(generated.navigation?.utilities ?? []).map((item) => item.href),
  ...generated.pages.map((page) => page.href),
].filter((href): href is string => Boolean(href));
const routes = new Set(['/','/category/','/search/', ...generated.pages.map((page) => page.href)].map((href) => href.replace(/^\/v4-preview(?=\/|$)/, '') || '/'));
for (const href of hrefs) {
  const route = href.replace(/^\/v4-preview(?=\/|$)/, '') || '/';
  if (!routes.has(route)) throw new Error(`V4 standalone validation failed: canonical navigation route is not generated: ${href}`);
}
const serialized = readFileSync(generatedPath, 'utf8');
const artificialFixture = generated.game?.slug === 'artificial-emberfall-p2-fixture';
if (/Example Game|example\.invalid|placeholder|Unknown metadata/i.test(serialized) || (!artificialFixture && /Artificial Emberfall/i.test(serialized))) throw new Error('V4 standalone validation failed: starter placeholder or fixture residue remains in generated output.');
console.log(`validate:generated V4 standalone PASS (${generated.pages.length} pages)`);
