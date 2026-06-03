/**
 * Parses `ADMIN_ALLOWED_EMAILS` (comma-separated, lowercase-normalized).
 */
export function listAdminAllowedEmails(): readonly string[] {
  const raw = process.env.ADMIN_ALLOWED_EMAILS?.trim() ?? '';
  if (raw.length === 0) {
    return [];
  }
  const emails: string[] = [];
  for (const part of raw.split(',')) {
    const normalized = part.trim().toLowerCase();
    if (normalized.length > 0) {
      emails.push(normalized);
    }
  }
  return emails;
}

/**
 * Returns whether the email may sign in to the admin panel.
 */
export function isAdminEmailAllowed(email: string | null | undefined): boolean {
  const normalized = email?.trim().toLowerCase() ?? '';
  if (normalized.length === 0) {
    return false;
  }
  const allowed = listAdminAllowedEmails();
  return allowed.includes(normalized);
}
