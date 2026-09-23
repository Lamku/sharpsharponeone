import { useEffect } from 'react';

export function SupportChat() {
  useEffect(() => {
    // Avoid loading twice (e.g. React StrictMode double-mount)
    if ((window as any).__tawk_loaded) return;
    (window as any).__tawk_loaded = true;

    const Tawk_API = ((window as any).Tawk_API = (window as any).Tawk_API || {});
    (window as any).Tawk_LoadStart = new Date();

    // ⭐ Hide the default Tawk.to floating bubble so it doesn't block UI.
    //    Support is still accessible via our own buttons that call
    //    Tawk_API.maximize().
    const style = document.createElement('style');
    style.setAttribute('data-tawk-hide', 'true');
    style.innerHTML = `
      /* Hide the Tawk.to bubble container */
      #tawk-bubble-container,
      .tawk-min-container,
      .tawk-min-container-1,
      #tawkchat-minified-container,
      iframe[title="chat widget"],
      iframe[title="Chat widget"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      /* Keep the full chat window visible when opened */
      #tawkchat-container,
      .tawk-chat-container,
      iframe[title="chat window"] {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        pointer-events: auto !important;
      }
    `;
    document.head.appendChild(style);

    const s1 = document.createElement('script');
    const s0 = document.getElementsByTagName('script')[0];
    s1.async = true;
    s1.src = 'https://embed.tawk.to/6ab28f18c00c2b344c967f4d/1k34nturi';
    s1.charset = 'UTF-8';
    s1.setAttribute('crossorigin', '*');
    s0.parentNode?.insertBefore(s1, s0);

    Tawk_API.onLoad = function () {
      console.log('[SupportChat] Tawk.to loaded (bubble hidden, chat available)');
    };

    return () => {
      // Widget stays mounted; cleanup not needed
    };
  }, []);

  return null;
}