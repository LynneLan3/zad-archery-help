export const DEFAULT_TOOLKIT_STORAGE_KEY = 'game-toolkit-progress-v1';

export interface ToolkitItem {
	id: string;
	name: string;
	category: string;
	region?: string;
	guideUrl?: string;
	mapMarkerId?: string;
	image?: string;
	description?: string;
}

export interface ToolkitConfig {
	enabled: boolean;
	storageKey?: string;
	title?: string;
}

export function readToolkitProgress(storage: Storage, storageKey: string, validIds: ReadonlySet<string>): Set<string> {
	try {
		const raw = storage.getItem(storageKey);
		if (!raw) return new Set();
		const parsed = JSON.parse(raw) as { version?: unknown; completedIds?: unknown };
		if (parsed.version !== 1 || !Array.isArray(parsed.completedIds)) return new Set();
		return new Set(parsed.completedIds.filter((id): id is string => typeof id === 'string' && validIds.has(id)));
	} catch {
		return new Set();
	}
}

export function writeToolkitProgress(storage: Storage, storageKey: string, completedIds: ReadonlySet<string>): void {
	try {
		storage.setItem(storageKey, JSON.stringify({ version: 1, completedIds: [...completedIds] }));
	} catch {
		// Blocked browser storage should not stop the optional toolkit from rendering.
	}
}

export function clearToolkitProgress(storage: Storage, storageKey: string): void {
	try {
		storage.removeItem(storageKey);
	} catch {
		// Blocked browser storage should not stop the reset UI from updating.
	}
}
