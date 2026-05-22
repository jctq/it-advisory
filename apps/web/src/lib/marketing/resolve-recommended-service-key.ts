import { KNOWN_CATALOG_SERVICE_KEYS, type KnownCatalogServiceKey } from '@/domain/monetization-types';
import { normalizeServiceKey } from '@/lib/monetization/catalog-key-utils';

const DEFAULT_RECOMMENDED_SERVICE_KEY: KnownCatalogServiceKey = 'project-rescue';

function isKnownCatalogServiceKey(value: string, enabledKeys: ReadonlySet<string>): value is KnownCatalogServiceKey {
  return KNOWN_CATALOG_SERVICE_KEYS.includes(value as KnownCatalogServiceKey) && enabledKeys.has(value);
}

/**
 * Heuristic mapping from diagnostic situation text to a catalog serviceKey.
 */
export function inferRecommendedServiceKeyFromContext(input: {
  readonly mappedSituation: string;
  readonly initialPrompt: string;
  readonly advisorSummary: string;
}): KnownCatalogServiceKey {
  const haystack = `${input.mappedSituation} ${input.initialPrompt} ${input.advisorSummary}`.toLowerCase();
  if (/\b(vendor|supplier|rfp|proposal|contract|sow|shortlist)\b/.test(haystack)) {
    return 'vendor-validation';
  }
  if (/\b(automation|workflow|integrat|api|script|bot)\b/.test(haystack)) {
    return 'automation-scoping';
  }
  if (/\b(package|checkpoint|ongoing|retainer|three session|3 session)\b/.test(haystack)) {
    return 'package-3-sessions';
  }
  if (/\b(general|explor|clarity|not sure|unsure)\b/.test(haystack)) {
    return 'consultation';
  }
  return DEFAULT_RECOMMENDED_SERVICE_KEY;
}

/**
 * Resolves the service to highlight: AI/catalog hint first, then heuristic, then default if enabled.
 */
export function resolveRecommendedServiceKey(input: {
  readonly candidateKey: string | null | undefined;
  readonly mappedSituation: string;
  readonly initialPrompt: string;
  readonly advisorSummary: string;
  readonly enabledServiceKeys: readonly string[];
}): string {
  const enabled = new Set(input.enabledServiceKeys.map((key) => normalizeServiceKey(key)));
  const normalizedCandidate = normalizeServiceKey(input.candidateKey ?? '');
  if (normalizedCandidate.length > 0 && isKnownCatalogServiceKey(normalizedCandidate, enabled)) {
    return normalizedCandidate;
  }
  const inferred = inferRecommendedServiceKeyFromContext({
    mappedSituation: input.mappedSituation,
    initialPrompt: input.initialPrompt,
    advisorSummary: input.advisorSummary,
  });
  if (enabled.has(inferred)) {
    return inferred;
  }
  const firstEnabled = input.enabledServiceKeys.map((key) => normalizeServiceKey(key)).find((key) => key.length > 0);
  return firstEnabled ?? '';
}
