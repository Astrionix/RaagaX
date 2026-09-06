import { describe, it, expect, beforeEach } from 'vitest';
import { DeviceNameResolver } from '@/lib/connect/auth/DeviceNameResolver';
import { DiscoveredPeer } from '@/lib/connect/types';

describe('RaagaX Connect — DeviceNameResolver Specification Suite', () => {
  let resolver: DeviceNameResolver;

  beforeEach(() => {
    resolver = DeviceNameResolver.getInstance();
    // Clear user label
    resolver.setUserLabel(null);
  });

  describe('1. Hardware Model Resolution (Best-Effort Lookup Table)', () => {
    it('resolves iOS iPhone model identifiers accurately', () => {
      // Direct identifier in native/wrapper UA
      const info14Pro = resolver.resolveHardwareInfo(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 iPhone15,2'
      );
      expect(info14Pro.friendlyModel).toBe('iPhone 14 Pro');
      expect(info14Pro.deviceType).toBe('phone');

      const info15ProMax = resolver.resolveHardwareInfo(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 iPhone16,2'
      );
      expect(info15ProMax.friendlyModel).toBe('iPhone 15 Pro Max');

      // Screen metrics fallback for iOS
      const infoScreen15Pro = resolver.resolveHardwareInfo(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        { width: 393, height: 852, dpr: 3 }
      );
      expect(infoScreen15Pro.friendlyModel).toBe('iPhone 15 Pro');
    });

    it('resolves Android hardware models from raw strings (e.g. Realme, Galaxy, Pixel)', () => {
      // Realme RMX3363 -> Realme 11 Pro
      const realme = resolver.resolveHardwareInfo(
        'Mozilla/5.0 (Linux; Android 13; RMX3363 Build/TP1A.220905.001; wv) AppleWebKit/537.36 Mobile'
      );
      expect(realme.friendlyModel).toBe('Realme 11 Pro');
      expect(realme.deviceType).toBe('phone');

      // Samsung Galaxy S24 Ultra
      const samsung = resolver.resolveHardwareInfo(
        'Mozilla/5.0 (Linux; Android 14; SM-S928B Build/UP1A.231005.007) AppleWebKit/537.36 Mobile'
      );
      expect(samsung.friendlyModel).toBe('Galaxy S24 Ultra');

      // Google Pixel 8
      const pixel = resolver.resolveHardwareInfo(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro Build/UD1A.230803.041) AppleWebKit/537.36 Mobile'
      );
      expect(pixel.friendlyModel).toBe('Pixel 8 Pro');
    });

    it('resolves macOS and Windows desktop environments', () => {
      // MacBook Pro
      const mac = resolver.resolveHardwareInfo(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        { width: 1728, height: 1117 }
      );
      expect(mac.friendlyModel).toBe('MacBook Pro');
      expect(mac.deviceType).toBe('desktop');

      // Windows PC
      const win = resolver.resolveHardwareInfo(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      );
      expect(win.friendlyModel).toBe('Windows PC');
      expect(win.deviceType).toBe('desktop');
    });

    it('resolves Smart TVs and streaming devices', () => {
      const tv = resolver.resolveHardwareInfo(
        'Mozilla/5.0 (Web0S; SmartTV) AppleWebKit/537.36 Chrome/79.0.3945.79 Safari/537.36'
      );
      expect(tv.friendlyModel).toBe('Living Room TV');
      expect(tv.deviceType).toBe('tv');
    });
  });

  describe('2. Personalized Possessive Naming Formula (e.g. chan\'s Desk, chan\'s iPhone, chan\'s iPad, chan\'s Mobile)', () => {
    it('constructs clean default display name for guest, and formats possessive name when user is logged in', () => {
      resolver.setAccountDisplayName(null);
      const guestName = resolver.getDefaultDeviceDisplayName();
      expect(guestName).toBe('Desk');

      // When user logs in as "chan"
      resolver.setAccountDisplayName('chan');
      const chanDesk = resolver.getDefaultDeviceDisplayName();
      expect(chanDesk).toBe("chan's Desk");

      // Verify possessive apostrophe rules for names ending in 's'
      resolver.setAccountDisplayName('James');
      expect(resolver.getDefaultDeviceDisplayName()).toBe("James' Desk");

      resolver.setAccountDisplayName(null);
    });

    it('formats specific hardware device types with user account name (chan\'s iPhone, chan\'s iPad, chan\'s Mobile, chan\'s MacBook)', () => {
      resolver.setAccountDisplayName('chan');

      // iPhone
      const iphoneName = resolver.getDefaultDeviceDisplayName(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 iPhone15,2'
      );
      expect(iphoneName).toBe("chan's iPhone");

      // iPad
      const ipadName = resolver.getDefaultDeviceDisplayName(
        'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)'
      );
      expect(ipadName).toBe("chan's iPad");

      // Android Phone -> chan's Mobile
      const androidName = resolver.getDefaultDeviceDisplayName(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro Build/UD1A.230803.041) AppleWebKit/537.36 Mobile'
      );
      expect(androidName).toBe("chan's Mobile");

      // Samsung Galaxy -> chan's Mobile
      const galaxyName = resolver.getDefaultDeviceDisplayName(
        'Mozilla/5.0 (Linux; Android 14; SM-S928B Build/UP1A.231005.007) AppleWebKit/537.36 Mobile'
      );
      expect(galaxyName).toBe("chan's Mobile");

      // MacBook
      const macName = resolver.getDefaultDeviceDisplayName(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        { width: 1728, height: 1117 }
      );
      expect(macName).toBe("chan's MacBook");

      // TV
      const tvName = resolver.getDefaultDeviceDisplayName(
        'Mozilla/5.0 (Web0S; SmartTV) AppleWebKit/537.36 Chrome/79.0.3945.79 Safari/537.36'
      );
      expect(tvName).toBe("chan's TV");

      resolver.setAccountDisplayName(null);
    });

    it('migrates legacy peer names into possessive naming format', () => {
      const peerIphone: DiscoveredPeer = {
        deviceId: 'dev_iphone',
        deviceName: 'iPhone 14 Pro · chan',
        pubKeyFingerprint: 'fp_p1',
        protoVersion: 1,
        capabilities: ['player'],
        transport: 'mdns',
        lastSeen: Date.now(),
      };
      expect(resolver.formatPeerDisplayName(peerIphone)).toBe("chan's iPhone");

      const peerDesk: DiscoveredPeer = {
        deviceId: 'dev_desk',
        deviceName: 'Windows PC · chan',
        pubKeyFingerprint: 'fp_p2',
        protoVersion: 1,
        capabilities: ['player'],
        transport: 'mdns',
        lastSeen: Date.now(),
      };
      expect(resolver.formatPeerDisplayName(peerDesk)).toBe("chan's Desk");
    });
  });

  describe('3. User Label Override & Rename Flow', () => {
    it('allows the user to set a custom label that overrides the default', () => {
      // Initially default
      const initial = resolver.getLocalDeviceDisplayName();
      expect(initial.length).toBeGreaterThan(0);

      // User renames device to "Kitchen Speaker"
      resolver.setUserLabel('Kitchen Speaker');
      expect(resolver.getUserLabel()).toBe('Kitchen Speaker');
      expect(resolver.getLocalDeviceDisplayName()).toBe('Kitchen Speaker');

      // User clears label -> reverts to default formula
      resolver.setUserLabel(null);
      expect(resolver.getUserLabel()).toBeNull();
      expect(resolver.getLocalDeviceDisplayName()).toBe(initial);
    });

    it('triggers onNameChanged callback when user updates label', () => {
      let notifiedName = '';
      const unsub = resolver.onNameChanged((name) => {
        notifiedName = name;
      });

      resolver.setUserLabel('Studio Monitors');
      expect(notifiedName).toBe('Studio Monitors');

      unsub();
      resolver.setUserLabel('Office Headset');
      // Should not notify after unsub
      expect(notifiedName).toBe('Studio Monitors');
    });
  });

  describe('4. Duplicate Model Disambiguation: iPhone · Jordan (2)', () => {
    it('appends disambiguators (2), (3) to duplicate unlabeled models on the same account', () => {
      const peers: DiscoveredPeer[] = [
        {
          deviceId: 'dev_1',
          deviceName: 'iPhone 14 Pro · Jordan',
          pubKeyFingerprint: 'fp1',
          protoVersion: 1,
          capabilities: ['player'],
          transport: 'cloud_presence',
          accountId: 'acc_jordan',
          lastSeen: Date.now(),
        },
        {
          deviceId: 'dev_2',
          deviceName: 'iPhone 14 Pro · Jordan',
          pubKeyFingerprint: 'fp2',
          protoVersion: 1,
          capabilities: ['player'],
          transport: 'cloud_presence',
          accountId: 'acc_jordan',
          lastSeen: Date.now(),
        },
        {
          deviceId: 'dev_3',
          deviceName: 'iPhone 14 Pro · Jordan',
          pubKeyFingerprint: 'fp3',
          protoVersion: 1,
          capabilities: ['player'],
          transport: 'cloud_presence',
          accountId: 'acc_jordan',
          lastSeen: Date.now(),
        },
        {
          deviceId: 'dev_4',
          deviceName: 'MacBook Pro · Jordan',
          pubKeyFingerprint: 'fp4',
          protoVersion: 1,
          capabilities: ['player'],
          transport: 'mdns',
          accountId: 'acc_jordan',
          lastSeen: Date.now(),
        },
      ];

      const disambiguated = resolver.disambiguatePeers(peers);

      expect(disambiguated[0].deviceName).toBe('iPhone 14 Pro · Jordan');
      expect(disambiguated[1].deviceName).toBe('iPhone 14 Pro · Jordan (2)');
      expect(disambiguated[2].deviceName).toBe('iPhone 14 Pro · Jordan (3)');
      // Unique device name remains unchanged
      expect(disambiguated[3].deviceName).toBe('MacBook Pro · Jordan');
    });

    it('leaves uniquely named peers untouched', () => {
      const peers: DiscoveredPeer[] = [
        {
          deviceId: 'dev_1',
          deviceName: 'Kitchen Speaker',
          pubKeyFingerprint: 'fp1',
          protoVersion: 1,
          capabilities: ['player'],
          transport: 'mdns',
          lastSeen: Date.now(),
        },
        {
          deviceId: 'dev_2',
          deviceName: 'Living Room TV',
          pubKeyFingerprint: 'fp2',
          protoVersion: 1,
          capabilities: ['player'],
          transport: 'cloud_presence',
          lastSeen: Date.now(),
        },
      ];

      const result = resolver.disambiguatePeers(peers);
      expect(result[0].deviceName).toBe('Kitchen Speaker');
      expect(result[1].deviceName).toBe('Living Room TV');
    });
  });
});
