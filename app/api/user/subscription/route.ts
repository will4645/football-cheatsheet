import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ subscribed: false });
  const { getSubscription } = await import('@/lib/subscription');
  const sub = await getSubscription(userId);
  const subscribed = sub ? (
    sub.status === 'active' || sub.status === 'trialing' ||
    (sub.status === 'past_due' && sub.current_period_end &&
      Date.now() < new Date(sub.current_period_end).getTime() + 3 * 86_400_000)
  ) : false;
  return NextResponse.json({
    subscribed,
    status: sub?.status ?? null,
    currentPeriodEnd: sub?.current_period_end ?? null,
  });
}
