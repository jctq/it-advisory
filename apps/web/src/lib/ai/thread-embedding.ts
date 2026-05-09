/** Default OpenAI embedding model — 1536 dimensions when `dimensions` omitted. */
export const DEFAULT_OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small';

export const DEFAULT_EMBEDDING_DIMENSIONS = 1536 as const;

export function resolveOpenAiEmbeddingModel(): string {
  const raw = process.env.OPENAI_EMBEDDING_MODEL?.trim();
  return raw && raw.length > 0 ? raw : DEFAULT_OPENAI_EMBEDDING_MODEL;
}

/**
 * Optional explicit dimensions for models that support reduction (e.g. text-embedding-3-*).
 * When unset, the API default applies (1536 for text-embedding-3-small).
 */
export function resolveEmbeddingDimensions(): number | undefined {
  const raw = process.env.OPENAI_EMBEDDING_DIMENSIONS?.trim();
  if (!raw || raw.length === 0) {
    return undefined;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export type EmbedTextResult = {
  readonly embedding: readonly number[];
  readonly model: string;
};

/**
 * Calls OpenAI Embeddings API for the diagnostic cache vector index.
 */
export async function embedTextForDiagnosticCache(text: string): Promise<EmbedTextResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.length === 0) {
    throw new Error('OPENAI_API_KEY is required for embeddings');
  }
  const model = resolveOpenAiEmbeddingModel();
  const dimensions = resolveEmbeddingDimensions();
  const body: Record<string, unknown> = {
    model,
    input: text,
  };
  if (dimensions !== undefined) {
    body.dimensions = dimensions;
  }
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI embeddings failed: ${response.status} ${errText}`);
  }
  const json: unknown = await response.json();
  if (
    json === null ||
    typeof json !== 'object' ||
    !('data' in json) ||
    !Array.isArray((json as { data: unknown }).data) ||
    (json as { data: { embedding?: unknown }[] }).data.length === 0
  ) {
    throw new Error('OpenAI embeddings: unexpected response shape');
  }
  const dataArr = (json as { data: { embedding?: unknown }[] }).data;
  const first = dataArr[0];
  if (first === undefined) {
    throw new Error('OpenAI embeddings: empty data array');
  }
  const embedding = first.embedding;
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error('OpenAI embeddings: missing vector');
  }
  const numbers = embedding.map((v) => Number(v));
  if (numbers.some((n) => Number.isNaN(n))) {
    throw new Error('OpenAI embeddings: non-numeric values in vector');
  }
  return { embedding: numbers, model };
}
