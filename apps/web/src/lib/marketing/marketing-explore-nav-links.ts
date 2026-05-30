export type MarketingExploreNavLink = { readonly href: string; readonly label: string };

export const MARKETING_CASE_STUDIES_SECTION_ID = 'case-studies';

export const MARKETING_CASE_STUDIES_NAV_HREF = `/#${MARKETING_CASE_STUDIES_SECTION_ID}`;

/** Flip to `true` when the home page resources library is ready to publish. */
export const SHOW_HOME_RESOURCES_SECTION = false;

const CORE_MARKETING_EXPLORE_NAV_LINKS: readonly MarketingExploreNavLink[] = [
  { href: '/#how-it-works', label: 'How It Works' },
  { href: '/#services', label: 'Services' },
  { href: '/#about', label: 'About' },
] as const;

const MARKETING_CASE_STUDIES_NAV_LINK: MarketingExploreNavLink = {
  href: MARKETING_CASE_STUDIES_NAV_HREF,
  label: 'Case Studies',
};

type ResolveMarketingCaseStudiesNavEnabledInput = {
  readonly reviewsModuleEnabled: boolean;
  readonly publishedTestimonialCount: number;
};

/**
 * Case Studies appears in chrome only when the homepage exposes a matching anchor
 * (resources library or published testimonials band).
 */
export function resolveMarketingCaseStudiesNavEnabled(
  input: ResolveMarketingCaseStudiesNavEnabledInput,
): boolean {
  if (SHOW_HOME_RESOURCES_SECTION) {
    return true;
  }
  return input.reviewsModuleEnabled && input.publishedTestimonialCount > 0;
}

export function buildMarketingExploreNavLinks(caseStudiesNavEnabled: boolean): readonly MarketingExploreNavLink[] {
  if (!caseStudiesNavEnabled) {
    return CORE_MARKETING_EXPLORE_NAV_LINKS;
  }
  return [...CORE_MARKETING_EXPLORE_NAV_LINKS, MARKETING_CASE_STUDIES_NAV_LINK];
}
