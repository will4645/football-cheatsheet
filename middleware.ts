import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublic = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) await auth();
});

export const config = {
  matcher: [
    // Exclude /api/sync so Clerk never touches the cron request or its Authorization header
    '/((?!_next|api/sync|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api(?!\\/sync)|trpc)(.*)',
  ],
};
