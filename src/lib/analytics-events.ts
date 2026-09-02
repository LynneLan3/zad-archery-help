import { ANALYTICS_PLACEMENTS, normalizeAnalyticsPath, type AnalyticsPlacement } from './analytics';

export const CORE_INTERACTION_EVENTS = [
	'guide_click',
	'popular_question_click',
	'start_here_click',
] as const;

export type CoreInteractionEventName = (typeof CORE_INTERACTION_EVENTS)[number];

export interface CoreInteractionEvent {
	name: CoreInteractionEventName;
	params: {
		site_id: string;
		game_slug: string;
		template_version: string;
		link_title: string;
		target_path: string;
		placement: AnalyticsPlacement;
	};
}

export interface AnalyticsEventIdentity {
	siteId?: string;
	gameSlug?: string;
	templateVersion?: string;
}

export function buildCoreInteractionEvent(input: {
	eventName: string;
	identity: AnalyticsEventIdentity;
	linkTitle: string;
	targetPath: string;
	placement: string;
}): CoreInteractionEvent | null {
	if (!CORE_INTERACTION_EVENTS.includes(input.eventName as CoreInteractionEventName)) return null;
	if (!ANALYTICS_PLACEMENTS.includes(input.placement as AnalyticsPlacement)) return null;
	const siteId = input.identity.siteId?.trim();
	const gameSlug = input.identity.gameSlug?.trim();
	const templateVersion = input.identity.templateVersion?.trim();
	const linkTitle = input.linkTitle.replace(/\s+/g, ' ').trim();
	if (!siteId || !gameSlug || !templateVersion || !linkTitle || !input.targetPath.trim()) return null;
	return {
		name: input.eventName as CoreInteractionEventName,
		params: {
			site_id: siteId,
			game_slug: gameSlug,
			template_version: templateVersion,
			link_title: linkTitle,
			target_path: normalizeAnalyticsPath(input.targetPath),
			placement: input.placement as AnalyticsPlacement,
		},
	};
}

function readEventIdentity(): AnalyticsEventIdentity | null {
	const element = document.getElementById('gw-analytics-config');
	if (!element?.textContent) return null;
	try {
		const config = JSON.parse(element.textContent) as AnalyticsEventIdentity;
		return config.siteId && config.gameSlug && config.templateVersion ? config : null;
	} catch {
		return null;
	}
}

/** Attach one delegated, non-blocking internal click adapter. */
export function attachCoreInteractionTracking() {
	if (typeof document === 'undefined') return;
	const identity = readEventIdentity();
	if (!identity) return;
	document.addEventListener(
		'click',
		(event) => {
			try {
				const target = event.target;
				if (!(target instanceof Element)) return;
				const anchor = target.closest('a[data-analytics-event]');
				if (!(anchor instanceof HTMLAnchorElement)) return;
				const interaction = buildCoreInteractionEvent({
					eventName: anchor.dataset.analyticsEvent ?? '',
					identity,
					linkTitle: anchor.dataset.analyticsTitle ?? anchor.textContent ?? '',
					targetPath: anchor.getAttribute('href') ?? '',
					placement: anchor.dataset.analyticsPlacement ?? '',
				});
				if (!interaction) return;
				const gtag = (globalThis as { gtag?: (...args: unknown[]) => void }).gtag;
				if (typeof gtag === 'function') gtag('event', interaction.name, interaction.params);
			} catch {
				// Analytics must never interfere with navigation.
			}
		},
		{ capture: true },
	);
}
