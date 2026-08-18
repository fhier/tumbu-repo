'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AppRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/?pwa=true');
  }, [router]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0F1E3A',
      color: '#ffffff',
      fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{ textAlign: 'center' }}>
        <div className="spinner" style={{
          width: 32,
          height: 32,
          border: '3px solid rgba(255, 255, 255, 0.1)',
          borderTopColor: '#0F9365',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 16px auto'
        }} />
        <p style={{ fontSize: 14, fontWeight: 600 }}>Menghubungkan ke TUMBU Mobile...</p>
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes spin { to { transform: rotate(360deg); } }
        `}} />
      </div>
    </div>
  );
}
