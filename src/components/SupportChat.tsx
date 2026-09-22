import { useEffect } from 'react';

export function SupportChat() {
  useEffect(() => {
    // Avoid loading twice (e.g. React StrictMode double-mount)
    if ((window as any).__tawk_loaded) return;
    (window as any).__tawk_loaded = true;

    const Tawk_API = ((window as any).Tawk_API = (window as any).Tawk_API || {});
    (window as any).Tawk_LoadStart = new Date();

    const s1 = document.createElement('script');
    const s0 = document.getElementsByTagName('script')[0];
    s1.async = true;
    s1.src = 'https://embed.tawk.to/6ab28f18c00c2b344c967f4d/1k34nturi';
    s1.charset = 'UTF-8';
    s1.setAttribute('crossorigin', '*');
    s0.parentNode?.insertBefore(s1, s0);

    // Optional: hide the default widget until user clicks your custom button
    Tawk_API.onLoad = function () {
      console.log('[SupportChat] Tawk.to loaded');
    };

    return () => {
      // Cleanup optional — usually leave the widget mounted
    };
  }, []);

  // Optional: expose a button that opens the chat
  const openChat = () => {
    const api = (window as any).Tawk_API;
    if (api?.maximize) {
      api.maximize();
    } else {
      console.warn('Tawk.to not ready yet');
    }
  };

  return null; // Widget appears on its own; no visible UI from this component
}