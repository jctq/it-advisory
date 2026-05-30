import { NextResponse } from 'next/server';

const HTML_BODY =
  '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Payment</title></head><body style="font-family:system-ui,sans-serif;margin:2rem;line-height:1.5"><p>Payment return received. Close this window and return to the TeqMD app.</p></body></html>';

/**
 * Minimal payment return for native in-app browsers (ASWebAuthenticationSession).
 * No React client — avoids a long-lived “Confirming…” shell inside the auth sheet.
 */
export async function GET(): Promise<Response> {
  return new NextResponse(HTML_BODY, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
