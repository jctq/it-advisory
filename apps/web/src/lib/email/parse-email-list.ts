const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Parses a comma- or newline-separated list of email addresses.
 */
export function parseEmailList(raw: string): readonly string[] {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return [];
  }
  const seen = new Set<string>();
  const results: string[] = [];
  for (const part of trimmed.split(/[,;\n]+/)) {
    const email = part.trim().toLowerCase();
    if (email.length === 0 || !EMAIL_ADDRESS_PATTERN.test(email) || seen.has(email)) {
      continue;
    }
    seen.add(email);
    results.push(email);
  }
  return results;
}
