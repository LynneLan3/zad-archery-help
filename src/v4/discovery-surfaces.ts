import type { ResolvedPageIntent } from './intent-contract';

export interface DiscoveryEntry {
	id: string;
	title: string;
	description: string;
	href: string;
	priority: number;
	intent: ResolvedPageIntent;
}

export interface DiscoverySurface {
	kind: 'homepage' | 'search' | 'category';
	answerBearing: boolean;
	items: readonly DiscoveryEntry[];
}

export function buildHomepage(entries: readonly DiscoveryEntry[]): DiscoverySurface {
	return {
		kind: 'homepage',
		answerBearing: false,
		items: [...entries].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id)),
	};
}

export function buildSearchSurface(query: string, entries: readonly DiscoveryEntry[]): DiscoverySurface {
	const normalized = query.trim().toLocaleLowerCase();
	return {
		kind: 'search',
		answerBearing: false,
		items: entries.filter((entry) =>
			[entry.title, entry.description, entry.intent.query].some((value) => value.toLocaleLowerCase().includes(normalized)),
		),
	};
}

export function buildCategorySurface(entries: readonly DiscoveryEntry[]): DiscoverySurface {
	return { kind: 'category', answerBearing: false, items: [...entries] };
}

export function isAnswerHub(entry: DiscoveryEntry): boolean {
	return entry.intent.prototype === 'P2';
}
