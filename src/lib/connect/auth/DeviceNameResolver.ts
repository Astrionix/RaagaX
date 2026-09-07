/**
 * DeviceNameResolver — Hardware Model Resolution & Display Labeling Architecture
 *
 * Implements Spec:
 * 1. Client detects OS/hardware cues and resolves to friendly consumer model name
 *    (e.g. "iPhone 14 Pro", "Realme 11 Pro", "MacBook Pro", "Windows PC").
 * 2. Default Display Name: `[Model name] · [Username]` (e.g. `MacBook Pro · Jordan`).
 * 3. User Label Override: Editable in device settings (e.g. "Kitchen Speaker", "Living Room TV").
 * 4. Disambiguation: Appends `(2)`, `(3)` for identical unlabeled models on the same account.
 * 5. Single-line Compactness: `💻 MacBook Pro · Jordan` carries both pieces of info without an owner sub-line.
 */

import { DiscoveredPeer } from '../types';

export interface DeviceHardwareInfo {
  rawModel: string;
  friendlyModel: string;
  deviceType: 'phone' | 'desktop' | 'tablet' | 'tv' | 'speaker';
}

export class DeviceNameResolver {
  private static instance: DeviceNameResolver;
  private readonly USER_LABEL_KEY = 'raagax_device_user_label';
  private nameListeners = new Set<(name: string) => void>();

  private constructor() {}

  public static getInstance(): DeviceNameResolver {
    if (!DeviceNameResolver.instance) {
      DeviceNameResolver.instance = new DeviceNameResolver();
    }
    return DeviceNameResolver.instance;
  }

  /**
   * Subscribe to local device display name changes (e.g. when renamed by user)
   */
  public onNameChanged(fn: (name: string) => void): () => void {
    this.nameListeners.add(fn);
    return () => this.nameListeners.delete(fn);
  }

  /**
   * Resolves friendly marketing model name from client environment or provided UA cues
   */
  public resolveHardwareInfo(
    customUA?: string,
    customScreen?: { width: number; height: number; dpr?: number }
  ): DeviceHardwareInfo {
    const ua = customUA ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '') ?? '';
    const platform = typeof navigator !== 'undefined' ? ((navigator as any).userAgentData?.platform || navigator.platform || '') : '';

    if (!ua && typeof window === 'undefined') {
      return { rawModel: 'NodeJS', friendlyModel: 'RaagaX Player', deviceType: 'desktop' };
    }

    // ── 1. Apple iOS (iPhone / iPad) ──
    if (/iPhone/i.test(ua)) {
      const friendly = this.matchIPhoneModel(ua, customScreen);
      return { rawModel: 'iPhone', friendlyModel: friendly, deviceType: 'phone' };
    }

    if (/iPad/i.test(ua) || (platform === 'MacIntel' && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1)) {
      return { rawModel: 'iPad', friendlyModel: 'iPad Pro', deviceType: 'tablet' };
    }

    // ── 2. Android Phones & Tablets ──
    if (/Android/i.test(ua)) {
      const isTablet = !/Mobile/i.test(ua);
      const friendly = this.matchAndroidModel(ua);
      return {
        rawModel: 'Android',
        friendlyModel: friendly,
        deviceType: isTablet ? 'tablet' : 'phone',
      };
    }

    // ── 3. Smart TVs / Streaming Boxes ──
    if (/TV|SmartTV|Tizen|Web0S|Chromecast|CrKey|AppleTV/i.test(ua)) {
      return { rawModel: 'SmartTV', friendlyModel: 'Living Room TV', deviceType: 'tv' };
    }

    // ── 4. macOS ──
    if (/Mac OS X|Macintosh|MacIntel/i.test(ua) || (!customUA && /Mac/i.test(platform))) {
      const isScreenLarge = (customScreen?.width ?? (typeof window !== 'undefined' ? window.screen?.width : 1920) ?? 1920) >= 1680;
      const friendly = isScreenLarge ? 'MacBook Pro' : 'MacBook Air';
      return { rawModel: 'macOS', friendlyModel: friendly, deviceType: 'desktop' };
    }

    // ── 5. Windows ──
    if (/Windows/i.test(ua) || (!customUA && /Win/i.test(platform))) {
      const isTouch = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
      const friendly = isTouch ? 'Surface Pro' : 'Windows PC';
      return { rawModel: 'Windows', friendlyModel: friendly, deviceType: 'desktop' };
    }

    // ── 6. Linux / Other ──
    if (/Linux/i.test(ua)) {
      return { rawModel: 'Linux', friendlyModel: 'Linux Desktop', deviceType: 'desktop' };
    }

    return { rawModel: 'Generic', friendlyModel: 'RaagaX Device', deviceType: 'desktop' };
  }

  /**
   * Matches common iPhone models from screen metrics & user-agent cues
   */
  private matchIPhoneModel(
    ua: string,
    customScreen?: { width: number; height: number; dpr?: number }
  ): string {
    // Model identifier detection if available (e.g. in native wrapper / Capacitor)
    if (ua.includes('iPhone16,2')) return 'iPhone 15 Pro Max';
    if (ua.includes('iPhone16,1')) return 'iPhone 15 Pro';
    if (ua.includes('iPhone15,3')) return 'iPhone 14 Pro Max';
    if (ua.includes('iPhone15,2')) return 'iPhone 14 Pro';
    if (ua.includes('iPhone14,3')) return 'iPhone 13 Pro Max';
    if (ua.includes('iPhone14,2')) return 'iPhone 13 Pro';

    // Heuristics based on device pixel ratio and screen resolution
    const w = customScreen?.width ?? (typeof window !== 'undefined' && window.screen ? window.screen.width : 393);
    const h = customScreen?.height ?? (typeof window !== 'undefined' && window.screen ? window.screen.height : 852);
    const dpr = customScreen?.dpr ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 3);

    // Dynamic Island devices (iPhone 14 Pro, 15, 15 Pro, 16)
    if ((w === 393 && h === 852 && dpr >= 3) || (w === 430 && h === 932)) {
      return w === 430 ? 'iPhone 15 Pro Max' : 'iPhone 15 Pro';
    }

    // iPhone 13 / 14 standard (390 x 844)
    if (w === 390 && h === 844) {
      return 'iPhone 14';
    }

    // iPhone 13 Pro Max / 12 Pro Max (428 x 926)
    if (w === 428 && h === 926) {
      return 'iPhone 13 Pro Max';
    }

    // iPhone 11 / XR (414 x 896)
    if (w === 414 && h === 896) {
      return 'iPhone 11';
    }

    return 'iPhone 14 Pro';
  }

  /**
   * Matches Android friendly marketing names
   */
  private matchAndroidModel(ua: string): string {
    // Pixel models (e.g. "Pixel 8 Pro", "Pixel 7a", "Pixel Fold")
    const pixelMatch = ua.match(/Pixel\s+([0-9a-zA-Z\s]+?)(?:\s+Build|\s*;|\/|$)/i);
    if (pixelMatch) {
      return `Pixel ${pixelMatch[1].trim()}`;
    }

    // Samsung Galaxy
    if (ua.includes('SM-S928') || ua.includes('SM-S921')) return 'Galaxy S24 Ultra';
    if (ua.includes('SM-S918') || ua.includes('SM-S911')) return 'Galaxy S23';
    if (ua.includes('SM-G998')) return 'Galaxy S21 Ultra';
    if (ua.includes('SAMSUNG') || ua.includes('SM-')) return 'Samsung Galaxy';

    // Realme
    if (ua.includes('RMX3363') || ua.includes('RMX') || /Realme/i.test(ua)) {
      return 'Realme 11 Pro';
    }

    // OnePlus
    if (/OnePlus/i.test(ua)) {
      return 'OnePlus 12';
    }

    // Xiaomi / Redmi
    if (/Xiaomi|Redmi/i.test(ua)) {
      return 'Xiaomi 13 Pro';
    }

    return 'Android Phone';
  }

  /**
   * Derives a friendly device noun tailored for possessive naming:
   * e.g. "Desk", "iPhone", "iPad", "Mobile", "MacBook", "TV", "Speaker"
   */
  public getDeviceNoun(info: DeviceHardwareInfo): string {
    if (info.rawModel === 'iPhone' || /iPhone/i.test(info.friendlyModel)) {
      return 'iPhone';
    }
    if (info.rawModel === 'iPad' || /iPad/i.test(info.friendlyModel)) {
      return 'iPad';
    }
    if (info.deviceType === 'phone' || info.rawModel === 'Android') {
      return 'Mobile';
    }
    if (info.deviceType === 'tablet') {
      return /iPad/i.test(info.friendlyModel) ? 'iPad' : 'Tablet';
    }
    if (info.rawModel === 'macOS' || /MacBook|Mac/i.test(info.friendlyModel)) {
      return 'MacBook';
    }
    if (info.rawModel === 'Windows' || info.rawModel === 'Linux' || info.deviceType === 'desktop') {
      return 'Desk';
    }
    if (info.deviceType === 'tv') {
      return 'TV';
    }
    if (info.deviceType === 'speaker') {
      return 'Speaker';
    }
    return 'Desk';
  }

  /**
   * Formats a user name into standard English possessive form:
   * e.g. "chan" -> "chan's Desk", "James" -> "James' Desk"
   */
  public formatPossessive(name: string, deviceNoun: string): string {
    const trimmed = name ? name.trim() : '';
    if (!trimmed) return deviceNoun;
    const possessive = trimmed.endsWith('s') || trimmed.endsWith('S')
      ? `${trimmed}'`
      : `${trimmed}'s`;
    return `${possessive} ${deviceNoun}`;
  }

  private memoryAccountName: string = '';

  public setAccountDisplayName(name: string | null): void {
    const clean = name && name.trim() && name.trim().toLowerCase() !== 'jordan' && name.trim().toLowerCase() !== 'guest'
      ? name.trim()
      : '';
    const changed = this.memoryAccountName !== clean;
    this.memoryAccountName = clean;

    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      try {
        if (clean) {
          localStorage.setItem('raagax_account_username', clean);
        } else {
          localStorage.removeItem('raagax_account_username');
        }
      } catch {}
    }

    if (changed) {
      const updated = this.getLocalDeviceDisplayName();
      this.nameListeners.forEach((fn) => {
        try { fn(updated); } catch {}
      });
    }
  }

  /**
   * Retrieves active account display name from Auth state or localStorage
   */
  public getAccountDisplayName(): string {
    if (this.memoryAccountName) return this.memoryAccountName;

    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      try {
        // 1. Explicit username saved on signup / login
        const explicitName = window.localStorage.getItem('raagax_account_username');
        if (explicitName && explicitName.trim() && explicitName.trim().toLowerCase() !== 'jordan') {
          return explicitName.trim();
        }

        // 2. Zustand auth storage if available
        const authRaw = window.localStorage.getItem('raagax_auth_storage');
        if (authRaw) {
          const parsed = JSON.parse(authRaw);
          const name = parsed.state?.user?.user_metadata?.full_name || 
                       parsed.state?.user?.user_metadata?.name || 
                       parsed.state?.user?.email?.split('@')[0];
          if (name && name.trim() && name.trim().toLowerCase() !== 'jordan') return name.trim();
        }

        // 3. Scan Supabase session tokens
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key && (key.includes('-auth-token') || key.startsWith('sb-'))) {
            const raw = window.localStorage.getItem(key);
            if (raw) {
              const parsed = JSON.parse(raw);
              const user = parsed?.user || parsed?.currentSession?.user;
              const name = user?.user_metadata?.full_name || 
                           user?.user_metadata?.name || 
                           user?.user_metadata?.user_name || 
                           user?.email?.split('@')[0];
              if (name && name.trim() && name.trim().toLowerCase() !== 'jordan') {
                return name.trim();
              }
            }
          }
        }
      } catch {}
    }

    return '';
  }

  private memoryUserLabel: string | null = null;

  /**
   * Retrieves custom device rename label if user set one
   */
  public getUserLabel(): string | null {
    if (typeof window !== 'undefined') {
      try {
        const val = localStorage.getItem(this.USER_LABEL_KEY);
        if (val) return val.replace(/\s*·\s*Jordan\b/gi, '').trim();
      } catch {}
    }
    return this.memoryUserLabel ? this.memoryUserLabel.replace(/\s*·\s*Jordan\b/gi, '').trim() : null;
  }

  /**
   * Persists custom user device label (e.g. "Kitchen Speaker" or "Work Laptop")
   */
  public setUserLabel(label: string | null): void {
    const trimmed = label && label.trim() ? label.replace(/\s*·\s*Jordan\b/gi, '').trim() : null;
    this.memoryUserLabel = trimmed;

    if (typeof window !== 'undefined') {
      try {
        if (!trimmed) {
          localStorage.removeItem(this.USER_LABEL_KEY);
        } else {
          localStorage.setItem(this.USER_LABEL_KEY, trimmed);
        }
      } catch {}
    }

    const updated = this.getLocalDeviceDisplayName();
    this.nameListeners.forEach((fn) => fn(updated));
  }

  /**
   * Default display name formula before user overrides:
   * When logged in: natural possessive naming: "{Username}'s {Noun}" (e.g. "chan's Desk", "chan's iPhone", "chan's iPad", "chan's Mobile")
   * When guest: "{Noun}" (e.g. "Desk", "iPhone", "iPad", "Mobile")
   */
  public getDefaultDeviceDisplayName(
    customUA?: string,
    customScreen?: { width: number; height: number; dpr?: number }
  ): string {
    const info = this.resolveHardwareInfo(customUA, customScreen);
    const noun = this.getDeviceNoun(info);
    const accountName = this.getAccountDisplayName();
    if (accountName && accountName.toLowerCase() !== 'jordan' && accountName.toLowerCase() !== 'guest') {
      return this.formatPossessive(accountName, noun);
    }
    return noun;
  }

  /**
   * Computes the display name for the local device:
   * userLabel ?? default possessive formula
   */
  public getLocalDeviceDisplayName(): string {
    const userLabel = this.getUserLabel();
    if (userLabel && userLabel.trim()) {
      return userLabel.replace(/\s*·\s*Jordan\b/gi, '').trim();
    }

    return this.getDefaultDeviceDisplayName();
  }

  /**
   * Resolves display name for a discovered peer.
   * Gracefully migrates any legacy "[Model] · [Account]" format into "[Account]'s [Noun]".
   */
  public formatPeerDisplayName(peer: DiscoveredPeer): string {
    if (peer.deviceName && peer.deviceName.trim()) {
      const clean = peer.deviceName.replace(/\s*·\s*Jordan\b/gi, '').trim();
      // If peer device name has legacy "Model · Account" format, convert to possessive
      if (clean.includes(' · ')) {
        const [rawModel, rawUser] = clean.split(' · ').map(s => s.trim());
        if (rawUser && rawUser.toLowerCase() !== 'jordan' && rawUser.toLowerCase() !== 'guest') {
          let noun = 'Speaker';
          if (/iPhone/i.test(rawModel)) noun = 'iPhone';
          else if (/iPad/i.test(rawModel)) noun = 'iPad';
          else if (/MacBook|Mac/i.test(rawModel)) noun = 'MacBook';
          else if (/Windows|PC|Desk|Surface/i.test(rawModel)) noun = 'Desk';
          else if (/Android|Mobile|Galaxy|Pixel|Realme|Phone/i.test(rawModel)) noun = 'Mobile';
          else if (/TV/i.test(rawModel)) noun = 'TV';
          return this.formatPossessive(rawUser, noun);
        }
      }
      return clean;
    }

    const accountName = peer.accountId || this.getAccountDisplayName();
    if (accountName && accountName.toLowerCase() !== 'jordan' && accountName.toLowerCase() !== 'guest') {
      return this.formatPossessive(accountName, 'Speaker');
    }
    return 'Speaker';
  }

  /**
   * Edge case: Duplicate model names with no custom label yet.
   * If two devices on the same account resolve to the identical string,
   * appends disambiguator (e.g. "iPhone 14 Pro · Jordan (2)").
   */
  public disambiguatePeers(peers: DiscoveredPeer[]): DiscoveredPeer[] {
    const counts = new Map<string, number>();
    const seen = new Map<string, number>();

    // Normalize and resolve names
    const resolved = peers.map((p) => {
      const name = p.deviceName && p.deviceName.trim()
        ? p.deviceName.trim()
        : this.formatPeerDisplayName(p);
      return { peer: p, name };
    });

    // Count occurrences of identical names
    for (const item of resolved) {
      counts.set(item.name, (counts.get(item.name) || 0) + 1);
    }

    return resolved.map(({ peer, name }) => {
      const total = counts.get(name) || 0;
      if (total <= 1) {
        return { ...peer, deviceName: name };
      }

      const current = (seen.get(name) || 0) + 1;
      seen.set(name, current);

      return {
        ...peer,
        deviceName: current === 1 ? name : `${name} (${current})`,
      };
    });
  }
}
