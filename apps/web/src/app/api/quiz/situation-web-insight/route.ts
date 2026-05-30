import { openai } from '@ai-sdk/openai';
import { generateText, stepCountIs } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const requestSchema = z.object({
  query: z.string().max(500),
});

function resolveWebInsightModel(): string {
  return process.env.OPENAI_WEB_INSIGHT_MODEL ?? 'gpt-4.1-mini';
}

function collectSourceUrls(sources: readonly { readonly url?: string }[]): string[] {
  const urls: string[] = [];
  for (const source of sources) {
    const url = source.url;
    if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
      urls.push(url);
    }
  }
  return [...new Set(urls)].slice(0, 10);
}

export const maxDuration = 60;

export async function POST(request: Request): Promise<NextResponse> {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        insight: null as string | null,
        sources: [] as string[],
        unavailable: true as const,
        message: 'Web insight requires OPENAI_API_KEY.',
      },
      { status: 200 },
    );
  }
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
  if (trimmed.length < 4) {
    return NextResponse.json({
      insight: null as string | null,
      sources: [] as string[],
      unavailable: true as const,
      message: 'Query too short.',
    });
  }
  try {
    const result = await generateText({
      model: openai.responses(resolveWebInsightModel()),
      tools: {
        web_search: openai.tools.webSearch({
          searchContextSize: 'medium',
          userLocation: {
            type: 'approximate',
            country: 'PH',
            timezone: 'Asia/Manila',
          },
        }),
      },
      stopWhen: stepCountIs(15),
      temperature: 0.35,
      system:
        'You support visitors to TeqMD, a Philippines-focused independent technology advisory practice. Use web search when it improves factual grounding (products, vendors, trends). Stay neutral—no legal, medical, or HR guarantees. Short paragraphs only.',
      prompt: `The visitor typed this situation or topic:\n"${trimmed}"\n\nWrite at most 130 words. Explain briefly what organizations often run into in similar situations (generally, not naming the visitor). Where web sources helped, answer in plain language. End with one sentence on what is useful to clarify in a TeqMD session. If search adds little value, say so briefly and reason from general technology advisory context.`,
    });
    const sources = collectSourceUrls(result.sources as readonly { readonly url?: string }[]);
    const text = result.text.trim();
    if (!text) {
      return NextResponse.json({
        insight: null as string | null,
        sources,
        unavailable: true as const,
        message: 'No summary generated.',
      });
    }
    return NextResponse.json({
      insight: text,
      sources,
      unavailable: false as const,
    });
  } catch {
    return NextResponse.json(
      {
        insight: null as string | null,
        sources: [] as string[],
        unavailable: true as const,
        message: 'Web insight could not be loaded. Try again later.',
      },
      { status: 200 },
    );
  }
}
