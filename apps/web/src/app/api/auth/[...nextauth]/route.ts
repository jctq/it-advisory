import type { NextRequest } from 'next/server';
import { handlers } from '@/auth';

type AuthRouteContext = {
  params: Promise<{ nextauth: string[] }>;
};

/** next-auth types resolve `next` from a different pnpm path than this app route. */
type AuthRouteHandler = (request: NextRequest) => Promise<Response>;

const getHandler = handlers.GET as unknown as AuthRouteHandler;
const postHandler = handlers.POST as unknown as AuthRouteHandler;

export async function GET(
  request: NextRequest,
  _context: AuthRouteContext,
): Promise<Response> {
  return getHandler(request);
}

export async function POST(
  request: NextRequest,
  _context: AuthRouteContext,
): Promise<Response> {
  return postHandler(request);
}
