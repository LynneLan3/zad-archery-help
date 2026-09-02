export const TRUST_STATUSES = ['verified', 'provisional', 'outdated'] as const;
export type TrustStatus = (typeof TRUST_STATUSES)[number];

export const TRUST_SOURCE_TYPES = ['official', 'first-party', 'community', 'secondary'] as const;
export type TrustSourceType = (typeof TRUST_SOURCE_TYPES)[number];

export interface EvidenceSource {
	label: string;
	url?: string;
	type: TrustSourceType;
}

export interface ContentTrust {
	status?: TrustStatus;
	lastVerified?: string;
	appliesTo?: string[];
	sources?: EvidenceSource[];
	note?: string;
}

export function trustStatusLabel(status: TrustStatus): string {
	return status.charAt(0).toUpperCase() + status.slice(1);
}

export function trustSourceTypeLabel(type: TrustSourceType): string {
	return type === 'first-party' ? 'First-party' : type.charAt(0).toUpperCase() + type.slice(1);
}
