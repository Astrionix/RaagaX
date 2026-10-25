/**
 * Detects whether the current device is a tablet or iPad (iOS/iPadOS or Android tablet).
 */
export function isTablet(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPads running iPadOS 13+ report as Macintosh with multi-touch points
  const isIpad = /iPad/i.test(ua) || (/Macintosh/i.test(ua) && (navigator.maxTouchPoints ?? 0) > 1);
  const isAndroidTablet = /Android/i.test(ua) && !/Mobile/i.test(ua);
  return isIpad || isAndroidTablet;
}

/**
 * Mobile phones (excluding tablets and iPads) can't install the desktop extension,
 * so they can show the app notice unless dismissed.
 */
export function isMobileBrowser(): boolean {
  if (isTablet()) return false;
  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
  if (typeof uaData?.mobile === 'boolean') return uaData.mobile;
  return /iPhone|iPod|Mobile/i.test(navigator.userAgent) || (/Android/i.test(navigator.userAgent) && /Mobile/i.test(navigator.userAgent));
}

/**
 * Detects whether the primary interaction method is touch (tablets, iPads, phones).
 */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return isTablet() || isMobileBrowser() || (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches);
}

