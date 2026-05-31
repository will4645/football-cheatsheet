import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { stripe } from '@/lib/stripe';
import { getSubscription } from '@/lib/subscription';

export const dynamic = 'force-dynamic';

async function emailHadPriorSubscription(email: string): Promise<boolean> {
  const customers = await stripe.customers.list({ email, limit: 10 });
  for (const customer of customers.data) {
    const subs = await stripe.subscriptions.list({ customer: customer.id, limit: 1, status: 'all' });
    if (subs.data.length > 0) return true;
  }
  return false;
}

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

    const [existing, user] = await Promise.all([
      getSubscription(userId),
      currentUser(),
    ]);

    const customerParams = existing?.stripe_customer_id
      ? { customer: existing.stripe_customer_id }
      : {};

    // Option 1: any prior subscription row in our DB (any status) → no trial
    let trialEligible = !existing;

    // Option 2: same email already used a trial on Stripe → no trial
    if (trialEligible) {
      const email = user?.emailAddresses[0]?.emailAddress ?? '';
      if (email) trialEligible = !(await emailHadPriorSubscription(email));
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      ...customerParams,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        metadata: { clerkUserId: userId },
        ...(trialEligible ? { trial_period_days: 4 } : {}),
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
