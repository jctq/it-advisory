import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Next.js 16+ network boundary (Node runtime). Add auth checks before `/admin` routes.
 */
export function proxy(request: NextRequest): NextResponse {
  void request;
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
