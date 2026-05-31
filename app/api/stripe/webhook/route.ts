import { NextRequest, NextResponse } from 'next/server';
import { upsertSubscription, getSubscription } from '@/lib/subscription';
import { sendWelcomeEmail } from '@/lib/email';
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

    // In API 2026-04-22.dahlia, period_end lives on invoice line items, not invoice.period_end
    const invoice = (sub as any).latest_invoice;
    const lineEnd = invoice?.lines?.data?.[0]?.period?.end;
    const rawEnd = lineEnd ?? (sub as any).current_period_end;
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

  async function retrieveWithExpand(subId: string) {
    return stripe.subscriptions.retrieve(subId, { expand: ['latest_invoice.lines'] } as any);
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
        const sub = await retrieveWithExpand(subId);
        if (!sub.metadata?.clerkUserId && session.metadata?.clerkUserId) {
          await stripe.subscriptions.update(subId, {
            metadata: { clerkUserId: session.metadata.clerkUserId },
          });
          (sub.metadata as any).clerkUserId = session.metadata.clerkUserId;
        }
        await handleSubscription(sub);

        // Send welcome email — fire and forget, never block the webhook response
        const email = session.customer_details?.email ?? (session as any).customer_email ?? '';
        const name  = session.customer_details?.name ?? '';
        const firstName = name.split(' ')[0] ?? '';
        if (email) {
          const trialEnd = sub.status === 'trialing' && (sub as any).trial_end
            ? new Date((sub as any).trial_end * 1000)
            : null;
          sendWelcomeEmail(email, firstName, trialEnd).catch(err =>
            console.error('Welcome email failed:', err?.message ?? err)
          );
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const eventSub = event.data.object as Stripe.Subscription;
        const sub = await retrieveWithExpand(eventSub.id);
        await handleSubscription(sub);
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
