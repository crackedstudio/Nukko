import { useState, useCallback } from 'react';

export function useToast() {
  const [toast, setToast] = useState({ message: '', visible: false });

  const showToast = useCallback((message) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 700);
  }, []);

  return { toast, showToast };
}

export default function Toast({ message, visible }) {
  return (
    <div className={`toast ${visible ? 'pop' : ''}`}>{message}</div>
  );
}
