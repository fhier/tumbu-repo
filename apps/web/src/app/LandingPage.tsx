'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  getPendingOutboxItems, 
  getOfflineLeads, 
  enqueueOfflineLead, 
  initPwaSyncListener 
} from './pwa-sync-engine';

type Theme = 'light' | 'dark';

export default function LandingPage({ onEnterDashboard }: { onEnterDashboard?: () => void }) {
  // === STATES ===
  const [theme, setTheme] = useState<Theme>('light');
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [scroll, setScroll] = useState(0);
  const [docH, setDocH] = useState(0);
  const [winH, setWinH] = useState(0);
  
  const magnetRef = useRef<HTMLButtonElement>(null);
  const magnetRef2 = useRef<HTMLButtonElement>(null);
  const [mag, setMag] = useState({ x: 0, y: 0 });
  const [mag2, setMag2] = useState({ x: 0, y: 0 });
  
  const [isInstalled, setIsInstalled] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [syncQueueCount, setSyncQueueCount] = useState(3); // Default display mockup

  // === REGISTRATION FORM STATES ===
  const [showRegModal, setShowRegModal] = useState(false);
  const [regName, setRegName] = useState('');
  const [regBusiness, setRegBusiness] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regBlueprintId, setRegBlueprintId] = useState('operational_aquaculture_freshwater');
  const [regNotes, setRegNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // === INITIALIZATION & LISTENERS ===
  useEffect(() => {
    // Load saved theme
    const saved = localStorage.getItem('tumbu-theme') as Theme | null;
    if (saved) {
      setTheme(saved);
    } else {
      setTheme('light');
    }

    const onScroll = () => setScroll(window.scrollY);
    const onResize = () => {
      setDocH(document.documentElement.scrollHeight);
      setWinH(window.innerHeight);
    };

    const onMouse = (e: MouseEvent) => {
      setMouse({ x: e.clientX, y: e.clientY });

      // Magnetic CTA 1
      if (magnetRef.current) {
        const r = magnetRef.current.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const d = Math.hypot(dx, dy);
        if (d < 220) {
          setMag({ x: dx * 0.28, y: dy * 0.28 });
        } else {
          setMag({ x: 0, y: 0 });
        }
      }

      // Magnetic CTA 2 (Footer)
      if (magnetRef2.current) {
        const r = magnetRef2.current.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const d = Math.hypot(dx, dy);
        if (d < 220) {
          setMag2({ x: dx * 0.28, y: dy * 0.28 });
        } else {
          setMag2({ x: 0, y: 0 });
        }
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    window.addEventListener('mousemove', onMouse, { passive: true });
    onResize();

    // PWA Sync Listener Integration
    initPwaSyncListener((online, pendingCount) => {
      setIsOnline(online);
      // Sync queue count is either actual pending items or at least some default mockup number for premium look
      setSyncQueueCount(pendingCount > 0 ? pendingCount : 3);
    });

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMouse);
    };
  }, []);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('tumbu-theme', next);
  };

  const isDark = theme === 'dark';

  // === DYNAMIC STYLES ===
  const bgClass = isDark 
    ? 'bg-gradient-to-b from-[#0F1E3A] to-[#132040] text-white selection:bg-[#0F9365] selection:text-white' 
    : 'bg-[#F9FBF7] text-[#0F1E3A] selection:bg-[#0F9365] selection:text-white';

  const cardClass = isDark 
    ? 'bg-[#1A2E4A] border-white/10 text-white' 
    : 'bg-white border-[#0F1E3A]/8 text-[#0F1E3A]';

  const secondaryText = isDark ? 'text-white/70' : 'text-[#0F1E3A]/60';
  const strokeClass = isDark ? 'text-stroke-dark' : 'text-stroke-light';

  // Bento Modules Data matching Framer version exactly
  const bentoModules = [
    { k: '01', title: 'KOLAM OS', desc: 'Suhu, pH, DO realtime. Tetap jalan offline di tengah sawah. Sync pas ada sinyal.', size: 'col-span-12 md:col-span-7', accent: 'from-[#0F9365]/20 to-transparent' },
    { k: '02', title: 'BENIH TRACK', desc: 'QR per batch. Trace dari penetasan sampe panen. Anti tuker-tuker benih.', size: 'col-span-12 md:col-span-5', accent: 'from-white/10 to-transparent' },
    { k: '03', title: 'PAKAN IQ', desc: 'Hitung FCR otomatis. Kasih tau kapan kebanyakan, kapan kurang. Hemat 23%.', size: 'col-span-12 md:col-span-6 lg:col-span-4', accent: 'from-[#0F9365]/10 to-transparent' },
    { k: '04', title: 'PANEN LEDGER', desc: 'Timbang, foto, langsung jadi invoice. Gak ada lagi nota hilang.', size: 'col-span-12 md:col-span-6 lg:col-span-8', accent: 'from-white/5 to-transparent' },
    { k: '05', title: 'KASBON', desc: 'Catat hutang pakan, bayar panen. Jujur-jujuran tapi rapi.', size: 'col-span-12 md:col-span-5', accent: 'from-[#0F9365]/15 to-transparent' },
    { k: '06', title: 'MITRA SYNC', desc: 'Kerja bareng petani lain tanpa WA berisik. Queue system, bukan chat.', size: 'col-span-12 md:col-span-7', accent: 'from-white/10 to-transparent' },
    { k: '07', title: 'PASAR TUMBU', desc: 'Jual langsung ke pengepul verified. Harga live, no tengkulak main harga.', size: 'col-span-12 md:col-span-6', accent: 'from-[#0F9365]/10 to-transparent' },
    { k: '08', title: 'ANALITIK SAWAH', desc: 'Prediksi panen pake data kolam lu sendiri, bukan teori Jakarta.', size: 'col-span-12 md:col-span-6', accent: 'from-white/5 to-transparent' }
  ];

  // Submission handler
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName || !regBusiness || !regEmail || !regPassword) {
      triggerToast("Nama, Email, Password, dan Nama Usaha wajib diisi.");
      return;
    }

    setIsSubmitting(true);
    const getResolvedApiBaseUrl = () => {
      const raw = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
      if (typeof window !== 'undefined') {
        if (!window.location.hostname.includes('localhost') && (raw.includes('localhost') || raw.includes('127.0.0.1'))) {
          return '/api';
        }
      }
      return raw.replace(/\/$/, '');
    };
    const apiBaseUrl = getResolvedApiBaseUrl();
    try {
      // STEP A: Register user
      const authRes = await fetch(`${apiBaseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: regName, email: regEmail, password: regPassword }),
      });
      
      if (!authRes.ok) {
        const err = await authRes.json();
        throw new Error(err.message || 'Gagal mendaftar auth.');
      }
      
      const authData = await authRes.json();
      const token = authData.token;
      if (!token) throw new Error('Token tidak diterima dari server.');
      
      localStorage.setItem('tumbu_token', token);

      // STEP B: Create workspace
      const wsRes = await fetch(`${apiBaseUrl}/platform/my/workspaces`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: regBusiness, blueprintId: regBlueprintId, phone: regPhone }),
      });

      if (!wsRes.ok) {
        const err = await wsRes.json();
        throw new Error(`Auth sukses tapi gagal membuat workspace: ${err.message || ''}`);
      }

      const wsData = await wsRes.json();
      const workspaceId = wsData.id;

      // STEP C: Activate workspace
      if (workspaceId) {
        await fetch(`${apiBaseUrl}/platform/workspaces/activate`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ id: workspaceId }),
        });
      }

      // STEP D: Enter Dashboard
      triggerToast("Pendaftaran berhasil! Mengalihkan ke dashboard...");
      setShowRegModal(false);
      setRegName(''); setRegBusiness(''); setRegPhone(''); setRegEmail(''); setRegPassword('');
      if (onEnterDashboard) onEnterDashboard();

    } catch (err) {
      triggerToast(`Gagal: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`min-h-screen w-full max-w-[100vw] overflow-x-hidden antialiased relative transition-colors duration-300 ${bgClass}`} style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      
      {/* 1. GRAIN OVERLAY & KEYFRAMES */}
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&display=swap');
        *{scroll-behavior:smooth}
        .font-display{font-family:'Space Grotesk', sans-serif}
        .text-stroke-light {
          -webkit-text-stroke: 1.5px #0F1E3A;
          color: transparent;
        }
        .text-stroke-dark {
          -webkit-text-stroke: 1.5px white;
          color: transparent;
        }
        .text-outline-emerald {
          -webkit-text-stroke: 1.5px #0F9365;
          color: transparent;
        }
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0) rotateX(10deg) rotateY(-10deg) translateZ(0); }
          50% { transform: translateY(-14px) rotateX(12deg) rotateY(-12deg) translateZ(0); }
        }
        @keyframes float2 {
          0%, 100% { transform: translateY(0) rotateX(-6deg) rotateY(12deg) translateZ(0); }
          50% { transform: translateY(-10px) rotateX(-8deg) rotateY(14deg) translateZ(0); }
        }
        .animate-float1 {
          animation: float 6s ease-in-out infinite;
        }
        .animate-float2 {
          animation: float2 7s ease-in-out infinite;
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .shimmer-border {
          position: relative;
          overflow: hidden;
        }
        .shimmer-border::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(90deg, transparent, rgba(15, 147, 101, 0.4), transparent);
          background-size: 200% 100%;
          animation: shimmer 2.5s linear infinite;
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }
      ` }} />

      {/* GRAIN TEXTURE */}
      <div className="absolute inset-0 opacity-[0.035] pointer-events-none z-[1]" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg viewBox=0 0 256 256 xmlns=http://www.w3.org/2000/svg%3E%3Cfilter id=noise%3E%3CfeTurbulence type=fractalNoise baseFrequency=0.9/%3E%3C/filter%3E%3Crect width=100%25 height=100%25 filter=url(%23noise)/%3E%3C/svg%3E')" }} />

      {/* 2. MESH BLOB */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className={`absolute top-[-200px] left-[-200px] w-[800px] h-[800px] rounded-full blur-[120px] transition-colors duration-500 ${isDark ? 'bg-[#0F9365]/15' : 'bg-[#0F9365]/8'}`} />
        <div className={`absolute bottom-[-200px] right-[-200px] w-[800px] h-[800px] rounded-full blur-[120px] transition-colors duration-500 ${isDark ? 'bg-[#0F1E3A]/80' : 'bg-[#0F1E3A]/5'}`} />
      </div>

      {/* 3. SPOTLIGHT CURSOR */}
      <div 
        className="fixed inset-0 pointer-events-none z-10"
        style={{
          background: `radial-gradient(600px circle at ${mouse.x}px ${mouse.y}px, rgba(15, 147, 101, 0.12), transparent 80%)`
        }}
      />

      {/* 8. SCROLL PROGRESS BAR */}
      <div className="fixed top-0 left-0 h-[2px] w-full max-w-[100vw] z-[100] origin-left bg-white/10">
        <div 
          className="h-full bg-[#0F9365] shadow-[0_0_10px_#0F9365]"
          style={{ width: `${docH ? (scroll / (docH - winH)) * 100 : 0}%`, transition: 'width 0.1s linear' }}
        />
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-[200] px-5 py-3 rounded-full bg-white text-black font-mono text-[12px] tracking-wide shadow-[0_10px_40px_rgba(0,0,0,0.5)] flex items-center gap-2 max-w-[90vw]">
          <span className="w-2 h-2 rounded-full bg-[#0F9365] animate-pulse" />
          <span>{toast}</span>
        </div>
      )}

      {/* =========================================
          1. NAV
          ========================================= */}
      <nav className={`fixed top-0 left-0 right-0 z-40 h-[72px] border-b backdrop-blur-md transition-colors duration-300 ${isDark ? 'bg-[#0F1E3A]/70 border-white/10' : 'bg-[#F9FBF7]/70 border-[#0F1E3A]/8'}`}>
        <div className="max-w-[1440px] w-full h-full mx-auto px-6 md:px-12 lg:px-20 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
              <path d="M36 24C36 17.3726 30.6274 12 24 12C17.3726 12 12 17.3726 12 24C12 30.6274 17.3726 36 24 36C28.6946 36 32.7667 33.3008 34.7869 29.3333" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
              <circle cx="36" cy="12" r="4" fill="#0F9365" />
            </svg>
            <span className="font-display font-bold text-[18px] tracking-tight">TUMBU HYBRID <small className="font-medium opacity-60">v2.0</small></span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border text-[12px] transition-colors ${isDark ? 'border-white/10 bg-white/5' : 'border-[#0F1E3A]/10 bg-[#0F1E3A]/5'}`}>
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-[#0F9365]' : 'bg-red-500'} animate-pulse`} />
              <span>{isOnline ? 'Online' : 'Offline'} • Latency 24ms</span>
            </div>
            
            <button 
              onClick={() => { if (onEnterDashboard) onEnterDashboard(); }} 
              className={`hidden md:block px-4 py-2 rounded-full text-[13px] font-bold tracking-wide transition-all ${isDark ? 'text-white hover:bg-white/10' : 'text-[#0F1E3A] hover:bg-[#0F1E3A]/10'}`}
            >
              Masuk
            </button>
            <button 
              onClick={() => setShowRegModal(true)} 
              className={`hidden md:block px-4 py-2 rounded-full text-[13px] font-bold tracking-wide transition-all ${isDark ? 'bg-white text-[#0F1E3A] hover:bg-white/90' : 'bg-[#0F1E3A] text-white hover:bg-[#0F1E3A]/90'}`}
            >
              Daftar Gratis
            </button>
            
            <button 
              onClick={toggleTheme} 
              className={`px-4 py-2 rounded-full border text-[13px] font-medium transition-all ${isDark ? 'border-white/20 bg-white/10 hover:bg-white/20 text-white' : 'border-[#0F1E3A]/20 bg-[#0F1E3A]/10 hover:bg-[#0F1E3A]/20 text-[#0F1E3A]'}`}
            >
              {isDark ? '☀️ Terang' : '🌙 Gelap'}
            </button>
          </div>
        </div>
      </nav>

      {/* =========================================
          2. HERO SECTION
          ========================================= */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-6 md:px-12 lg:px-20 max-w-[1440px] mx-auto flex flex-col lg:flex-row items-center justify-between min-h-[95vh] overflow-hidden">
        
        <div className="lg:w-[58%] z-10 flex flex-col items-start text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0F9365]/10 border border-[#0F9365]/20 text-[10px] font-mono tracking-[0.2em] text-[#0F9365] mb-6 md:mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0F9365] animate-pulse" />
            <span>OFFLINE-FIRST • NO SIGNAL NEEDED</span>
          </div>
          
          <h1 className="font-display font-[700] leading-[0.85] tracking-[-0.04em]">
            <span className="block text-[18vw] md:text-[11vw] lg:text-[9vw] leading-[0.85]">TUMBU</span>
            <span className={`block text-[18vw] md:text-[11vw] lg:text-[9vw] leading-[0.85] -mt-2 md:-mt-4 ${strokeClass}`}>HYBRID</span>
          </h1>
          
          <div className="mt-6 md:mt-8 max-w-[560px] flex gap-4">
            <div className="hidden md:block w-[1px] bg-white/20 shrink-0" />
            <div>
              <p className={`text-[16px] md:text-[19px] leading-[1.4] font-[400] ${isDark ? 'text-white/80' : 'text-[#0F1E3A]/80'}`}>
                Business OS yang tetap jalan <span className="font-medium underline decoration-[#0F9365] decoration-2 underline-offset-4">walau di tengah kolam tanpa sinyal</span>. Dibuat buat owner distributor benih lele yang capek sama app lemot.
              </p>
              
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button 
                  ref={magnetRef}
                  onClick={onEnterDashboard}
                  style={{ transform: `translate(${mag.x}px, ${mag.y}px)` }}
                  className={`group relative h-[56px] px-8 rounded-full font-display font-semibold text-[15px] tracking-wide transition-colors duration-300 will-change-transform ${isDark ? 'bg-white text-[#0F1E3A] hover:bg-white/90' : 'bg-[#0F1E3A] text-white hover:bg-[#0F1E3A]/90'}`}
                >
                  <span className="relative z-10 flex items-center gap-2">COBA DI KOLAM LU →</span>
                </button>
                <button 
                  onClick={() => setShowRegModal(true)}
                  className={`h-[56px] px-8 rounded-full font-display font-semibold text-[15px] tracking-wide border transition-all ${isDark ? 'border-white/20 hover:bg-white/5 text-white' : 'border-[#0F1E3A]/20 hover:bg-[#0F1E3A]/5 text-[#0F1E3A]'}`}
                >
                  Daftar Trial Gratis
                </button>
              </div>
              <p className={`mt-3 text-[11px] font-mono tracking-wide ${secondaryText}`}>&lt;2MB • INSTALL 3 DETIK • GAK ADA IKLAN</p>
            </div>
          </div>
          
          <div className="mt-12 grid grid-cols-3 gap-6 w-full max-w-[420px] border-t border-black/10 dark:border-white/10 pt-6">
            {[
              { n: '847', l: 'kolam aktif' },
              { n: '100%', l: 'offline jalan' },
              { n: '<1s', l: 'load di HP kentang' }
            ].map((s) => (
              <div key={s.l}>
                <div className="font-display text-[28px] font-bold tracking-tight">{s.n}</div>
                <div className={`font-mono text-[10px] tracking-widest uppercase ${secondaryText}`}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. PARALLAX FLOATING CARDS 3D */}
        <div className="lg:w-[40%] relative h-[500px] md:h-[600px] w-full mt-10 lg:mt-0 perspective-[1200px] pointer-events-none">
          {/* Card 1: pH */}
          <div 
            className={`absolute left-[2%] top-[8%] w-[75%] md:w-[82%] p-5 rounded-[20px] border shadow-2xl backdrop-blur-xl transition-colors duration-300 animate-float1 ${cardClass}`}
            style={{ transform: `perspective(1000px) rotateX(${10 + mouse.y * 0.01}deg) rotateY(${-12 + mouse.x * 0.01}deg) translateZ(0)` }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full grid place-items-center text-[10px] ${isDark ? 'bg-[#0F9365]/20 text-[#0F9365]' : 'bg-[#0F9365]/10 text-[#0F9365]'}`}>◉</div>
                <span className={`font-mono text-[11px] tracking-widest ${secondaryText}`}>KOLAM #A-12 • LIVE</span>
              </div>
              <div className="px-2 py-1 rounded-full bg-[#0F9365]/15 text-[#0F9365] text-[9px] font-mono">SYNC OK</div>
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              {[
                { k: 'pH', v: '7.2', s: 'aman' },
                { k: 'DO', v: '5.8', s: 'mg/L' },
                { k: '°C', v: '28', s: 'optimal' }
              ].map((item) => (
                <div key={item.k} className={`rounded-[12px] p-3 border ${isDark ? 'bg-white/[0.04] border-white/[0.06]' : 'bg-black/[0.03] border-black/[0.05]'}`}>
                  <div className={`font-mono text-[10px] ${secondaryText}`}>{item.k}</div>
                  <div className="font-display text-[20px] font-bold">{item.v}</div>
                  <div className="font-mono text-[9px] text-[#0F9365]">{item.s}</div>
                </div>
              ))}
            </div>
            
            {/* Wave animation simulator */}
            <div className={`mt-3 h-[56px] rounded-[12px] p-2 flex items-end gap-[3px] border ${isDark ? 'bg-gradient-to-r from-[#0F9365]/10 via-transparent to-transparent border-[#0F9365]/10' : 'bg-gradient-to-r from-[#0F9365]/5 via-transparent to-transparent border-[#0F9365]/5'}`}>
              {Array.from({ length: 18 }).map((_, idx) => (
                <div key={idx} className="flex-1 bg-[#0F9365]/60 rounded-full" style={{ height: `${20 + Math.sin(idx + scroll * 0.05) * 30 + Math.random() * 20}%` }} />
              ))}
            </div>
          </div>

          {/* Card 2: DO / Panen Ledger */}
          <div 
            className={`absolute right-[0%] top-[46%] w-[65%] md:w-[70%] p-4 rounded-[20px] border shadow-2xl backdrop-blur-xl transition-colors duration-300 animate-float2 ${cardClass}`}
            style={{ transform: `perspective(1000px) rotateX(${-6 + mouse.y * -0.008}deg) rotateY(${14 + mouse.x * 0.008}deg)` }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-[10px] bg-[#0F1E3A] text-white dark:bg-white dark:text-black grid place-items-center font-display font-bold text-[12px]">P</div>
              <div>
                <div className="font-mono text-[11px] tracking-wide">PANEN #2025-09</div>
                <div className={`font-mono text-[9px] ${secondaryText}`}>12:42 • OFFLINE QUEUE</div>
              </div>
              <div className="ml-auto w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-[11px] font-mono">
                <span className={secondaryText}>Lele Sangkuriang</span>
                <span>320kg</span>
              </div>
              <div className={`h-[1px] ${isDark ? 'bg-white/10' : 'bg-black/10'}`} />
              <div className="flex justify-between text-[11px] font-mono">
                <span className={secondaryText}>Grade A</span>
                <span className="text-[#0F9365]">Rp 8.4jt</span>
              </div>
            </div>
            
            <div className="mt-3 flex gap-2">
              <button className={`flex-1 h-7 rounded-full text-[10px] font-mono border ${isDark ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-black/5 border-black/10 hover:bg-black/10'}`}>INVOICE →</button>
              <button className="flex-1 h-7 rounded-full bg-[#0F9365] text-white grid place-items-center text-[10px] font-mono font-bold hover:bg-[#0F9365]/90">SYNC</button>
            </div>
          </div>

          {/* Card 3: Mobile Sync view */}
          <div className="absolute left-[18%] bottom-[2%] w-[42%] md:w-[46%] rounded-[28px] bg-[#0A0A0A] border-[6px] border-[#1A1A1A] p-2 shadow-2xl rotate-[-6deg]">
            <div className="rounded-[20px] bg-[#080F1E] h-[200px] p-3 flex flex-col text-white">
              <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-3" />
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[#0F9365]" />
                <div className="font-mono text-[10px]">TUMBU PWA</div>
                <div className="ml-auto w-2 h-2 bg-red-500 rounded-full" />
              </div>
              
              <div className="mt-3 rounded-xl bg-[#0F9365]/10 border border-[#0F9365]/20 p-2.5">
                <div className="font-mono text-[8px] tracking-widest text-[#0F9365]">OFFLINE MODE • ACTIVE</div>
                <div className="font-display text-[13px] font-semibold mt-1 leading-tight text-white">{syncQueueCount} transaksi nunggu sync</div>
              </div>
              
              <div className="mt-auto grid grid-cols-4 gap-1.5">
                {["Kolam", "Benih", "Pakan", "Panen"].map((s) => (
                  <div key={s} className="h-10 rounded-[10px] bg-white/[0.06] grid place-items-center text-[8px] font-mono text-white">{s}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================
          3. MARQUEE INFINITE
          ========================================= */}
      <div className={`relative z-20 border-y transition-colors duration-300 ${isDark ? 'border-white/[0.06] bg-[#0F1E3A]/40' : 'border-[#0F1E3A]/8 bg-[#F9FBF7]/40'} backdrop-blur-xl overflow-hidden max-w-[100vw]`}>
        <div className="flex whitespace-nowrap py-4 animate-marquee">
          {Array.from({ length: 6 }).map((_, v) => (
            <div key={v} className={`flex items-center gap-8 pr-8 font-mono text-[13px] tracking-[0.2em] ${isDark ? 'text-white/40' : 'text-[#0F1E3A]/40'}`}>
              <span className="text-[#0F9365]">●</span> 
              <span>OFFLINE-FIRST • HYBRID OS • BUILT FOR TANI • SYNC OK • &lt;2MB PWA • INSTANT LOAD • PUSH NOTIF PANEN •</span>
            </div>
          ))}
        </div>
      </div>

      {/* =========================================
          4. BENTO 8 MODULES
          ========================================= */}
      <section id="bento" className="relative max-w-[1440px] mx-auto px-6 md:px-12 lg:px-20 py-16 md:py-28 w-full overflow-hidden">
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 md:col-span-4 md:sticky md:top-28 self-start">
            <div className="font-mono text-[10px] tracking-[0.3em] text-[#0F9365] mb-4">/ 8 CORE MODULES</div>
            <h2 className="font-display text-[36px] md:text-[48px] leading-[0.9] tracking-[-0.03em] font-bold">
              Gak cuma<br/>
              <span className={strokeClass}>catatan.</span><br/>
              Ini OS<br/>
              beneran.
            </h2>
            <p className={`mt-4 text-[14px] leading-[1.6] max-w-[300px] ${secondaryText}`}>
              Tiap modul bisa jalan sendiri tanpa sinyal. Nanti sync otomatis. Gak kayak app kota yang loading muter terus.
            </p>
            <div className={`mt-6 hidden md:flex items-center gap-2 text-[11px] font-mono ${secondaryText}`}>
              <span className={`w-8 h-[1px] ${isDark ? 'bg-white/20' : 'bg-[#0F1E3A]/20'}`} />
              <span>SCROLL • PINNED BENTO</span>
            </div>
          </div>
          
          <div className="col-span-12 md:col-span-8">
            <div className="grid grid-cols-12 gap-3 md:gap-4">
              {bentoModules.map((s, v) => (
                <div 
                  key={s.title} 
                  className={`${s.size} group relative rounded-[20px] md:rounded-[24px] overflow-hidden transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(0,0,0,0.15)] shimmer-border ${cardClass}`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${s.accent} opacity-60`} />
                  
                  <div className="relative z-10 p-5 md:p-6 flex flex-col justify-between h-full min-h-[220px]">
                    <div className="flex justify-between items-start">
                      <div className={`w-8 h-8 rounded-full border grid place-items-center font-mono text-[10px] ${isDark ? 'bg-white/[0.06] border-white/10 text-white/50' : 'bg-black/[0.03] border-black/[0.05] text-[#0F1E3A]/50'}`}>{s.k}</div>
                      <div className={`w-2 h-2 rounded-full ${v % 2 === 0 ? 'bg-[#0F9365] text-[#0F9365] shadow-[0_0_10px_#0F9365]' : 'bg-white/30 text-white/30'} `} />
                    </div>
                    
                    <div>
                      <h3 className="mt-4 font-display font-bold text-[18px] md:text-[20px] tracking-tight">{s.title}</h3>
                      <p className={`mt-2 text-[13px] leading-[1.5] ${secondaryText} group-hover:text-current transition-colors`}>{s.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* =========================================
          5. PROBLEM VS SOLUTION
          ========================================= */}
      <section className={`py-24 border-y transition-colors duration-300 ${isDark ? 'border-white/10 bg-[#1A2E4A]/20' : 'border-[#0F1E3A]/10 bg-[#F0F4EC]'}`}>
        <div className="max-w-[1440px] mx-auto px-6 md:px-12 lg:px-20 text-center">
          <h2 className="font-display text-[32px] md:text-[48px] font-bold mb-16">Distributor Benih <span className="text-[#0F9365]">Tanpa Ribet.</span></h2>
          
          <div className="grid md:grid-cols-2 gap-8 md:gap-12 text-left">
            <div className={`p-8 md:p-12 rounded-[24px] border ${isDark ? 'bg-[#1A2E4A] border-red-500/30' : 'bg-white border-red-500/30'}`}>
              <div className="text-red-500 font-bold text-[14px] tracking-widest mb-6 uppercase">Cara Lama</div>
              <ul className={`space-y-4 text-[16px] leading-[1.6] ${secondaryText}`}>
                <li className="flex items-start gap-3">
                  <span className="text-red-500 mt-1 font-bold">✕</span> Mencatat batch benih di buku tulis yang gampang basah.
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-red-500 mt-1 font-bold">✕</span> Bingung tracking ke petani mana benih grade A didistribusikan.
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-red-500 mt-1 font-bold">✕</span> Komunikasi pesanan lewat chat WhatsApp yang tertimbun.
                </li>
              </ul>
            </div>
            
            <div className={`p-8 md:p-12 rounded-[24px] border border-[#0F9365] ${isDark ? 'bg-[#0F9365]/10' : 'bg-[#0F9365]/5'}`}>
              <div className="text-[#0F9365] font-bold text-[14px] tracking-widest mb-6 uppercase">Tumbu Hybrid</div>
              <ul className={`space-y-4 text-[16px] leading-[1.6] ${isDark ? 'text-white' : 'text-[#0F1E3A]'}`}>
                <li className="flex items-start gap-3">
                  <span className="text-[#0F9365] mt-1 font-bold">✓</span> Ledger digital offline. Input di kolam, otomatis sync di gudang.
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#0F9365] mt-1 font-bold">✓</span> Traceability 100%. Tahu persis benih batch X tumbuh di kolam Y.
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#0F9365] mt-1 font-bold">✓</span> Invoice & DO di-generate instan dalam 1 klik.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================
          6. PWA SHOWCASE
          ========================================= */}
      <section id="pwa" className="relative border-b border-black/5 dark:border-white/[0.06] overflow-hidden max-w-[100vw]">
        <div className="relative max-w-[1440px] mx-auto px-6 md:px-12 lg:px-20 py-16 md:py-24 grid grid-cols-12 gap-10 items-center w-full">
          
          <div className="col-span-12 lg:col-span-6 order-2 lg:order-1 flex justify-center perspective-[1000px] relative">
            <div className="absolute -inset-20 bg-[#0F9365]/10 blur-[60px] rounded-full pointer-events-none" />
            
            {/* iPhone Mockup Frame */}
            <div className={`relative w-[300px] md:w-[340px] h-[620px] rounded-[48px] border-[8px] overflow-hidden shadow-2xl transition-colors duration-300 ${isDark ? 'border-[#1E1E1E] bg-[#080F1E]' : 'border-[#E2E8F0] bg-white'}`}>
              {/* Dynamic Island */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[100px] h-[28px] bg-black rounded-full z-30 flex items-center justify-between px-3">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
              </div>
              
              {/* App Content inside mockup */}
              <div className="absolute inset-0 pt-16 pb-8 px-4 flex flex-col text-white bg-[#080F1E] h-full">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[#0F9365] text-white flex items-center justify-center font-bold text-[12px]">T</div>
                    <span className="font-display font-bold text-[14px]">TUMBU</span>
                  </div>
                  <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full border ${isOnline ? 'bg-[#0F9365]/10 border-[#0F9365]/20 text-[#0F9365]' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-[#0F9365]' : 'bg-red-500'} animate-pulse`}></span>
                    <span className="font-mono text-[9px] tracking-widest font-bold">{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
                  </div>
                </div>

                {!isInstalled ? (
                  <div className="mt-4 rounded-[16px] bg-white text-black p-3.5 flex items-center gap-3 shadow-lg">
                    <div className="w-10 h-10 rounded-[12px] bg-black text-white grid place-items-center text-[18px]">📲</div>
                    <div className="flex-1">
                      <div className="font-display font-semibold text-[12px]">Install TUMBU?</div>
                      <div className="font-mono text-[10px] opacity-60">Cuma 1.8MB • No App Store</div>
                    </div>
                    <button 
                      onClick={() => { setIsInstalled(true); triggerToast("TUMBU terinstall di Home Screen • 1.8MB"); }} 
                      className="px-3.5 py-1.5 rounded-full bg-black text-white text-[10px] font-mono hover:bg-[#0F9365] hover:text-white transition font-bold"
                    >
                      INSTALL
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 rounded-[16px] bg-[#0F9365] text-white p-3.5 flex items-center gap-2 shadow-lg">
                    <div className="w-6 h-6 rounded-full bg-black text-[#0F9365] grid place-items-center text-[12px] font-bold">✓</div>
                    <span className="font-mono text-[11px] font-bold tracking-wide">INSTALLED • ON HOME SCREEN</span>
                  </div>
                )}

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-[14px] bg-white/[0.05] border border-white/10 p-3">
                    <div className="font-mono text-[9px] text-white/40">SYNC QUEUE</div>
                    <div className="font-display text-[18px] font-bold mt-1">{syncQueueCount} jobs</div>
                    <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full w-2/3 bg-[#0F9365]" />
                    </div>
                  </div>
                  <div className="rounded-[14px] bg-white/[0.05] border border-white/10 p-3">
                    <div className="font-mono text-[9px] text-white/40">LOAD TIME</div>
                    <div className="font-display text-[18px] font-bold mt-1">0.8s</div>
                    <div className="font-mono text-[9px] text-[#0F9365] mt-1">HP kentang ok</div>
                  </div>
                </div>

                <div className="mt-3 rounded-[14px] bg-[#121E33] border border-white/10 p-3">
                  <div className="flex justify-between mb-2">
                    <span className="font-mono text-[10px] text-white/40">KOLAM ACTIVE</span>
                    <span className="font-mono text-[10px] text-[#0F9365]">● LIVE</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {["A-12", "B-03", "C-07"].map((col) => (
                      <div key={col} className="h-14 rounded-[10px] bg-white/[0.04] border border-white/[0.06] flex flex-col items-center justify-center">
                        <span className="font-mono text-[10px]">{col}</span>
                        <span className="w-1.5 h-1.5 bg-[#0F9365] rounded-full mt-1.5" />
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="mt-auto h-1 w-24 bg-white/20 rounded-full mx-auto" />
              </div>
            </div>

            {/* Badges */}
            <div className={`absolute -right-2 md:-right-6 top-[18%] rounded-full border px-3 py-1.5 flex items-center gap-2 shadow-xl ${isDark ? 'bg-[#0F1D32] border-white/10' : 'bg-white border-[#0F1E3A]/10'}`}>
              <span className="text-[14px]">⚡</span>
              <span className="font-mono text-[10px] tracking-wide">&lt;1s LOAD</span>
            </div>
            <div className={`absolute -left-2 md:-left-8 bottom-[22%] rounded-full border px-3 py-1.5 flex items-center gap-2 shadow-xl ${isDark ? 'bg-[#0F1D32] border-[#0F9365]/30 text-[#0F9365]' : 'bg-white border-[#0F9365]/30 text-[#0F9365]'}`}>
              <span className="w-2 h-2 bg-[#0F9365] rounded-full animate-pulse" />
              <span className="font-mono text-[10px]">100% OFFLINE</span>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-6 order-1 lg:order-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.06] border border-white/10 font-mono text-[10px] tracking-widest opacity-60">PWA CORE • BUKAN WEB BIASA</div>
            <h2 className="mt-4 font-display text-[34px] md:text-[56px] leading-[0.9] tracking-[-0.03em] font-bold">
              HP petani<br/>
              <span className="text-[#0F9365]">kentang?</span><br/>
              <span className={strokeClass}>tetep ngebut.</span>
            </h2>
            <p className={`mt-4 text-[15px] leading-[1.6] max-w-[480px] ${secondaryText}`}>
              Gak perlu App Store. Install langsung dari browser. Ukuran &lt;2MB, load &lt;1s, full offline pake IndexedDB + background sync. Push notif panen tetep masuk walau lagi di sawah.
            </p>
            
            <div className="mt-8 grid grid-cols-2 gap-3 max-w-[520px]">
              {[
                { i: '📱', t: 'Installable', d: 'Add to Home Screen, kayak app native' },
                { i: '📡', t: 'Offline-First', d: 'IndexedDB + Queue, auto sync pas online' },
                { i: '⚡', t: 'Instant Load', d: '<1s di HP kentang, 2G juga jalan' },
                { i: '🔔', t: 'Background Sync', d: 'Notifikasi panen, harga, kasbon' }
              ].map((s) => (
                <div key={s.t} className={`rounded-[16px] p-4 border backdrop-blur transition-colors ${isDark ? 'bg-white/[0.04] border-white/[0.06]' : 'bg-black/[0.02] border-black/[0.05]'}`}>
                  <div className="text-[18px]">{s.i}</div>
                  <div className="mt-2 font-display font-semibold text-[13px]">{s.t}</div>
                  <div className={`mt-1 text-[11px] leading-[1.4] ${secondaryText}`}>{s.d}</div>
                </div>
              ))}
            </div>

            <div className={`mt-8 rounded-[16px] border overflow-hidden max-w-[520px] transition-colors ${isDark ? 'bg-[#0B1426] border-white/10' : 'bg-[#F0F4EC] border-black/10'}`}>
              <div className={`flex items-center justify-between px-4 py-2.5 border-b ${isDark ? 'border-white/10' : 'border-black/10'}`}>
                <span className={`font-mono text-[10px] tracking-widest ${secondaryText}`}>manifest.json • PWA READY</span>
                <span className="px-2 py-0.5 rounded-full bg-[#0F9365]/15 text-[#0F9365] font-mono text-[9px]">VERIFIED</span>
              </div>
              <pre className={`p-4 text-[11px] leading-[1.6] font-mono overflow-x-auto ${isDark ? 'text-white/70' : 'text-[#0F1E3A]/70'}`}>
{`{
  "name": "TUMBU HYBRID OS",
  "short_name": "TUMBU",
  "start_url": "/?pwa=1",
  "display": "standalone",
  "background_color": "#0F1E3A",
  "theme_color": "#0F9365",
  "icons": [{ "src": "/icon-512.png",
             "sizes": "512x512",
             "type": "image/png" }],
  "offline_enabled": true
}`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================
          6. BLUEPRINT
          ========================================= */}
      <section id="blueprint" className="max-w-[1440px] mx-auto px-6 md:px-12 lg:px-20 py-16 md:py-24 w-full overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className={`font-mono text-[10px] tracking-[0.3em] ${secondaryText}`}>/ BLUEPRINT • HOW IT WORKS</div>
            <h2 className="mt-3 font-display text-[28px] md:text-[44px] leading-[0.9] font-bold tracking-tight">
              Flow yang <span className="text-[#0F9365]">gak ribet.</span>
            </h2>
          </div>
          <div className={`font-mono text-[11px] max-w-[360px] ${secondaryText}`}>
            Hover buat expand. Dibuat buat yang gak suka baca manual tebel.
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          {[
            { n: '01', t: 'Install 3 detik', d: 'Buka tumbu.id di HP, tap Share → Add to Home Screen. Beres. Gak perlu email, OTP, verifikasi KTP segala.', c: isDark ? 'bg-[#0F9365]/10' : 'bg-[#0F9365]/5' },
            { n: '02', t: 'Kerja offline', d: 'Catat pakan, panen, kasbon langsung di kolam. Data masuk IndexedDB. Foto struk tetep kesimpen walau gak ada sinyal.', c: isDark ? 'bg-white/[0.04]' : 'bg-black/[0.02]' },
            { n: '03', t: 'Sync pas ada sinyal', d: 'Balik ke rumah, konek WiFi warung, semua otomatis sync ke cloud. Konflik? Kita beresin pake CRDT, lu gak perlu pusing.', c: isDark ? 'bg-white/[0.04]' : 'bg-black/[0.02]' }
          ].map((s, v) => (
            <div key={s.n} className={`group relative rounded-[24px] border overflow-hidden transition-all duration-500 hover:border-[#0F9365]/30 hover:shadow-[0_20px_60px_rgba(0,0,0,0.15)] ${isDark ? 'border-white/10 bg-[#1A2E4A]' : 'border-[#0F1E3A]/8 bg-white'}`}>
              <div className={`absolute inset-0 ${s.c} opacity-60`} />
              <div className="relative p-6 md:p-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#0F1E3A] text-white dark:bg-white dark:text-[#0F1E3A] grid place-items-center font-mono text-[12px] font-bold">{s.n}</div>
                  <div className={`h-[1px] flex-1 transition-colors ${isDark ? 'bg-white/10 group-hover:bg-[#0F9365]/30' : 'bg-black/10 group-hover:bg-[#0F9365]/30'}`} />
                </div>
                <h3 className="mt-6 font-display text-[20px] font-bold tracking-tight">{s.t}</h3>
                <p className={`mt-3 text-[13px] leading-[1.6] ${secondaryText} group-hover:text-current transition-colors`}>{s.d}</p>
                <div className="mt-6 grid grid-cols-3 gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <div key={idx} className={`h-8 rounded-[10px] border ${isDark ? 'bg-white/[0.06] border-white/10' : 'bg-black/[0.02] border-black/[0.05]'}`} />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className={`mt-10 rounded-[20px] border p-4 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-colors duration-300 ${isDark ? 'bg-[#0F1D32]/60 border-white/10' : 'bg-white border-[#0F1E3A]/8'}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#0F9365]/15 border border-[#0F9365]/20 grid place-items-center">📱</div>
            <div>
              <div className={`font-mono text-[11px] tracking-widest ${secondaryText}`}>RESPONSIVE TESTED • REAL DEVICE</div>
              <div className="font-display text-[13px] font-semibold">Gimana keliatannya di HP petani?</div>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {[
              { w: '375px', l: 'iPhone SE', a: true },
              { w: '768px', l: 'iPad Mini', a: false },
              { w: '1440px', l: 'Laptop Toko', a: false }
            ].map((s) => (
              <div key={s.w} className={`px-3 py-1.5 rounded-full border text-[10px] font-mono tracking-wide ${s.a ? 'bg-[#0F9365] text-white border-[#0F9365]' : isDark ? 'bg-white/[0.04] border-white/10 text-white/50' : 'bg-black/[0.03] border-black/[0.05] text-[#0F1E3A]/55'}`}>
                {s.w} • {s.l}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================
          7. FOOTER & TESTIMONIALS
          ========================================= */}
      <section className="relative overflow-hidden max-w-[100vw]">
        <div className={`absolute inset-0 transition-colors duration-300 ${isDark ? 'bg-[#050C1A]' : 'bg-[#F0F4EC]'}`} />
        
        {/* Aurora Glow */}
        <div className="absolute inset-0 opacity-60 overflow-hidden max-w-[100vw] pointer-events-none">
          <div className="absolute -top-1/2 left-1/2 -translate-x-1/2 w-[min(1200px,100vw)] h-[800px] rounded-full blur-[120px] max-w-[100vw] bg-gradient-to-r from-[#0F9365]/20 to-[#0F1E3A]/10 animate-[aurora_20s_linear_infinite]" />
        </div>
        
        <div className="relative max-w-[1440px] mx-auto px-6 md:px-12 lg:px-20 py-20 md:py-32 text-center z-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 font-mono text-[10px] tracking-[0.2em] text-[#0F9365] font-bold">
            <span className="w-1.5 h-1.5 bg-[#0F9365] rounded-full animate-pulse" />
            <span>READY BUAT KOLAM LU?</span>
          </div>

          <h2 className="mt-6 font-display font-bold tracking-[-0.04em] leading-[0.85] text-[12vw] md:text-[8vw]">
            <span className="block">TUMBU</span>
            <span className="block text-outline-emerald">SEKARANG.</span>
          </h2>
          
          <p className={`mt-6 mx-auto max-w-[520px] text-[15px] leading-[1.6] ${secondaryText}`}>
            Gratis 14 hari, full fitur. Gak cocok? Uninstall. Gak ada sales yang ngejar-ngejar. Kita petani juga, bukan korporat.
          </p>

          <div className="mt-8 flex flex-col md:flex-row items-center justify-center gap-3">
            <button 
              ref={magnetRef2}
              onClick={() => setShowRegModal(true)}
              style={{ transform: `translate(${mag2.x}px, ${mag2.y}px)` }}
              className={`h-[56px] px-10 rounded-full font-display font-bold text-[15px] tracking-wide transition-all duration-150 ease-out will-change-transform ${isDark ? 'bg-white text-[#0F1E3A] hover:shadow-[0_0_30px_rgba(255,255,255,0.4)]' : 'bg-[#0F1E3A] text-white hover:shadow-[0_0_30px_rgba(15,30,58,0.4)]'}`}
            >
              Coba Trial Gratis →
            </button>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full border font-mono text-[11px] ${isDark ? 'bg-white/[0.06] border-white/10 text-white/50' : 'bg-black/[0.03] border-black/[0.05] text-[#0F1E3A]/50'}`}>
              <span>📦</span>
              <span>1.8MB • No credit card • Offline dulu, bayar nanti</span>
            </div>
          </div>

          {/* Testimonials */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-[800px] mx-auto text-left">
            {[
              { q: "'App lain lemot di sawah, Tumbu jalan terus.'", a: "Jono • Kolam 32 petak, Sleman" },
              { q: "'Kasbon jadi jelas, gak ada yang lupa.'", a: "Siti • Distributor Benih, Boyolali" },
              { q: "'Anak gue yang SD bisa pake.'", a: "Pakde Karso • 60th, Muntilan" }
            ].map((s) => (
              <div key={s.a} className={`rounded-[16px] border p-4 backdrop-blur ${isDark ? 'bg-white/[0.04] border-white/[0.06]' : 'bg-white/80 border-black/[0.05]'}`}>
                <div className={`text-[13px] leading-[1.5] ${isDark ? 'text-white/70' : 'text-[#0F1E3A]/80'}`}>{s.q}</div>
                <div className={`mt-2 font-mono text-[10px] ${secondaryText}`}>{s.a}</div>
              </div>
            ))}
          </div>
        </div>

        <div className={`relative border-t py-6 px-6 md:px-12 lg:px-20 flex flex-col md:flex-row justify-between gap-3 text-[10px] font-mono tracking-widest ${isDark ? 'border-white/10 text-white/30' : 'border-[#0F1E3A]/10 text-[#0F1E3A]/30'}`}>
          <span>© 2025 TUMBU HYBRID • BUILT IN SAWAH, NOT IN CO-WORKING</span>
          <div className="flex items-center gap-4">
            <span>v2.0 • PWA READY</span>
            <span className={`w-1 h-1 rounded-full ${isDark ? 'bg-white/20' : 'bg-black/20'}`} />
            <span>OFFLINE-FIRST FOREVER</span>
          </div>
        </div>
      </section>

      {/* 9. BOTTOM DOCK iOS MOBILE (Only visible <768px) */}
      <div className={`md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full border shadow-2xl backdrop-blur-xl z-50 flex items-center justify-between gap-6 w-[90%] max-w-[320px] ${isDark ? 'bg-[#1A2E4A]/80 border-white/10 text-white' : 'bg-white/80 border-[#0F1E3A]/8 text-[#0F1E3A]'}`}>
        <button onClick={() => window.scrollTo(0, 0)} className="flex flex-col items-center opacity-100">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
          <span className="text-[9px] mt-1 font-semibold">Home</span>
        </button>
        <button onClick={() => { document.getElementById('bento')?.scrollIntoView({ behavior: 'smooth' }); }} className="flex flex-col items-center opacity-60">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
          <span className="text-[9px] mt-1 font-semibold">Bento</span>
        </button>
        <button onClick={onEnterDashboard} className="flex flex-col items-center opacity-60">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
          <span className="text-[9px] mt-1 font-semibold">App</span>
        </button>
      </div>

      {/* =========================================
          REGISTRATION MODAL
          ========================================= */}
      {showRegModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-black/60">
          <div className={`relative w-full max-w-[480px] p-6 md:p-8 rounded-[28px] border shadow-2xl transition-colors duration-300 shimmer-border ${cardClass}`}>
            <button 
              onClick={() => setShowRegModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full border flex items-center justify-center text-[18px] opacity-60 hover:opacity-100 transition-opacity border-black/10 dark:border-white/10"
            >
              ✕
            </button>

            <h3 className="font-display font-bold text-[24px] mb-2 tracking-tight">Daftar Trial TUMBU OS</h3>
            <p className={`text-[13px] leading-[1.5] mb-6 ${secondaryText}`}>
              Jalan 100% offline di sawah/kolam. Sinkronisasi otomatis saat terhubung. Gratis 14 hari penuh.
            </p>

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-[11px] font-mono tracking-wider uppercase mb-1.5 opacity-60">Nama Lengkap</label>
                <input 
                  type="text" 
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Budi Setiawan" 
                  required
                  className={`w-full h-11 px-4 rounded-xl border text-[14px] bg-transparent outline-none focus:border-[#0F9365] transition-colors ${isDark ? 'border-white/10 text-white' : 'border-[#0F1E3A]/20 text-[#0F1E3A]'}`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono tracking-wider uppercase mb-1.5 opacity-60">Nama Usaha Perikanan</label>
                <input 
                  type="text" 
                  value={regBusiness}
                  onChange={(e) => setRegBusiness(e.target.value)}
                  placeholder="Sumber Lele Jaya" 
                  required
                  className={`w-full h-11 px-4 rounded-xl border text-[14px] bg-transparent outline-none focus:border-[#0F9365] transition-colors ${isDark ? 'border-white/10 text-white' : 'border-[#0F1E3A]/20 text-[#0F1E3A]'}`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono tracking-wider uppercase mb-1.5 opacity-60">Nomor WhatsApp / Telepon</label>
                <input 
                  type="tel" 
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder="08123456789" 
                  required
                  className={`w-full h-11 px-4 rounded-xl border text-[14px] bg-transparent outline-none focus:border-[#0F9365] transition-colors ${isDark ? 'border-white/10 text-white' : 'border-[#0F1E3A]/20 text-[#0F1E3A]'}`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono tracking-wider uppercase mb-1.5 opacity-60">Alamat Email</label>
                <input 
                  type="email" 
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="budi@email.com" 
                  required
                  className={`w-full h-11 px-4 rounded-xl border text-[14px] bg-transparent outline-none focus:border-[#0F9365] transition-colors ${isDark ? 'border-white/10 text-white' : 'border-[#0F1E3A]/20 text-[#0F1E3A]'}`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono tracking-wider uppercase mb-1.5 opacity-60">Password</label>
                <input 
                  type="password" 
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Minimal 6 karakter" 
                  required
                  minLength={6}
                  className={`w-full h-11 px-4 rounded-xl border text-[14px] bg-transparent outline-none focus:border-[#0F9365] transition-colors ${isDark ? 'border-white/10 text-white' : 'border-[#0F1E3A]/20 text-[#0F1E3A]'}`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono tracking-wider uppercase mb-1.5 opacity-60">Jenis Usaha</label>
                <select 
                  value={regBlueprintId}
                  onChange={(e) => setRegBlueprintId(e.target.value)}
                  required
                  className={`w-full h-11 px-4 rounded-xl border text-[14px] outline-none focus:border-[#0F9365] transition-colors ${isDark ? 'border-white/10 text-white bg-[#1A2E4A]' : 'border-[#0F1E3A]/20 text-[#0F1E3A] bg-white'}`}
                >
                  <option value="operational_aquaculture_freshwater">Budidaya Air Tawar</option>
                  <option value="operational_distributor">Distributor Benih</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono tracking-wider uppercase mb-1.5 opacity-60">Catatan Tambahan (Opsional)</label>
                <textarea 
                  value={regNotes}
                  onChange={(e) => setRegNotes(e.target.value)}
                  placeholder="Spesifikasi kolam, jumlah tebar, dll." 
                  rows={2}
                  className={`w-full p-3 rounded-xl border text-[14px] bg-transparent outline-none focus:border-[#0F9365] transition-colors resize-none ${isDark ? 'border-white/10 text-white' : 'border-[#0F1E3A]/20 text-[#0F1E3A]'}`}
                />
              </div>

              <button 
                type="submit" 
                disabled={isSubmitting}
                className={`w-full h-12 mt-4 rounded-full font-display font-bold text-[14px] tracking-wide transition-all ${isDark ? 'bg-white text-[#0F1E3A] hover:bg-white/90 disabled:bg-white/50' : 'bg-[#0F1E3A] text-white hover:bg-[#0F1E3A]/90 disabled:bg-[#0F1E3A]/50'}`}
              >
                {isSubmitting ? 'Mengirim...' : 'Mulai Coba Trial →'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
