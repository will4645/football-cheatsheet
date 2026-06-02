import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { stripe } from '@/lib/stripe';
import { getSubscription } from '@/lib/subscription';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sub = await getSubscription(userId);
  if (!sub?.stripe_customer_id) {
    return NextResponse.json({ error: 'No subscription found' }, { status: 404 });
  }

  const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://cheatsheets.co.uk';

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${origin}/dashboard`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    console.error('[portal] Stripe error:', e.message);
    return NextResponse.json({ error: 'Failed to open billing portal' }, { status: 500 });
  }
}
