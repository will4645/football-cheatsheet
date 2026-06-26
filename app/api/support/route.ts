import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { name, email, message } = await req.json();

    if (!email || !message) {
      return NextResponse.json({ error: 'Email and message are required.' }, { status: 400 });
    }

    if (message.length > 2000) {
      return NextResponse.json({ error: 'Message too long.' }, { status: 400 });
    }

    const { error } = await supabase.from('support_messages').insert({
      name: name?.trim() || null,
      email: email.trim().toLowerCase(),
      message: message.trim(),
    });

    if (error) {
      console.error('[support] Supabase insert error:', error);
      return NextResponse.json({ error: 'Failed to send message.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[support] error:', e);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
