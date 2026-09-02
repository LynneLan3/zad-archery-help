import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { GUIDE_STATUSES } from './lib/status';
import { PAGE_ROLES, RELATION_TYPES } from './lib/page-relations';
import { EVIDENCE_SOURCE_TYPES, PAGE_ASSET_TYPES, PAGE_SOURCE_TYPES } from './lib/page-evidence';
import { TRUST_PAGE_KINDS } from './lib/trust';
import { TRUST_SOURCE_TYPES, TRUST_STATUSES } from './lib/content-trust';
import { PAGE_TYPES } from './lib/page-types';

const pageRelationSchema = z.object({
	slug: z.string().min(1),
	type: z.enum(RELATION_TYPES),
});

const pageSourceSchema = z.object({
	type: z.enum(PAGE_SOURCE_TYPES),
	title: z.string().min(1),
	url: z.string().url(),
});

const pageEvidenceSchema = z.object({
	asset: z.string().min(1),
	alt: z.string().min(1),
	caption: z.string().optional(),
	sourceLabel: z.string().min(1).optional(),
	sourceType: z.enum(EVIDENCE_SOURCE_TYPES).optional(),
	sourceUrl: z.string().url().optional(),
});

const contentTrustSchema = z.object({
	status: z.enum(TRUST_STATUSES).optional(),
	lastVerified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'lastVerified must use YYYY-MM-DD.').refine((value) => {
		const date = new Date(`${value}T00:00:00Z`);
		return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
	}, 'lastVerified must be a real calendar date.').optional(),
	appliesTo: z.array(z.string().trim().min(1)).optional(),
	sources: z.array(z.object({ label: z.string().trim().min(1), url: z.string().url().optional(), type: z.enum(TRUST_SOURCE_TYPES) })).optional(),
	note: z.string().trim().min(1).optional(),
});

const trustPageSchema = z.object({
	title: z.string().min(1),
	description: z.string().min(1),
	trustType: z.enum(TRUST_PAGE_KINDS),
	robots: z.enum(['index,follow', 'noindex,follow']),
});

export const collections = {
	trust: defineCollection({
		loader: glob({ base: './src/content/trust', pattern: '**/*.{md,mdx}' }),
		schema: trustPageSchema,
	}),
	docs: defineCollection({
		loader: docsLoader(),
		schema: docsSchema({
			extend: ({ image }) =>
				z.object({
					slug: z.string().min(1).optional(),
					pageType: z.enum(PAGE_TYPES).default('how-to'),
					sections: z.array(z.object({ id: z.string().min(1), title: z.string().min(1) })).default([]),
					homepagePriority: z.number().int().positive().optional(),
					category: z.string().optional(),
					status: z.enum(GUIDE_STATUSES).optional(),
					featured: z.boolean().default(false),
					cover: image().optional(),
					coverMedia: z
						.object({
							alt: z.string().min(1),
							caption: z.string().optional(),
							sourceLabel: z.string().min(1).optional(),
							sourceUrl: z.string().url().optional(),
							kind: z.enum(['cover', 'screenshot', 'evidence', 'illustration']).optional(),
							aspectRatio: z.enum(['16:9', '4:3', '1:1', 'portrait', 'auto']).optional(),
							objectPosition: z.string().min(1).optional(),
						})
						.optional(),
					cardImage: image().optional(),
					thumbnail: image().optional(),
					imageAlt: z.string().optional(),
					quickAnswer: z.string().optional(),
					related: z.array(z.string()).optional(),
					role: z.enum(PAGE_ROLES).default('supporting'),
					intents: z.array(z.string()).optional(),
					relations: z.array(pageRelationSchema).optional(),
					assetType: z.enum(PAGE_ASSET_TYPES).default('article'),
					sources: z.array(pageSourceSchema).optional(),
					evidence: z.array(pageEvidenceSchema).optional(),
					trust: contentTrustSchema.optional(),
					socialImage: z
						.object({
							asset: z.string().min(1),
							alt: z.string().min(1),
						})
						.optional(),
				/** Optional Hub Recently Updated change line. Omit freely on older pages. */
				changeSummary: z.string().optional(),
				eyebrow: z.string().optional(),
				facts: z
					.array(
						z.object({
							label: z.string().min(1),
							value: z.string().min(1),
						}),
					)
					.max(4)
					.optional(),
				}),
		}),
	}),
};
