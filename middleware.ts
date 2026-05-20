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
  '/api/stripe/webhook',
]);

export default clerkMiddleware(async (auth, req) => {
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
