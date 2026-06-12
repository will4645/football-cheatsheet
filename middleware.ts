import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublic = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/preview',
  '/pricing',
  '/privacy',
  '/terms',
  '/how-it-works',
  '/api/matches',
  '/api/matches/(.*)',
  '/api/stripe/webhook',
]);

export default clerkMiddleware(async (auth, req) => {
  // No Server Actions exist in this app, so non-GET requests to page routes are
  // always junk (bot POSTs to / were throwing 500s in the Server Action parser).
  // API routes keep their own methods (Stripe webhook POST etc.).
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !req.nextUrl.pathname.startsWith('/api')) {
    return new NextResponse(null, { status: 405 });
  }
  if (isPublic(req)) return NextResponse.next();
  // Exclude cron/internal API routes so they are never blocked by Clerk
  const pathname = req.nextUrl.pathname;
  if (pathname.startsWith('/api/sync') || pathname.startsWith('/api/prefetch') || pathname.startsWith('/api/debug')) {
    return NextResponse.next();
  }
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn();
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
