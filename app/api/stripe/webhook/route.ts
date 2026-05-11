import { NextRequest, NextResponse } from 'next/server';
import { upsertSubscription, getSubscription } from '@/lib/subscription';
import type Stripe from 'stripe';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { stripe } = await import('@/lib/stripe');

  const body = await req.text();
  const sig  = req.headers.get('stripe-signature') ?? '';

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  async function handleSubscription(sub: Stripe.Subscription) {
    const clerkUserId =
      (sub.metadata?.clerkUserId as string) ??
      (typeof sub.customer === 'string'
        ? await getClerkUserIdFromCustomer(sub.customer)
        : null);
    if (!clerkUserId) return;

    const rawEnd =
      (sub as any).current_period_end ??
      (sub as any).billing?.current_period?.end ??
      (sub as any).billing_details?.current_period?.end;
    console.log('subscription keys:', Object.keys(sub), 'current_period_end:', rawEnd, 'billing:', (sub as any).billing);
    const currentPeriodEnd =
      typeof rawEnd === 'number' ? new Date(rawEnd * 1000) :
      rawEnd ? new Date(rawEnd) :
      new Date(Date.now() + 30 * 86400000);

    await upsertSubscription({
      clerkUserId,
      stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : (sub.customer as any).id,
      stripeSubscriptionId: sub.id,
      status: sub.status,
      currentPeriodEnd,
    });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== 'subscription') break;
        const subId = typeof session.subscription === 'string'
          ? session.subscription
          : (session.subscription as any)?.id;
        if (!subId) break;
        const sub = await stripe.subscriptions.retrieve(subId);
        if (!sub.metadata?.clerkUserId && session.metadata?.clerkUserId) {
          await stripe.subscriptions.update(subId, {
            metadata: { clerkUserId: session.metadata.clerkUserId },
          });
          (sub.metadata as any).clerkUserId = session.metadata.clerkUserId;
        }
        await handleSubscription(sub);
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await handleSubscription(event.data.object as Stripe.Subscription);
        break;
      }
    }
  } catch (err: any) {
    console.error('Webhook handler error:', err?.message ?? err);
    return NextResponse.json({ error: err?.message ?? 'handler error' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function getClerkUserIdFromCustomer(customerId: string): Promise<string | null> {
  // Look up by stripe_customer_id in existing subscriptions table
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const { data } = await sb
    .from('subscriptions')
    .select('clerk_user_id')
    .eq('stripe_customer_id', customerId)
    .single();
  return data?.clerk_user_id ?? null;
}
