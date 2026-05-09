/**
 * Canonical situation labels for the quiz (single source of truth for step 1 + search).
 */
export const SITUATION_OPTIONS = [
  'Vendor keeps missing timelines',
  'Requirements keep changing',
  'Users are unhappy with the system',
  'Budget or scope is unclear',
  'Leadership needs an independent view',
  'Not sure yet — need clarity first',
] as const;

export type SituationOption = (typeof SITUATION_OPTIONS)[number];

export const SITUATION_SEED_COUNT = 6;

/** UI chip: friendly phrase → persisted canonical answer */
export type SituationChoice = {
  readonly label: string;
  readonly value: string;
};

const OPTION_SEARCH_EXTRA: Partial<Record<SituationOption, string>> = {
  'Vendor keeps missing timelines':
    'vendor contractor outsource delay deadline missed late delivery sprint timeline sla behind schedule penalty waterfall agile sprint demo release regression defect bugfix outage downtime deploy rollback ci/cd pipeline',
  'Requirements keep changing':
    'scope creep change churn pivot specs unclear stakeholders roadmap backlog refinement sprint planning change request cr scope statement',
  'Users are unhappy with the system':
    'adoption complaints ux frustration training resistance mongodb mongo database mysql postgres sql atlas redis cache replica slow query latency performance throughput disk cpu memory indexing query explain nagios pagerduty incident sla uptime reliability observability logging apm downtime freeze crash bug production incidents app slow loading timeout error 500',
  'Budget or scope is unclear':
    'cost funding capex opex roi unclear estimate budget variance burn rate license subscription infra cloud aws gcp azure pricing contract sow change order',
  'Leadership needs an independent view':
    'board audit governance neutral second opinion steering committee executive sponsor cmto cto cio independence vendor-neutral assessment due diligence',
  'Not sure yet — need clarity first':
    'unsure stuck exploratory discovery assessment unclear messy confused next steps strategy workshop diagnostic triage help me figure',
};

export function getSituationSeed(): readonly string[] {
  return SITUATION_OPTIONS.slice(0, SITUATION_SEED_COUNT);
}

/**
 * Dedupes and fills up to `limit` labels, keeping `prioritized` order first then `filler`.
 */
export function mergeSituationSuggestions(
  prioritized: readonly string[],
  filler: readonly string[],
  limit = SITUATION_SEED_COUNT,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const label of [...prioritized, ...filler]) {
    if (seen.has(label)) {
      continue;
    }
    seen.add(label);
    out.push(label);
    if (out.length >= limit) {
      break;
    }
  }
  return out;
}

function getSearchBlob(option: SituationOption): string {
  const extra = OPTION_SEARCH_EXTRA[option] ?? '';
  return `${option.toLowerCase()} ${extra}`;
}

function scoreSituationMatch(option: SituationOption, queryLower: string): number {
  const blob = getSearchBlob(option);
  if (blob.includes(queryLower)) {
    return 120 + Math.min(queryLower.length, 40);
  }
  const words = queryLower.split(/\s+/).filter((w) => w.length >= 2);
  let score = 0;
  for (const word of words) {
    if (blob.includes(word)) {
      score += 22;
    }
  }
  if (queryLower.length >= 2 && queryLower.length <= 4) {
    for (const word of blob.split(/\s+/)) {
      if (word.startsWith(queryLower) || queryLower.startsWith(word)) {
        score += 15;
      }
    }
  }
  return score;
}

/**
 * Ranked matches for a non-empty query; empty string returns [].
 */
export function rankSituationsForQuery(query: string, limit = 6): string[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return [];
  }
  const scored: { readonly option: SituationOption; readonly score: number }[] = [];
  for (const option of SITUATION_OPTIONS) {
    const score = scoreSituationMatch(option, trimmed);
    if (score > 0) {
      scored.push({ option, score });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((row) => row.option);
}

/**
 * Local filter for UX: empty query shows the first six situations; otherwise ranked matches.
 */
export function filterSituationsLocally(query: string, limit = 6): string[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return [...getSituationSeed()];
  }
  return rankSituationsForQuery(trimmed, limit);
}

/**
 * Suggestions for the UI: never empty — falls back to the first six canonical situations.
 */
export function getSituationDisplayList(query: string, limit = 6): string[] {
  const trimmed = query.trim();
  const ranked = filterSituationsLocally(trimmed, limit);
  if (ranked.length === 0 && trimmed.length > 0) {
    return [...getSituationSeed()];
  }
  return ranked;
}

export function isWeakLocalMatch(query: string): boolean {
  const trimmed = query.trim();
  if (trimmed.length < 3) {
    return false;
  }
  return rankSituationsForQuery(trimmed, 6).length < 2;
}

export function canonicalOrderToChoices(canonicals: readonly string[]): SituationChoice[] {
  return canonicals.map((value) => ({ label: value, value }));
}

function mentionsDatabase(queryLower: string): boolean {
  return (
    /\bmongo(db)?\b/.test(queryLower) ||
    /\b(atlas|redis|postgres|postgresql|mysql|mariadb|sql|database|db\b|nosql|query|index|replica)\b/.test(
      queryLower,
    )
  );
}

function mentionsVendorTiming(queryLower: string): boolean {
  return /\b(vendor|contractor|outsourc|sla|deadline|delivery|sprint)\b/.test(queryLower);
}

function mentionsBudget(queryLower: string): boolean {
  return /\b(budget|cost|money|fund|roi|license|subscription|pricing)\b/.test(queryLower);
}

function mentionsLeadership(queryLower: string): boolean {
  return /\b(board|leadership|exec|audit|independent|neutral)\b/.test(queryLower);
}

function mentionsScopeChange(queryLower: string): boolean {
  return /\b(scope|requirements|spec|change|creep|churn)\b/.test(queryLower);
}

/**
 * Friendly tap labels when not using AI — reflects query keywords (e.g. MongoDB → DB performance angle).
 */
export function enrichSituationChoiceLabels(query: string, canonicals: readonly string[]): SituationChoice[] {
  const q = query.trim().toLowerCase();
  return canonicals.map((value) => {
    const situation = value as SituationOption;
    if (!q) {
      return { label: value, value };
    }
    if (situation === 'Users are unhappy with the system' && mentionsDatabase(q)) {
      return {
        label: 'Database / app speed / reliability (MongoDB, SQL, caches)',
        value,
      };
    }
    if (situation === 'Users are unhappy with the system' && /\b(slow|latency|timeout|crash|error|bug)\b/.test(q)) {
      return {
        label: 'System feels slow, unstable, or hard to use',
        value,
      };
    }
    if (situation === 'Vendor keeps missing timelines' && mentionsVendorTiming(q)) {
      return {
        label: 'Vendor delivery, deadlines, or milestones slipping',
        value,
      };
    }
    if (situation === 'Budget or scope is unclear' && mentionsBudget(q)) {
      return {
        label: 'Costs, licensing, or scope are unclear',
        value,
      };
    }
    if (situation === 'Leadership needs an independent view' && mentionsLeadership(q)) {
      return {
        label: 'Leadership wants an independent or neutral view',
        value,
      };
    }
    if (situation === 'Requirements keep changing' && mentionsScopeChange(q)) {
      return {
        label: 'Requirements / scope keep shifting',
        value,
      };
    }
    return { label: value, value };
  });
}

/**
 * Merge choices by `value` (canonical), preserving first-seen label; fills up to `limit`.
 */
export function mergeSituationChoices(
  prioritized: readonly SituationChoice[],
  filler: readonly SituationChoice[],
  limit = SITUATION_SEED_COUNT,
): SituationChoice[] {
  const seen = new Set<string>();
  const out: SituationChoice[] = [];
  for (const choice of [...prioritized, ...filler]) {
    if (seen.has(choice.value)) {
      continue;
    }
    seen.add(choice.value);
    out.push(choice);
    if (out.length >= limit) {
      break;
    }
  }
  return out;
}
