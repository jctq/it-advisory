export type ParsedFathomWebhook = {
  readonly recordingId: string;
  readonly title: string;
  readonly startedAt: Date | null;
  readonly shareUrl: string;
  readonly summary: string;
  readonly actionItems: readonly string[];
  readonly recordedByEmail: string;
};

function readString(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return '';
}

function readNestedString(root: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = root[key];
    const direct = readString(value);
    if (direct.length > 0) {
      return direct;
    }
  }
  return '';
}

function parseActionItems(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const items: string[] = [];
  for (const entry of value) {
    if (typeof entry === 'string' && entry.trim().length > 0) {
      items.push(entry.trim());
      continue;
    }
    if (typeof entry === 'object' && entry !== null && !Array.isArray(entry)) {
      const text = readString((entry as Record<string, unknown>).text ?? (entry as Record<string, unknown>).description);
      if (text.length > 0) {
        items.push(text);
      }
    }
  }
  return items;
}

function parseSummary(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const markdown = readString(record.markdown_formatted);
    if (markdown.length > 0) {
      return markdown;
    }
    return readString(record.summary);
  }
  return '';
}

function parseStartedAt(value: unknown): Date | null {
  const raw = readString(value);
  if (raw.length === 0) {
    return null;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

export function parseFathomWebhookPayload(json: unknown): ParsedFathomWebhook | null {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    return null;
  }
  const root = json as Record<string, unknown>;
  const data =
    typeof root.data === 'object' && root.data !== null && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : root;
  const recordingId = readNestedString(data, ['recording_id', 'id', 'recordingId']);
  if (recordingId.length === 0) {
    return null;
  }
  const title = readNestedString(data, ['title', 'meeting_title', 'name']);
  const shareUrl = readNestedString(data, ['share_url', 'url', 'recording_url', 'fathom_url']);
  const startedAt = parseStartedAt(
    data.recording_start_time ?? data.started_at ?? data.start_time ?? data.scheduled_start_time,
  );
  const summary = parseSummary(data.summary ?? data.call_summary);
  const actionItems = parseActionItems(data.action_items ?? data.actionItems);
  const recordedByEmail = readNestedString(data, ['recorded_by', 'host_email', 'user_email']);
  return {
    recordingId,
    title,
    startedAt,
    shareUrl,
    summary,
    actionItems,
    recordedByEmail,
  };
}
