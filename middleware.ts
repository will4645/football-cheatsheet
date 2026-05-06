import { NextResponse } from 'next/server';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublic = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  // Bypass Clerk entirely for the cron sync route — Clerk v5 strips the
  // Authorization header when it can't validate it as a Clerk token, which
  // breaks Vercel's "Authorization: Bearer <CRON_SECRET>" cron auth.
  if (req.nextUrl.pathname.startsWith('/api/sync')) return NextResponse.next();
  if (!isPublic(req)) await auth();
});

export const config = {
  matcher: ['/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)', '/(api|trpc)(.*)'],
};
