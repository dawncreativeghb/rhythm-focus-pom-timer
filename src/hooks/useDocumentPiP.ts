import { useState, useCallback, useEffect } from 'react';

// Document Picture-in-Picture isn't in the standard TS DOM types yet.
declare global {
  interface Window {
    documentPictureInPicture?: {
      requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>;
      window: Window | null;
    };
  }
}

// Copy the main document's styles into the PiP window so Tailwind/theme
// variables apply there too. Same-origin sheets are inlined; cross-origin
// sheets (which throw on cssRules access) are re-linked by href.
function copyStyles(target: Window) {
  for (const styleSheet of Array.from(document.styleSheets)) {
    try {
      const cssText = Array.from(styleSheet.cssRules)
        .map((rule) => rule.cssText)
        .join('');
      const style = target.document.createElement('style');
      style.textContent = cssText;
      target.document.head.appendChild(style);
    } catch {
      if (styleSheet.href) {
        const link = target.document.createElement('link');
        link.rel = 'stylesheet';
        link.href = styleSheet.href;
        target.document.head.appendChild(link);
      }
    }
  }
}

/**
 * Opens a floating, always-on-top window (Document Picture-in-Picture).
 * Chromium-only today; `isSupported` is false elsewhere so callers can hide
 * the entry point.
 */
export function useDocumentPiP() {
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const isSupported =
    typeof window !== 'undefined' && 'documentPictureInPicture' in window;

  const open = useCallback(async () => {
    if (!isSupported || !window.documentPictureInPicture) return;
    try {
      const w = await window.documentPictureInPicture.requestWindow({
        width: 320,
        height: 440,
      });
      copyStyles(w);
      w.document.body.style.margin = '0';
      // User closed the floating window → drop our reference so the portal unmounts.
      w.addEventListener('pagehide', () => setPipWindow(null));
      setPipWindow(w);
    } catch (e) {
      console.error('[PiP] failed to open floating timer', e);
    }
  }, [isSupported]);

  const close = useCallback(() => {
    pipWindow?.close();
    setPipWindow(null);
  }, [pipWindow]);

  // Close the floating window if the main app unmounts.
  useEffect(() => {
    return () => pipWindow?.close();
  }, [pipWindow]);

  return { isSupported, pipWindow, isOpen: !!pipWindow, open, close };
}
