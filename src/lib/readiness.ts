import type { ToolkitItem } from './toolkit';

export const DEFAULT_READINESS_STORAGE_KEY = 'game-readiness-state-v1';
export type ReadinessTier = 'critical' | 'recommended' | 'safe';
export type ReadinessRecoverability = 'current-run' | 'next-cycle' | 'fresh-save-only' | 'not-applicable';
export type ReadinessResolver = 'informational' | 'manual' | 'toolkit';
export type ReadinessManualValue = 'unknown' | 'confirmed' | 'missing' | 'earned' | 'missed' | 'complete' | 'incomplete';

export interface ReadinessManualOption { value: ReadinessManualValue; label: string; }
export interface ProgressReadinessRule {
	id: string;
	title: string;
	tier: ReadinessTier;
	description: string;
	shortReason?: string;
	toolkitItemIds?: readonly string[];
	guideUrl?: string;
	mapMarkerIds?: readonly string[];
	patchSensitive?: boolean;
	recoverability?: ReadinessRecoverability;
	carryOver?: string;
	resetBehavior?: string;
	statusResolver?: ReadinessResolver;
	manualKey?: string;
	manualOptions?: readonly ReadinessManualOption[];
}

export function toolkitItemsForRule(rule: ProgressReadinessRule, toolkitItems: readonly ToolkitItem[]): ToolkitItem[] {
	const ids = new Set(rule.toolkitItemIds ?? []);
	return toolkitItems.filter((item) => ids.has(item.id));
}
