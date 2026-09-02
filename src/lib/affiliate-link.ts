export interface AffiliateLinkInput {
	title?: string | null;
	className?: string | null;
	rel?: string | null;
	target?: string | null;
	outboundKind?: string | null;
	affiliateFlag?: boolean;
}

export interface AffiliateLinkAttrs {
	rel: string;
	outboundKind: 'affiliate';
	title?: string;
}

function classList(className: string | null | undefined): string[] {
	return String(className || '')
		.split(/\s+/)
		.map((item) => item.trim())
		.filter(Boolean);
}

function relTokens(rel: string | null | undefined): string[] {
	return String(rel || '')
		.split(/\s+/)
		.map((item) => item.trim().toLowerCase())
		.filter(Boolean);
}

export function isAffiliateMarkedLink(input: AffiliateLinkInput): boolean {
	if (input.affiliateFlag) return true;
	if (String(input.outboundKind || '').trim() === 'affiliate') return true;
	if (String(input.title || '').trim().toLowerCase() === 'affiliate') return true;
	return classList(input.className).includes('affiliate');
}

export function applyAffiliateLinkAttrs(input: AffiliateLinkInput): AffiliateLinkAttrs | null {
	if (!isAffiliateMarkedLink(input)) return null;
	const tokens = new Set(relTokens(input.rel));
	tokens.add('sponsored');
	const target = String(input.target || '').trim().toLowerCase();
	if (target === '_blank') tokens.add('noopener');
	const titleRaw = String(input.title || '').trim();
	return {
		rel: [...tokens].join(' '),
		outboundKind: 'affiliate',
		title: titleRaw.toLowerCase() === 'affiliate' ? undefined : titleRaw || undefined,
	};
}

type HastElement = {
	type?: string;
	tagName?: string;
	properties?: Record<string, unknown>;
	children?: unknown[];
};

function walkHast(node: unknown, visit: (el: HastElement) => void) {
	if (!node || typeof node !== 'object') return;
	const el = node as HastElement;
	if (el.type === 'element') visit(el);
	if (!Array.isArray(el.children)) return;
	for (const child of el.children) walkHast(child, visit);
}

/** Rehype plugin: explicit affiliate marks become rel=sponsored + data-outbound-kind=affiliate. */
export function rehypeAffiliateLinks() {
	return (tree: unknown) => {
		walkHast(tree, (el) => {
			if (el.tagName !== 'a') return;
			const props = el.properties ?? {};
			const className = Array.isArray(props.className)
				? props.className.map(String).join(' ')
				: props.className != null
					? String(props.className)
					: '';
			const applied = applyAffiliateLinkAttrs({
				title: props.title != null ? String(props.title) : null,
				className,
				rel: props.rel != null ? (Array.isArray(props.rel) ? props.rel.map(String).join(' ') : String(props.rel)) : null,
				target: props.target != null ? String(props.target) : null,
				outboundKind: props.dataOutboundKind != null ? String(props.dataOutboundKind) : null,
				affiliateFlag: props.dataAffiliate === true || props.dataAffiliate === '' || props.dataAffiliate === 'true',
			});
			if (!applied) return;
			el.properties = {
				...props,
				rel: applied.rel.split(' '),
				dataOutboundKind: applied.outboundKind,
			};
			if (applied.title === undefined) delete el.properties.title;
			else el.properties.title = applied.title;
			delete el.properties.dataAffiliate;
		});
	};
}
