'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { Bot, ChevronDown, MessageCircle, Send, Sparkles, Trash2, UserRound } from 'lucide-react';
import { request } from '@/lib/api';

type Message = { role: 'user' | 'assistant'; text: string };
const suggestions = ['Suggest healthy groceries', 'Track my order', 'How does delivery work?'];

type QuickCartAssistantProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export default function QuickCartAssistant({ open: controlledOpen, onOpenChange }: QuickCartAssistantProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (nextOpen: boolean) => {
    setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', text: "Hi! I'm your QuickCart shopping assistant. What can I help you find today?" },
  ]);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  async function send(text = message) {
    const clean = text.trim();
    if (!clean || loading) return;
    setMessage('');
    const next = [...messages, { role: 'user', text: clean } as Message];
    setMessages(next);
    setLoading(true);
    try {
      const response = await request<{ reply: string }>('/api/v1/chat', { method: 'POST', body: { message: clean, history: next.slice(-12, -1) } });
      setMessages((current) => [...current, { role: 'assistant', text: response.reply }]);
    } catch (error) {
      setMessages((current) => [...current, { role: 'assistant', text: error instanceof Error ? error.message : 'The assistant is temporarily unavailable.' }]);
    } finally { setLoading(false); }
  }
  function submit(event: FormEvent) { event.preventDefault(); void send(); }

  return (
    <div className="fixed bottom-5 right-5 z-[80] flex flex-col items-end gap-3">
      {open && (
        <section className="flex h-[520px] max-h-[calc(100vh-110px)] w-[min(390px,calc(100vw-32px))] flex-col overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl">
          <header className="flex items-center justify-between bg-gradient-to-r from-brand-700 to-brand-500 px-5 py-4 text-white">
            <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-full bg-white/15"><Bot size={22} /></div><div><div className="flex items-center gap-1.5 font-bold">QuickCart Assistant <Sparkles size={14} /></div><div className="text-xs text-white/80">Online · Shopping help</div></div></div>
            <div className="flex gap-1"><button type="button" aria-label="Clear conversation" onClick={() => setMessages([{ role: 'assistant', text: 'Conversation cleared. How can I help you shop?' }])} className="rounded-full p-2 hover:bg-white/10"><Trash2 size={17} /></button><button type="button" aria-label="Minimize chat" onClick={() => setOpen(false)} className="rounded-full p-2 hover:bg-white/10"><ChevronDown size={19} /></button></div>
          </header>
          <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50 p-4">
            {messages.map((item, index) => <div key={index} className={`flex gap-2 ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}>{item.role === 'assistant' && <div className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700"><Bot size={16} /></div>}<div className={`max-w-[82%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${item.role === 'user' ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md border border-slate-200 bg-white text-slate-700 shadow-sm'}`}>{item.text}</div>{item.role === 'user' && <div className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-200 text-slate-600"><UserRound size={15} /></div>}</div>)}
            {loading && <div className="flex gap-2"><div className="grid h-7 w-7 place-items-center rounded-full bg-brand-100 text-brand-700"><Bot size={16} /></div><div className="rounded-2xl rounded-bl-md border bg-white px-4 py-3 text-sm text-slate-400">Thinking…</div></div>}
            {messages.length === 1 && <div className="flex flex-wrap gap-2 pl-9">{suggestions.map((item) => <button key={item} onClick={() => void send(item)} className="rounded-full border border-brand-200 bg-white px-3 py-2 text-xs font-bold text-brand-700 hover:bg-brand-50">{item}</button>)}</div>}
            <div ref={endRef} />
          </div>
          <form onSubmit={submit} className="flex gap-2 border-t bg-white p-3"><input value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} placeholder="Ask about products, orders…" className="min-w-0 flex-1 rounded-full border border-slate-200 px-4 text-sm outline-none focus:border-brand-500" /><button type="submit" disabled={!message.trim() || loading} aria-label="Send message" className="grid h-11 w-11 place-items-center rounded-full bg-brand-600 text-white disabled:opacity-40"><Send size={18} /></button></form>
        </section>
      )}
      <button type="button" aria-label={open ? 'Close QuickCart assistant' : 'Open QuickCart assistant'} onClick={() => setOpen(!open)} className="flex h-14 items-center gap-2 rounded-full bg-brand-600 px-5 text-sm font-bold text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-brand-700">{open ? <ChevronDown size={20} /> : <MessageCircle size={21} />} {open ? 'Close' : 'QuickCart AI'}</button>
    </div>
  );
}
