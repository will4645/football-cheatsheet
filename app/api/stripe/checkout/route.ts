import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { stripe } from '@/lib/stripe';
import { getSubscription } from '@/lib/subscription';

export const dynamic = 'force-dynamic';

async function emailHadPriorSubscription(email: string): Promise<boolean> {
  const customers = await stripe.customers.list({ email, limit: 100 });
  if (!customers.data.length) return false;
  const results = await Promise.all(
    customers.data.map(c => stripe.subscriptions.list({ customer: c.id, limit: 1, status: 'all' }))
  );
  return results.some(r => r.data.length > 0);
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const billing: 'monthly' | 'annual' = body.billing === 'annual' ? 'annual' : 'monthly';

    if (billing === 'annual' && !process.env.STRIPE_ANNUAL_PRICE_ID) {
      console.error('[checkout] STRIPE_ANNUAL_PRICE_ID is not set — cannot fulfil annual checkout');
      return NextResponse.json({ error: 'Annual plan is not available' }, { status: 500 });
    }
    const priceId = billing === 'annual'
      ? process.env.STRIPE_ANNUAL_PRICE_ID!
      : process.env.STRIPE_PRICE_ID!;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cheatsheets.co.uk';

    const [existing, user] = await Promise.all([
      getSubscription(userId),
      currentUser(),
    ]);

    const userEmail = user?.emailAddresses[0]?.emailAddress ?? '';

    // Pre-fill customer email for new subscribers so the Stripe customer is always tied
    // to the Clerk email — prevents bypassing the trial-dedup check by typing a different
    // email in the Stripe Checkout form.
    const customerParams = existing?.stripe_customer_id
      ? { customer: existing.stripe_customer_id }
      : userEmail ? { customer_email: userEmail } : {};

    // Option 1: any prior subscription row in our DB (any status) → no trial
    let trialEligible = !existing;

    // Option 2: same email already used a trial on Stripe → no trial
    if (trialEligible) {
      if (userEmail) {
        try {
          trialEligible = !(await emailHadPriorSubscription(userEmail));
        } catch (err: any) {
          console.error('Trial eligibility check failed (Stripe error):', err?.message ?? err);
          trialEligible = false; // deny trial on error — safer than granting it
        }
      } else {
        // Clerk returned null or no email — can't run Stripe dedup check, deny trial conservatively
        console.warn('Trial eligibility: no email from Clerk for userId', userId, '— denying trial');
        trialEligible = false;
      }
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
      success_url: `${appUrl}/dashboard?subscribed=1`,
      cancel_url: `${appUrl}/pricing`,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    console.error('Stripe checkout error:', e);
    return NextResponse.json({ error: e.message ?? 'Stripe error' }, { status: 500 });
  }
}
