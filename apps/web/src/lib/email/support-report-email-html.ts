const EMAIL_FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export function escapeSupportEmailHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function buildSupportEmailDetailRows(
  rows: readonly (readonly [label: string, value: string])[],
): string {
  return rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 12px 4px 0;font-weight:600;vertical-align:top;white-space:nowrap;">${escapeSupportEmailHtml(label)}</td><td style="padding:4px 0;word-break:break-word;">${escapeSupportEmailHtml(value)}</td></tr>`,
    )
    .join('');
}

export function buildSupportEmailMessageBlock(message: string): string {
  return `<pre style="white-space:pre-wrap;background:#f4f4f5;padding:12px;border-radius:8px;font-size:14px;line-height:1.5;font-family:${EMAIL_FONT_STACK};">${escapeSupportEmailHtml(message)}</pre>`;
}

export function wrapSupportEmailHtml(params: {
  readonly siteName: string;
  readonly title: string;
  readonly introHtml: string;
  readonly detailRowsHtml?: string;
  readonly messageLabel: string;
  readonly message: string;
}): string {
  const detailsTable =
    params.detailRowsHtml !== undefined && params.detailRowsHtml.length > 0
      ? `<table>${params.detailRowsHtml}</table>`
      : '';
  return `<!DOCTYPE html><html><body style="font-family:${EMAIL_FONT_STACK};color:#18181b;">
<p><strong>${escapeSupportEmailHtml(params.siteName)}</strong> — ${escapeSupportEmailHtml(params.title)}</p>
${params.introHtml}
${detailsTable}
<p style="margin-top:16px;font-weight:600;">${escapeSupportEmailHtml(params.messageLabel)}</p>
${buildSupportEmailMessageBlock(params.message)}
</body></html>`;
}
