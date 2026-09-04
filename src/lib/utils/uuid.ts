/**
 * Safe UUID generator that works across all contexts:
 * - Secure contexts (HTTPS, localhost): Uses native crypto.randomUUID()
 * - Non-secure contexts (LAN IP e.g. http://192.168.x.x:3000): Uses RFC4122 v4 fallback
 * - Node.js SSR: Uses node crypto or fallback
 */
export function safeRandomUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {}
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Auto-polyfill window.crypto.randomUUID if in browser and missing
if (typeof window !== 'undefined') {
  try {
    if (!window.crypto) {
      (window as any).crypto = {};
    }
    if (typeof window.crypto.randomUUID !== 'function') {
      window.crypto.randomUUID = safeRandomUUID as any;
    }
  } catch {}
}
