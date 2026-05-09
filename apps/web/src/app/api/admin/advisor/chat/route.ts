import { openai } from '@ai-sdk/openai';
import { convertToModelMessages, streamText, type UIMessage } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { buildAdvisorSystemPrompt, DEFAULT_ADVISOR_CONTEXT } from '@/lib/ai/advisor-prompt';

const DEFAULT_ADVISOR_MODEL = 'gpt-4.1';
const DEFAULT_TEMPERATURE = 0.6;

const textPartSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
  state: z.enum(['streaming', 'done']).optional(),
});

const messagePartSchema = z.union([
  textPartSchema,
  z.object({ type: z.string() }).passthrough(),
]);

const messageSchema = z.object({
  id: z.string(),
  role: z.enum(['system', 'user', 'assistant']),
  parts: z.array(messagePartSchema).min(1),
});

const requestSchema = z.object({
  id: z.string().optional(),
  messages: z.array(messageSchema).min(1),
});

function resolveAdvisorModel(): string {
  const raw = process.env.OPENAI_ADVISOR_MODEL?.trim();
  return raw && raw.length > 0 ? raw : DEFAULT_ADVISOR_MODEL;
}

export async function POST(request: Request): Promise<Response> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'Advisor chat requires OPENAI_API_KEY.', code: 'missing_key' },
      { status: 503 },
    );
  }
  const uiMessages = parsed.data.messages as UIMessage[];
  const modelId = resolveAdvisorModel();
  const system = buildAdvisorSystemPrompt(DEFAULT_ADVISOR_CONTEXT);
  const modelMessages = await convertToModelMessages(uiMessages);
  const result = streamText({
    model: openai.chat(modelId),
    system,
    messages: modelMessages,
    temperature: DEFAULT_TEMPERATURE,
  });
  return result.toUIMessageStreamResponse();
}
