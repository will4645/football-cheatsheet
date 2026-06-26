import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import MessageList from './MessageList';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: { secret?: string };
}) {
  if (searchParams.secret !== process.env.SYNC_SECRET) {
    redirect('/');
  }

  const { data: messages, error } = await supabase
    .from('support_messages')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080c14' }}>
        <p className="text-red-400 text-sm">Failed to load messages.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto" style={{ background: '#080c14' }}>
      <h1 className="text-xl font-black text-white mb-1 tracking-tight">Support Messages</h1>
      <MessageList messages={messages ?? []} secret={searchParams.secret!} />
    </div>
  );
}
