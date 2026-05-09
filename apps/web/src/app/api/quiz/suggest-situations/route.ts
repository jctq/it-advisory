import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  SITUATION_OPTIONS,
  type SituationChoice,
  enrichSituationChoiceLabels,
  getSituationSeed,
  mergeSituationChoices,
  mergeSituationSuggestions,
  rankSituationsForQuery,
} from '@/lib/marketing/situation-options';

const requestSchema = z.object({
  query: z.string().max(500),
});

const situationEnum = z.enum(SITUATION_OPTIONS as unknown as [string, ...string[]]);

const phraseResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        label: z.string().min(4).max(160),
        situation: situationEnum,
      }),
    )
    .min(1)
    .max(6),
});

function resolveSituationModel(): string {
  return process.env.OPENAI_SITUATION_MODEL ?? 'gpt-4o-mini';
}

function buildChoicesFromCanonicals(query: string, canonicals: readonly string[]): SituationChoice[] {
  return enrichSituationChoiceLabels(query, canonicals);
}

function padChoicesWithSeed(query: string, choices: readonly SituationChoice[]): SituationChoice[] {
  const filler = enrichSituationChoiceLabels(query, [...getSituationSeed()]);
  return mergeSituationChoices(choices, filler);
}

function normalizeAiChoices(
  raw: readonly { readonly label: string; readonly situation: string }[],
  query: string,
  orderedFallback: readonly string[],
): SituationChoice[] {
  const allowed = new Set<string>(SITUATION_OPTIONS);
  const picked: SituationChoice[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    const situation = row.situation.trim();
    if (!allowed.has(situation) || seen.has(situation)) {
      continue;
    }
    seen.add(situation);
    picked.push({
      label: row.label.trim(),
      value: situation,
    });
  }
  const filler = enrichSituationChoiceLabels(query, orderedFallback);
  return mergeSituationChoices(picked, filler);
}

export async function POST(request: Request): Promise<NextResponse> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const trimmed = parsed.data.query.trim();
  const orderedCanonical = mergeSituationSuggestions(rankSituationsForQuery(trimmed, 6), [...getSituationSeed()]);
  if (!trimmed) {
    const choices = buildChoicesFromCanonicals('', [...getSituationSeed()]);
    return NextResponse.json({
      choices,
      source: 'seed' as const,
    });
  }
  const apiKey = process.env.OPENAI_API_KEY;
  const shouldAskPhrases = Boolean(apiKey) && trimmed.length >= 3;
  if (!shouldAskPhrases) {
    const choices = padChoicesWithSeed(trimmed, buildChoicesFromCanonicals(trimmed, orderedCanonical));
    return NextResponse.json({
      choices,
      source: 'local_phrases' as const,
    });
  }
  const optionLines = SITUATION_OPTIONS.map((option) => `- ${option}`).join('\n');
  const priorityLine = orderedCanonical.join(' → ');
  try {
    const { object } = await generateObject({
      model: openai(resolveSituationModel()),
      schema: phraseResponseSchema,
      temperature: 0.35,
      system:
        'You write tap-friendly chip labels for an IT advisory intake (Philippines market). Each chip maps to exactly one canonical situation from the allowed list. Labels must be plain language and may echo the user\'s words (e.g. "MongoDB feels slow", "scope keeps shifting"). Never invent new situation categories — only use `situation` strings from the allowed list verbatim.',
      prompt: `User wrote:\n"${trimmed}"\n\nCanonical situations (best → worst fit for this text):\n${priorityLine}\n\nAllowed situation strings (copy exactly into situation):\n${optionLines}\n\nReturn up to 6 items in choices[]. Label = short phrase the user would tap (max ~120 chars). Situation = one allowed string per row. Order best match first. Prefer diverse situations when several apply (do not repeat the same situation twice).`,
    });
    const merged = normalizeAiChoices(object.choices, trimmed, orderedCanonical);
    const choices = padChoicesWithSeed(trimmed, merged);
    return NextResponse.json({
      choices,
      source: 'phrases' as const,
    });
  } catch {
    const choices = padChoicesWithSeed(trimmed, buildChoicesFromCanonicals(trimmed, orderedCanonical));
    return NextResponse.json({
      choices,
      source: 'error_fallback' as const,
    });
  }
}
