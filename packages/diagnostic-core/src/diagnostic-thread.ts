import { createHash } from 'crypto';

/** Round + Q/A shape aligned with diagnostic-round API request `rounds` items. */
export type DiagnosticRoundForThread = {
  readonly roundIndex: number;
  readonly qa: ReadonlyArray<{
    readonly questionId: string;
    readonly question: string;
    readonly answer: string;
  }>;
};

/**
 * Builds the same conversation thread string sent to the diagnostic model (without round suffix instructions).
 */
export function formatDiagnosticThread(
  initialPrompt: string,
  rounds: readonly DiagnosticRoundForThread[],
): string {
  const lines: string[] = [`Initial user message:\n${initialPrompt}`];
  for (const round of rounds) {
    lines.push(`\n--- Round ${round.roundIndex + 1} ---`);
    for (const row of round.qa) {
      lines.push(`Q (${row.questionId}): ${row.question}`);
      lines.push(`A: ${row.answer}`);
    }
  }
  return lines.join('\n');
}

/**
 * Stable normalization for cache keys: normalize newlines and trim each line.
 */
export function normalizeDiagnosticThreadText(thread: string): string {
  return thread
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();
}

export function computeDiagnosticThreadHash(cacheVersion: string, normalizedThread: string): string {
  return createHash('sha256').update(`${cacheVersion}\n${normalizedThread}`, 'utf8').digest('hex');
}
