'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Streamdown } from 'streamdown';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { buildApiUrl } from '@/lib/config/build-api-url';
import { cn } from '@/lib/utils';

const ADVISOR_API_URL: string = buildApiUrl('/api/admin/advisor/chat');

type Role = 'system' | 'user' | 'assistant';

type Bubble = {
  readonly id: string;
  readonly role: Role;
  readonly text: string;
  readonly streaming: boolean;
};

function extractText(parts: ReadonlyArray<{ readonly type: string }>): string {
  let out = '';
  for (const part of parts) {
    if (part.type === 'text') {
      const text = (part as { readonly text?: unknown }).text;
      if (typeof text === 'string') {
        out += text;
      }
    }
  }
  return out;
}

function isStreaming(parts: ReadonlyArray<{ readonly type: string }>): boolean {
  for (const part of parts) {
    if (part.type === 'text') {
      const state = (part as { readonly state?: unknown }).state;
      if (state === 'streaming') {
        return true;
      }
    }
  }
  return false;
}

export function AdvisorChat() {
  const transport = useMemo(() => new DefaultChatTransport({ api: ADVISOR_API_URL }), []);
  const { messages, sendMessage, status, error, stop, regenerate } = useChat({
    transport,
  });
  const [input, setInput] = useState<string>('');
  const isBusy = status === 'submitted' || status === 'streaming';
  const bubbles: Bubble[] = messages.map((m) => ({
    id: m.id,
    role: m.role,
    text: extractText(m.parts),
    streaming: isStreaming(m.parts),
  }));
  function submit(): void {
    const trimmed = input.trim();
    if (trimmed.length === 0 || isBusy) {
      return;
    }
    setInput('');
    void sendMessage({ text: trimmed });
  }
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    submit();
  }
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      submit();
    }
  }
  return (
    <section
      data-admin-tour="page-advisor-chat"
      className="flex flex-1 flex-col gap-4 rounded-lg border bg-card p-4 shadow-xs"
    >
      <div className="flex min-h-[40dvh] flex-col gap-3 overflow-y-auto" aria-live="polite">
        {bubbles.length === 0 ? (
          <EmptyState />
        ) : (
          bubbles.map((b) => <MessageBubble key={b.id} bubble={b} />)
        )}
      </div>
      {error !== undefined && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error.message}
        </div>
      )}
      <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
        <Textarea
          name="prompt"
          placeholder="Ask the advisor — e.g. 'Should I keep the diagnostic cache or rip it out?' (Cmd/Ctrl+Enter to send)"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          disabled={isBusy && status !== 'streaming'}
          aria-label="Message to the advisor"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Status: <span className="font-medium">{status}</span>
            {bubbles.length > 0 ? ` — ${bubbles.length} message${bubbles.length === 1 ? '' : 's'}` : ''}
          </p>
          <div className="flex gap-2">
            {status === 'streaming' && (
              <Button type="button" variant="outline" size="sm" onClick={() => stop()}>
                Stop
              </Button>
            )}
            {status === 'error' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  void regenerate();
                }}
              >
                Retry
              </Button>
            )}
            <Button type="submit" size="sm" disabled={isBusy || input.trim().length === 0}>
              Send
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-start gap-2 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
      <p className="font-medium text-foreground">No conversation yet.</p>
      <p>Try asking:</p>
      <ul className="list-disc pl-5">
        <li>What is the riskiest assumption in the quiz funnel right now?</li>
        <li>Should I add Stripe / PayMongo before launch, or keep mock payments?</li>
        <li>Is the diagnostic cache premature optimisation at this stage?</li>
        <li>What is the smallest auth I can ship that does not embarrass me?</li>
      </ul>
    </div>
  );
}

function MessageBubble({ bubble }: { readonly bubble: Bubble }) {
  const isUser = bubble.role === 'user';
  return (
    <div className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-md border px-3 py-2 text-sm wrap-break-word',
          isUser
            ? 'whitespace-pre-wrap bg-primary text-primary-foreground border-primary'
            : 'bg-background',
        )}
      >
        <p className="mb-1 text-[10px] uppercase tracking-wider opacity-70">{bubble.role}</p>
        {bubble.text.length === 0 ? (
          <span className="opacity-60">…</span>
        ) : isUser ? (
          bubble.text
        ) : (
          <AssistantMarkdown text={bubble.text} streaming={bubble.streaming} />
        )}
      </div>
    </div>
  );
}

function AssistantMarkdown({ text, streaming }: { readonly text: string; readonly streaming: boolean }) {
  return (
    <Streamdown
      mode={streaming ? 'streaming' : 'static'}
      parseIncompleteMarkdown
      className={cn(
        'space-y-3 leading-relaxed',
        '[&_h1]:mt-2 [&_h1]:text-lg [&_h1]:font-semibold',
        '[&_h2]:mt-2 [&_h2]:text-base [&_h2]:font-semibold',
        '[&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:uppercase [&_h3]:tracking-wide [&_h3]:text-muted-foreground',
        '[&_p]:my-1',
        '[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5',
        '[&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5',
        '[&_li]:my-0.5',
        '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2',
        '[&_strong]:font-semibold',
        '[&_em]:italic',
        '[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground',
        '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]',
        '[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:bg-muted [&_pre]:p-3',
        '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
        '[&_hr]:my-3 [&_hr]:border-border',
        '[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs',
        '[&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold',
        '[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1',
      )}
    >
      {text}
    </Streamdown>
  );
}
