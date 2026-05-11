import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { isSubscribed } from '@/lib/subscription';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ subscribed: false });
  const subscribed = await isSubscribed(userId);
  return NextResponse.json({ subscribed });
}
