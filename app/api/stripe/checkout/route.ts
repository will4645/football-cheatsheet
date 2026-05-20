import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { stripe } from '@/lib/stripe';
import { getSubscription } from '@/lib/subscription';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const billing: 'monthly' | 'annual' = body.billing === 'annual' ? 'annual' : 'monthly';

    const priceId = billing === 'annual'
      ? (process.env.STRIPE_ANNUAL_PRICE_ID ?? process.env.STRIPE_PRICE_ID!)
      : process.env.STRIPE_PRICE_ID!;

    const origin = req.headers.get('origin') ?? 'https://cheatsheets.co.uk';

    const existing = await getSubscription(userId);
    const customerParams = existing?.stripe_customer_id
      ? { customer: existing.stripe_customer_id }
      : {};

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      ...customerParams,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        metadata: { clerkUserId: userId },
        trial_period_days: 7,
      },
      metadata: { clerkUserId: userId },
      success_url: `${origin}/dashboard?subscribed=1`,
      cancel_url: `${origin}/pricing`,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    console.error('Stripe checkout error:', e);
    return NextResponse.json({ error: e.message ?? 'Stripe error' }, { status: 500 });
  }
}
