'use client';

import { useState } from 'react';

type Message = {
  id: string;
  created_at: string;
  name: string | null;
  email: string;
  message: string;
  read: boolean;
};

export default function MessageList({ messages: initial, secret }: { messages: Message[]; secret: string }) {
  const [messages, setMessages] = useState(initial);

  async function markRead(id: string) {
    await fetch('/api/admin/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, secret }),
    });
    setMessages(prev => prev.map(m => m.id === id ? { ...m, read: true } : m));
  }

  const unread = messages.filter(m => !m.read).length;

  return (
    <>
      <p className="text-xs text-gray-600 mb-8">{messages.length} total · {unread} unread</p>

      {!messages.length ? (
        <p className="text-sm text-gray-600">No messages yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {messages.map(m => (
            <div
              key={m.id}
              className="rounded-xl p-4 flex flex-col gap-2 transition-all"
              style={{
                background: m.read ? 'rgba(255,255,255,0.02)' : 'rgba(22,163,74,0.06)',
                border: m.read ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(22,163,74,0.2)',
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  {m.name && <span className="text-xs font-semibold text-white mr-2">{m.name}</span>}
                  <a href={`mailto:${m.email}`} className="text-xs text-green-400 hover:underline">
                    {m.email}
                  </a>
                </div>
                <span className="text-[10px] text-gray-600 shrink-0">
                  {new Date(m.created_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              </div>

              <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{m.message}</p>

              <div className="flex items-center gap-3 mt-1">
                {!m.read && (
                  <span
                    className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(22,163,74,0.15)', color: '#4ade80' }}
                  >
                    New
                  </span>
                )}
                {!m.read && (
                  <button
                    onClick={() => markRead(m.id)}
                    className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
                  >
                    Mark as read
                  </button>
                )}
                {m.read && (
                  <span className="text-[10px] text-gray-700">Read</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
