import { useState, useCallback } from 'react';

export function useToast() {
  const [toast, setToast] = useState({ message: '', visible: false });

  const showToast = useCallback((message, duration = 900) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), duration);
  }, []);

  return { toast, showToast };
}

export default function Toast({ message, visible }) {
  if (!visible || !message) return null;
  return (
    <div style={{
      position: 'absolute', left: '50%', bottom: 20,
      transform: 'translateX(-50%)',
      padding: '10px 18px', borderRadius: 99,
      background: 'linear-gradient(90deg, rgba(0,230,118,0.95), rgba(0,212,255,0.95))',
      color: '#0a0015', fontFamily: '"Nunito", system-ui',
      fontWeight: 800, fontSize: message.includes('\n') ? 11 : 14,
      boxShadow: '0 8px 24px rgba(0,212,255,0.35)',
      animation: 'nukko-toast 0.3s ease-out',
      whiteSpace: message.includes('\n') ? 'pre-wrap' : 'nowrap',
      maxWidth: 'min(92vw, 420px)',
      maxHeight: '42vh',
      overflow: 'auto',
      textAlign: message.includes('\n') ? 'left' : 'center',
      pointerEvents: 'none', zIndex: 10,
    }}>
      {message}
    </div>
  );
}
