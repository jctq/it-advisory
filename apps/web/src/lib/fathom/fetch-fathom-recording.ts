import type { FathomCredentials } from '@/lib/data/recording-settings';

type FathomSummaryJson = {
  readonly summary?: {
    readonly markdown_formatted?: string;
    readonly summary?: string;
  };
};

export async function fetchFathomRecordingSummary(input: {
  readonly credentials: FathomCredentials;
  readonly recordingId: string;
}): Promise<{ readonly summary: string; readonly shareUrl: string } | null> {
  const recordingId = input.recordingId.trim();
  if (recordingId.length === 0) {
    return null;
  }
  try {
    const response = await fetch(
      `https://api.fathom.ai/external/v1/recordings/${encodeURIComponent(recordingId)}/summary`,
      {
        headers: { 'X-Api-Key': input.credentials.apiKey },
        cache: 'no-store',
      },
    );
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as FathomSummaryJson;
    const markdown = payload.summary?.markdown_formatted?.trim() ?? '';
    const plain = payload.summary?.summary?.trim() ?? '';
    const summary = markdown.length > 0 ? markdown : plain;
    return { summary, shareUrl: '' };
  } catch {
    return null;
  }
}
