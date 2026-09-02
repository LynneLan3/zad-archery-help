export const OUTBOUND_KINDS = ['content', 'source', 'evidence', 'affiliate', 'other'] as const;
export type OutboundKind = (typeof OUTBOUND_KINDS)[number];

export { GA4_MEASUREMENT_ID } from './analytics';

export interface OutboundEventParams {
	link_url: string;
	link_domain: string;
	link_text: string;
	outbound_kind: OutboundKind;
}

export interface AnalyticsRuntimeConfig {
	measurementId: string;
	siteHost: string;
	trackOutbound: boolean;
}

function normalizeHost(host: string): string {
	return host.trim().toLowerCase().replace(/\.$/, '');
}

export function isIgnoredOutboundHref(href: string): boolean {
	const raw = href.trim();
	if (!raw) return true;
	if (raw.startsWith('#') || raw.startsWith('?')) return true;
	const lower = raw.toLowerCase();
	if (lower.startsWith('mailto:') || lower.startsWith('tel:') || lower.startsWith('javascript:')) {
		return true;
	}
	return false;
}

export function sanitizeOutboundUrl(href: string, baseOrigin?: string): { link_url: string; link_domain: string } | null {
	try {
		const url = new URL(href, baseOrigin);
		if (!/^https?:$/i.test(url.protocol)) return null;
		return {
			link_url: `${url.origin}${url.pathname}`,
			link_domain: url.hostname,
		};
	} catch {
		return null;
	}
}

export function isSameSiteHref(href: string, siteHosts: readonly string[], baseOrigin?: string): boolean {
	const sanitized = sanitizeOutboundUrl(href, baseOrigin);
	if (!sanitized) return true;
	const target = normalizeHost(sanitized.link_domain);
	return siteHosts.some((host) => normalizeHost(host) === target);
}

export function outboundKindFromDataset(value: string | null | undefined): OutboundKind {
	if (
		value === 'source' ||
		value === 'evidence' ||
		value === 'other' ||
		value === 'content' ||
		value === 'affiliate'
	) {
		return value;
	}
	return 'content';
}

function clipLinkText(text: string): string {
	return text.replace(/\s+/g, ' ').trim().slice(0, 120);
}

export function resolveOutboundClick(input: {
	href: string;
	linkText?: string;
	datasetKind?: string | null;
	siteHosts: readonly string[];
	baseOrigin?: string;
}): OutboundEventParams | null {
	if (isIgnoredOutboundHref(input.href)) return null;
	if (isSameSiteHref(input.href, input.siteHosts, input.baseOrigin)) return null;
	const sanitized = sanitizeOutboundUrl(input.href, input.baseOrigin);
	if (!sanitized) return null;
	return {
		link_url: sanitized.link_url,
		link_domain: sanitized.link_domain,
		link_text: clipLinkText(input.linkText ?? ''),
		outbound_kind: outboundKindFromDataset(input.datasetKind),
	};
}

function readAnalyticsConfig(): AnalyticsRuntimeConfig | null {
	if (typeof document === 'undefined') return null;
	const el = document.getElementById('gw-analytics-config');
	if (!el?.textContent) return null;
	try {
		const parsed = JSON.parse(el.textContent) as AnalyticsRuntimeConfig;
		if (!parsed?.measurementId || !parsed.siteHost) return null;
		return parsed;
	} catch {
		return null;
	}
}

function sendOutboundEvent(params: OutboundEventParams) {
	const gtag = (globalThis as { gtag?: (...args: unknown[]) => void }).gtag;
	if (typeof gtag !== 'function') return;
	gtag('event', 'outbound_click', {
		link_url: params.link_url,
		link_domain: params.link_domain,
		link_text: params.link_text,
		outbound_kind: params.outbound_kind,
		transport_type: 'beacon',
	});
}

/** Click delegation for production pages. No-ops when gtag is missing. */
export function attachOutboundTracking() {
	if (typeof document === 'undefined') return;
	const config = readAnalyticsConfig();
	if (!config?.trackOutbound) return;
	if (typeof location !== 'undefined' && normalizeHost(location.hostname) !== normalizeHost(config.siteHost)) {
		return;
	}
	document.addEventListener(
		'click',
		(event) => {
			const target = event.target;
			if (!(target instanceof Element)) return;
			const anchor = target.closest('a[href]');
			if (!(anchor instanceof HTMLAnchorElement)) return;
			const href = anchor.getAttribute('href') ?? '';
			const params = resolveOutboundClick({
				href,
				linkText: anchor.textContent ?? '',
				datasetKind: anchor.dataset.outboundKind,
				siteHosts: [config.siteHost, typeof location !== 'undefined' ? location.hostname : config.siteHost],
				baseOrigin: typeof location !== 'undefined' ? location.origin : `https://${config.siteHost}`,
			});
			if (!params) return;
			sendOutboundEvent(params);
		},
		{ capture: true },
	);
}
