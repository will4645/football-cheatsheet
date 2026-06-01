import { createClient } from '@supabase/supabase-js';

function getClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function getSubscription(clerkUserId: string) {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('subscriptions')
    .select('status, current_period_end, stripe_customer_id, stripe_subscription_id')
    .eq('clerk_user_id', clerkUserId)
    .single();
  if (error && error.code !== 'PGRST116') {
    console.error('getSubscription error:', error.message);
  }
  return data ?? null;
}

export async function isSubscribed(clerkUserId: string): Promise<boolean> {
  const sub = await getSubscription(clerkUserId);
  if (!sub) return false;
  if (sub.status === 'active' || sub.status === 'trialing') return true;
  // Grace period: allow past_due for up to 3 days
  if (sub.status === 'past_due' && sub.current_period_end) {
    const grace = new Date(sub.current_period_end).getTime() + 3 * 86_400_000;
    return Date.now() < grace;
  }
  return false;
}

export async function upsertSubscription(params: {
  clerkUserId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  status: string;
  currentPeriodEnd: Date;
}) {
  const supabase = getClient();
  const { error } = await supabase.from('subscriptions').upsert({
    clerk_user_id: params.clerkUserId,
    stripe_customer_id: params.stripeCustomerId,
    stripe_subscription_id: params.stripeSubscriptionId,
    status: params.status,
    current_period_end: params.currentPeriodEnd.toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'clerk_user_id' });
  if (error) throw new Error(`upsertSubscription failed: ${error.message}`);
}
