import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { stripe } from '@/lib/stripe';
import { getSubscription } from '@/lib/subscription';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://football-cheatsheet.vercel.app';

  // Re-use existing customer if one exists
  const existing = await getSubscription(userId);
  const customerParams = existing?.stripe_customer_id
    ? { customer: existing.stripe_customer_id }
    : { customer_creation: 'always' as const };

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    ...customerParams,
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    subscription_data: {
      metadata: { clerkUserId: userId },
    },
    metadata: { clerkUserId: userId },
    success_url: `${origin}/dashboard?subscribed=1`,
    cancel_url:  `${origin}/pricing`,
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: session.url });
}
