'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, AlertTriangle, ShieldCheck, RefreshCw, Terminal, Sparkles } from 'lucide-react';

export function AkarFloatingWidget({
  authToken,
  activeWorkspace,
  apiFetch,
  onNotify,
}: {
  authToken?: string | null;
  activeWorkspace?: any;
  apiFetch?: <T>(path: string, init?: RequestInit) => Promise<T>;
  onNotify?: (msg: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<
    Array<{ sender: 'user' | 'akar'; text: string; time: string; errorAlert?: boolean }>
  >([
    {
      sender: 'akar',
      text: 'Halo Mas Firman! AKAR (TUMBU AI Sentinel) aktif menjaga platform 24/7. Ada yang perlu diperbaiki atau dievaluasi langsung di halaman ini?',
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  const handleSend = async (e?: React.FormEvent, customPrompt?: string) => {
    e?.preventDefault();
    const prompt = (customPrompt || input).trim();
    if (!prompt || loading) return;

    const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const userMsg = { sender: 'user' as const, text: prompt, time: timeStr };
    setMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) setInput('');
    setLoading(true);

    try {
      if (apiFetch) {
        const res = await apiFetch<{ success: boolean; message?: string; error?: string }>('/sentinel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'chat',
            prompt,
            systemContext: activeWorkspace?.id ? {
              workspace: activeWorkspace.name,
              workspaceId: activeWorkspace.id,
              jenisUsaha: activeWorkspace.jenisUsaha,
              isControlPlane: false,
            } : {
              workspace: 'Platform Master Admin',
              workspaceId: 'control_plane',
              isControlPlane: true,
            },
            history: messages.slice(-6).map((m) => ({ role: m.sender, content: m.text })),
          }),
        });

        if (res?.message) {
          setMessages((prev) => [
            ...prev,
            { sender: 'akar', text: res.message!, time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            { sender: 'akar', text: res?.error || 'Pesan diterima dan dieksekusi di backend.', time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) },
          ]);
        }
      } else {
        setMessages((prev) => [
          ...prev,
          { sender: 'akar', text: `Instruksi diterima: "${prompt}". AKAR sedang memproses di backend...`, time: timeStr },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'akar',
          text: `⚠️ Laporan Sentinel: ${err?.message || 'Gagal terhubung ke backend AI'}. AKAR mencatat insiden ini untuk dievaluasi.`,
          time: timeStr,
          errorAlert: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-[9999] font-sans">
      {/* Floating Toggle Button */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group relative flex items-center gap-2.5 px-4 py-3 rounded-full bg-[#0F172A] hover:bg-[#1E293B] text-white border-2 border-[#22C55E]/40 shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95"
          aria-label="Buka AKAR AI Sentinel"
        >
          <div className="relative flex items-center justify-center">
            <span className="absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75 animate-ping" />
            <div className="relative w-8 h-8 rounded-full bg-[#22C55E]/20 border border-[#22C55E] flex items-center justify-center text-[#22C55E]">
              <Bot className="w-5 h-5" />
            </div>
          </div>
          <div className="text-left hidden sm:block">
            <div className="text-xs font-extrabold tracking-wide flex items-center gap-1.5 text-white">
              <span>AKAR Sentinel</span>
              <span className="w-2 h-2 rounded-full bg-[#22C55E]" />
            </div>
            <div className="text-[10px] text-slate-400 font-medium">Penjaga 24/7 Live Preview</div>
          </div>
        </button>
      )}

      {/* Floating Chat Drawer Window */}
      {open && (
        <div className="w-[360px] sm:w-[420px] h-[520px] rounded-[24px] bg-[#0F172A] border-2 border-[#22C55E]/30 shadow-2xl flex flex-col overflow-hidden text-white animate-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#22C55E]/20 border border-[#22C55E]/40 flex items-center justify-center text-[#22C55E]">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-extrabold text-white flex items-center gap-2">
                  <span>AKAR AI Sentinel</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/30">
                    ONLINE 24/7
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">TUMBU OS Guardian & Live Review</div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              aria-label="Tutup Chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Context Banner */}
          <div className="px-4 py-2 bg-slate-950/60 border-b border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5 truncate">
              <ShieldCheck className="w-3.5 h-3.5 text-[#22C55E] shrink-0" />
              <span className="truncate">Context: {activeWorkspace?.name || 'Platform Master Admin'}</span>
            </div>
            <span className="font-mono text-[10px] text-slate-500">v1.0 RC</span>
          </div>

          {/* Messages Body */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 text-xs">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] p-3 rounded-2xl whitespace-pre-wrap leading-relaxed shadow-md ${
                    m.sender === 'user'
                      ? 'bg-[#0EA5E9] text-white rounded-br-none font-medium'
                      : m.errorAlert
                      ? 'bg-rose-950/80 text-rose-200 border border-rose-500/40 rounded-bl-none'
                      : 'bg-slate-800/90 text-slate-100 border border-slate-700/60 rounded-bl-none'
                  }`}
                >
                  {m.text}
                </div>
                <span className="text-[10px] text-slate-500 mt-1 px-1">{m.time}</span>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-slate-800/80 text-slate-300 border border-slate-700/50 w-fit">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#22C55E]" />
                <span className="text-xs">AKAR sedang memproses & mengevaluasi...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Action Suggestions */}
          <div className="px-3 py-2 bg-slate-900/60 border-t border-slate-800/50 flex items-center gap-1.5 overflow-x-auto text-[11px] no-scrollbar">
            <button
              type="button"
              onClick={() => handleSend(undefined, 'Lakukan audit kesehatan sistem & database sekarang')}
              className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 shrink-0 transition"
            >
              🛡️ Audit Sistem
            </button>
            <button
              type="button"
              onClick={() => handleSend(undefined, 'Cek status transaksi & kas terkini')}
              className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 shrink-0 transition"
            >
              📊 Cek Transaksi
            </button>
          </div>

          {/* Form Input */}
          <form onSubmit={handleSend} className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ketik instruksi / evaluasi halaman..."
              className="flex-1 bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#22C55E]"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="p-2 rounded-xl bg-[#22C55E] hover:bg-[#1eb04d] disabled:opacity-50 text-slate-950 font-bold transition"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
