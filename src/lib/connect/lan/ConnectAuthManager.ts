'use client';

import { 
  LANHandshakeRequestMessage, 
  LANHandshakeResponseMessage, 
  LANPairingRequestMessage,
  LANPairingResponseMessage,
  LANRevokePairingMessage,
  LANAuthTier, 
  LANDeviceAdvertisement,
  LANControlPolicy,
  LANSwitchPolicy,
  LANPermissions,
  LANExpiryDuration,
  TrustedPeer,
  LANRemoteCommandMessage
} from './types';
import { useAuthStore } from '@/context/useAuthStore';
import { DirectLANTransport } from './DirectLANTransport';
import { LocalDiscoveryService } from './LocalDiscoveryService';

const TRUSTED_PEERS_STORAGE_KEY = 'raagax_lan_trusted_peers_v2';
const CONNECT_POLICIES_STORAGE_KEY = 'raagax_lan_connect_policies_v2';

export interface PendingPairingPrompt {
  pairingId: string;
  requesterDevice: LANDeviceAdvertisement;
  requestedPermissions: LANPermissions;
  timestamp: number;
}

export class ConnectAuthManager {
  private static instance: ConnectAuthManager;
  
  private controlPolicy: LANControlPolicy = 'ASK_EVERY_TIME';
  private switchPolicy: LANSwitchPolicy = 'ASK_EVERY_TIME';
  
  private trustedPeers = new Map<string, TrustedPeer>();
  private authorizedSessions = new Map<string, {
    authTier: LANAuthTier;
    userId?: string;
    deviceId: string;
    verifiedAt: number;
  }>();

  private pendingPairingPrompts = new Map<string, {
    req: LANPairingRequestMessage;
    resolve: (resp: LANPairingResponseMessage) => void;
  }>();

  private pairingListeners = new Set<(prompts: PendingPairingPrompt[]) => void>();
  private peersListeners = new Set<(peers: TrustedPeer[]) => void>();
  
  // Monotonic sequence and replay tracking per sender
  private lastSequences = new Map<string, number>();
  private processedCommandIds = new Set<string>();

  private constructor() {
    this.loadPersistedState();

    DirectLANTransport.getInstance().onMessage((msg) => {
      if (msg.type === 'HANDSHAKE_REQUEST') {
        this.handleHandshakeRequest(msg as LANHandshakeRequestMessage);
      } else if (msg.type === 'HANDSHAKE_RESPONSE') {
        this.handleHandshakeResponse(msg as LANHandshakeResponseMessage);
      } else if (msg.type === 'PAIRING_REQUEST') {
        this.handlePairingRequest(msg as LANPairingRequestMessage);
      } else if (msg.type === 'PAIRING_RESPONSE') {
        this.handlePairingResponse(msg as LANPairingResponseMessage);
      } else if (msg.type === 'REVOKE_PAIRING') {
        this.handleRevokePairing(msg as LANRevokePairingMessage);
      }
    });
  }

  public static getInstance(): ConnectAuthManager {
    if (!ConnectAuthManager.instance) {
      ConnectAuthManager.instance = new ConnectAuthManager();
    }
    return ConnectAuthManager.instance;
  }

  private loadPersistedState() {
    if (typeof window === 'undefined') return;
    try {
      const storedPeers = localStorage.getItem(TRUSTED_PEERS_STORAGE_KEY);
      if (storedPeers) {
        const parsed: TrustedPeer[] = JSON.parse(storedPeers);
        const now = Date.now();
        parsed.forEach((p) => {
          if (!p.expiresAt || p.expiresAt > now) {
            this.trustedPeers.set(p.deviceId, p);
          }
        });
      }

      const storedPolicies = localStorage.getItem(CONNECT_POLICIES_STORAGE_KEY);
      if (storedPolicies) {
        const { controlPolicy, switchPolicy } = JSON.parse(storedPolicies);
        if (controlPolicy) this.controlPolicy = controlPolicy;
        if (switchPolicy) this.switchPolicy = switchPolicy;
      }
    } catch (e) {
      console.warn('[ConnectAuthManager] Error loading persisted auth config:', e);
    }
  }

  private persistState() {
    if (typeof window === 'undefined') return;
    try {
      const peersArray = Array.from(this.trustedPeers.values());
      localStorage.setItem(TRUSTED_PEERS_STORAGE_KEY, JSON.stringify(peersArray));
      localStorage.setItem(
        CONNECT_POLICIES_STORAGE_KEY,
        JSON.stringify({ controlPolicy: this.controlPolicy, switchPolicy: this.switchPolicy })
      );
    } catch {}
    this.notifyPeersListeners();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Policy & Trusted Peer Management (Settings UI / Kill Switch)
  // ─────────────────────────────────────────────────────────────────────────────

  public getControlPolicy(): LANControlPolicy {
    return this.controlPolicy;
  }

  public getSwitchPolicy(): LANSwitchPolicy {
    return this.switchPolicy;
  }

  public setPolicies(controlPolicy: LANControlPolicy, switchPolicy?: LANSwitchPolicy) {
    this.controlPolicy = controlPolicy;
    if (switchPolicy) this.switchPolicy = switchPolicy;
    this.persistState();
  }

  public getTrustedPeers(): TrustedPeer[] {
    const now = Date.now();
    // Prune expired
    let changed = false;
    this.trustedPeers.forEach((p, k) => {
      if (p.expiresAt && p.expiresAt <= now) {
        this.trustedPeers.delete(k);
        changed = true;
      }
    });
    if (changed) this.persistState();
    return Array.from(this.trustedPeers.values());
  }

  public removeTrustedPeer(deviceId: string) {
    this.trustedPeers.delete(deviceId);
    this.persistState();

    // Broadcast revoke over LAN
    const localIdentity = LocalDiscoveryService.getInstance().getLocalIdentity();
    DirectLANTransport.getInstance().sendMessage(deviceId, {
      id: 'rev_' + Math.random().toString(36).substring(2, 10),
      type: 'REVOKE_PAIRING',
      sourceDeviceId: localIdentity.deviceId,
      targetDeviceId: deviceId,
      timestamp: Date.now(),
    });
  }

  public removeAllTrustedPeers() {
    const peerIds = Array.from(this.trustedPeers.keys());
    this.trustedPeers.clear();
    this.lastSequences.clear();
    this.processedCommandIds.clear();
    this.persistState();

    const localIdentity = LocalDiscoveryService.getInstance().getLocalIdentity();
    peerIds.forEach((targetId) => {
      DirectLANTransport.getInstance().sendMessage(targetId, {
        id: 'rev_' + Math.random().toString(36).substring(2, 10),
        type: 'REVOKE_PAIRING',
        sourceDeviceId: localIdentity.deviceId,
        targetDeviceId: targetId,
        timestamp: Date.now(),
      });
    });
  }

  public onTrustedPeersChange(fn: (peers: TrustedPeer[]) => void): () => void {
    this.peersListeners.add(fn);
    fn(this.getTrustedPeers());
    return () => this.peersListeners.delete(fn);
  }

  private notifyPeersListeners() {
    const list = this.getTrustedPeers();
    this.peersListeners.forEach((fn) => fn(list));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Pairing Approval Flow
  // ─────────────────────────────────────────────────────────────────────────────

  public onPairingRequestPrompt(fn: (prompts: PendingPairingPrompt[]) => void): () => void {
    this.pairingListeners.add(fn);
    fn(this.getActivePairingPrompts());
    return () => this.pairingListeners.delete(fn);
  }

  public getActivePairingPrompts(): PendingPairingPrompt[] {
    return Array.from(this.pendingPairingPrompts.values()).map((p) => ({
      pairingId: p.req.pairingId,
      requesterDevice: p.req.clientIdentity,
      requestedPermissions: p.req.requestedPermissions,
      timestamp: p.req.timestamp,
    }));
  }

  private notifyPairingListeners() {
    const list = this.getActivePairingPrompts();
    this.pairingListeners.forEach((fn) => fn(list));
  }

  /**
   * Controller Device: Sends pairing request to target device
   */
  public async requestPairing(
    targetDeviceId: string,
    requestedPermissions: LANPermissions = { allowControl: true, allowSwitch: false },
    duration: LANExpiryDuration = 'permanent'
  ): Promise<LANPairingResponseMessage> {
    const localIdentity = LocalDiscoveryService.getInstance().getLocalIdentity();
    const pairingId = 'pair_' + Math.random().toString(36).substring(2, 12);

    const requestMsg: LANPairingRequestMessage = {
      id: 'preq_' + Math.random().toString(36).substring(2, 10),
      type: 'PAIRING_REQUEST',
      pairingId,
      sourceDeviceId: localIdentity.deviceId,
      targetDeviceId,
      clientIdentity: localIdentity,
      requestedPermissions,
      timestamp: Date.now(),
    };

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({
          id: 'timeout_' + pairingId,
          type: 'PAIRING_RESPONSE',
          pairingId,
          sourceDeviceId: targetDeviceId,
          targetDeviceId: localIdentity.deviceId,
          accepted: false,
          grantedPermissions: { allowControl: false, allowSwitch: false },
          expiresAt: null,
          reason: 'Pairing request timed out',
          timestamp: Date.now(),
        });
      }, 30000); // 30s for human interaction

      const unbind = DirectLANTransport.getInstance().onMessage((msg) => {
        if (msg.type === 'PAIRING_RESPONSE' && (msg as LANPairingResponseMessage).pairingId === pairingId) {
          clearTimeout(timeout);
          unbind();
          const resp = msg as LANPairingResponseMessage;
          if (resp.accepted) {
            // Save as paired target peer
            const dev = LocalDiscoveryService.getInstance().getDiscoveredDevices().find((d) => d.deviceId === targetDeviceId);
            this.trustedPeers.set(targetDeviceId, {
              deviceId: targetDeviceId,
              deviceName: dev?.deviceName || 'Paired Device',
              accountName: dev?.accountName,
              userId: dev?.userId,
              permissions: resp.grantedPermissions,
              pairedAt: Date.now(),
              expiresAt: resp.expiresAt,
            });
            this.persistState();
          }
          resolve(resp);
        }
      });

      DirectLANTransport.getInstance().sendMessage(targetDeviceId, requestMsg);
    });
  }

  /**
   * Target Device: Receives incoming pairing request from controller
   */
  public handlePairingRequest(req: LANPairingRequestMessage) {
    const localIdentity = LocalDiscoveryService.getInstance().getLocalIdentity();

    // 1. Check Policy: NOBODY
    if (this.controlPolicy === 'NOBODY') {
      const rejectMsg: LANPairingResponseMessage = {
        id: 'presp_' + Math.random().toString(36).substring(2, 10),
        type: 'PAIRING_RESPONSE',
        pairingId: req.pairingId,
        sourceDeviceId: localIdentity.deviceId,
        targetDeviceId: req.sourceDeviceId,
        accepted: false,
        grantedPermissions: { allowControl: false, allowSwitch: false },
        expiresAt: null,
        reason: 'Remote control disabled on this device',
        timestamp: Date.now(),
      };
      DirectLANTransport.getInstance().sendMessage(req.sourceDeviceId, rejectMsg);
      return;
    }

    // 2. Check Policy: ANYONE_ON_WIFI
    if (this.controlPolicy === 'ANYONE_ON_WIFI') {
      const acceptMsg: LANPairingResponseMessage = {
        id: 'presp_' + Math.random().toString(36).substring(2, 10),
        type: 'PAIRING_RESPONSE',
        pairingId: req.pairingId,
        sourceDeviceId: localIdentity.deviceId,
        targetDeviceId: req.sourceDeviceId,
        accepted: true,
        grantedPermissions: req.requestedPermissions,
        expiresAt: null,
        timestamp: Date.now(),
      };
      this.trustedPeers.set(req.sourceDeviceId, {
        deviceId: req.sourceDeviceId,
        deviceName: req.clientIdentity.deviceName,
        accountName: req.clientIdentity.accountName,
        userId: req.clientIdentity.userId,
        permissions: req.requestedPermissions,
        pairedAt: Date.now(),
        expiresAt: null,
      });
      this.persistState();
      DirectLANTransport.getInstance().sendMessage(req.sourceDeviceId, acceptMsg);
      return;
    }

    // 3. Check Policy: TRUSTED_ONLY
    if (this.controlPolicy === 'TRUSTED_ONLY') {
      const existing = this.trustedPeers.get(req.sourceDeviceId);
      if (existing && (!existing.expiresAt || existing.expiresAt > Date.now())) {
        const acceptMsg: LANPairingResponseMessage = {
          id: 'presp_' + Math.random().toString(36).substring(2, 10),
          type: 'PAIRING_RESPONSE',
          pairingId: req.pairingId,
          sourceDeviceId: localIdentity.deviceId,
          targetDeviceId: req.sourceDeviceId,
          accepted: true,
          grantedPermissions: existing.permissions,
          expiresAt: existing.expiresAt,
          timestamp: Date.now(),
        };
        DirectLANTransport.getInstance().sendMessage(req.sourceDeviceId, acceptMsg);
        return;
      }
      // Not trusted yet -> reject
      const rejectMsg: LANPairingResponseMessage = {
        id: 'presp_' + Math.random().toString(36).substring(2, 10),
        type: 'PAIRING_RESPONSE',
        pairingId: req.pairingId,
        sourceDeviceId: localIdentity.deviceId,
        targetDeviceId: req.sourceDeviceId,
        accepted: false,
        grantedPermissions: { allowControl: false, allowSwitch: false },
        expiresAt: null,
        reason: 'Device not in trusted devices list',
        timestamp: Date.now(),
      };
      DirectLANTransport.getInstance().sendMessage(req.sourceDeviceId, rejectMsg);
      return;
    }

    // 4. Default: ASK_EVERY_TIME -> Queue UI modal prompt for owner approval
    this.pendingPairingPrompts.set(req.pairingId, {
      req,
      resolve: (resp) => {
        DirectLANTransport.getInstance().sendMessage(req.sourceDeviceId, resp);
      },
    });
    this.notifyPairingListeners();
  }

  /**
   * Target Device Owner Action: User clicks [Allow] or [Decline] in UI Modal
   */
  public respondToPairingPrompt(
    pairingId: string,
    accepted: boolean,
    grantedPermissions: LANPermissions = { allowControl: true, allowSwitch: false },
    duration: LANExpiryDuration = 'permanent'
  ) {
    const pending = this.pendingPairingPrompts.get(pairingId);
    if (!pending) return;

    this.pendingPairingPrompts.delete(pairingId);
    this.notifyPairingListeners();

    const localIdentity = LocalDiscoveryService.getInstance().getLocalIdentity();

    let expiresAt: number | null = null;
    if (duration === '15m') expiresAt = Date.now() + 15 * 60 * 1000;
    else if (duration === '1h') expiresAt = Date.now() + 60 * 60 * 1000;
    else if (duration === 'session') expiresAt = Date.now() + 12 * 60 * 60 * 1000;

    const responseMsg: LANPairingResponseMessage = {
      id: 'presp_' + Math.random().toString(36).substring(2, 10),
      type: 'PAIRING_RESPONSE',
      pairingId,
      sourceDeviceId: localIdentity.deviceId,
      targetDeviceId: pending.req.sourceDeviceId,
      accepted,
      grantedPermissions: accepted ? grantedPermissions : { allowControl: false, allowSwitch: false },
      expiresAt: accepted ? expiresAt : null,
      reason: accepted ? undefined : 'Declined by device owner',
      timestamp: Date.now(),
    };

    if (accepted) {
      this.trustedPeers.set(pending.req.sourceDeviceId, {
        deviceId: pending.req.sourceDeviceId,
        deviceName: pending.req.clientIdentity.deviceName,
        accountName: pending.req.clientIdentity.accountName,
        userId: pending.req.clientIdentity.userId,
        permissions: grantedPermissions,
        pairedAt: Date.now(),
        expiresAt,
      });
      this.persistState();
    }

    pending.resolve(responseMsg);
  }

  private handlePairingResponse(resp: LANPairingResponseMessage) {
    // Handled by requestPairing promise listener
  }

  private handleRevokePairing(msg: LANRevokePairingMessage) {
    this.trustedPeers.delete(msg.sourceDeviceId);
    this.persistState();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Handshake & Session Authorization
  // ─────────────────────────────────────────────────────────────────────────────

  public async initiateHandshake(targetDeviceId: string): Promise<LANAuthTier> {
    const localIdentity = LocalDiscoveryService.getInstance().getLocalIdentity();
    const currentUser = useAuthStore.getState().user;

    const requestMsg: LANHandshakeRequestMessage = {
      id: 'hs_' + Math.random().toString(36).substring(2, 10),
      type: 'HANDSHAKE_REQUEST',
      sourceDeviceId: localIdentity.deviceId,
      targetDeviceId,
      clientIdentity: localIdentity,
      sessionToken: currentUser?.id ? `token_${currentUser.id}` : undefined,
      clientNonce: Math.random().toString(36).substring(2, 12),
      timestamp: Date.now(),
    };

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve('UNVERIFIED');
      }, 3500);

      const unbind = DirectLANTransport.getInstance().onMessage((msg) => {
        if (msg.type === 'HANDSHAKE_RESPONSE' && msg.sourceDeviceId === targetDeviceId) {
          clearTimeout(timeout);
          unbind();
          const resp = msg as LANHandshakeResponseMessage;
          this.authorizedSessions.set(targetDeviceId, {
            authTier: resp.authTier,
            userId: resp.serverIdentity?.userId,
            deviceId: targetDeviceId,
            verifiedAt: Date.now(),
          });
          resolve(resp.authTier);
        }
      });

      DirectLANTransport.getInstance().sendMessage(targetDeviceId, requestMsg);
    });
  }

  public handleHandshakeRequest(req: LANHandshakeRequestMessage) {
    const localIdentity = LocalDiscoveryService.getInstance().getLocalIdentity();
    const currentUser = useAuthStore.getState().user;

    const requesterUserId = req.clientIdentity?.userId;
    const isSameAccount = Boolean(
      currentUser?.id && requesterUserId && currentUser.id === requesterUserId
    );

    let authTier: LANAuthTier = 'UNVERIFIED';
    if (isSameAccount) {
      authTier = 'SAME_ACCOUNT';
    } else if (requesterUserId) {
      authTier = 'OTHER_ACCOUNT';
    }

    const responseMsg: LANHandshakeResponseMessage = {
      id: 'hs_resp_' + Math.random().toString(36).substring(2, 10),
      type: 'HANDSHAKE_RESPONSE',
      sourceDeviceId: localIdentity.deviceId,
      targetDeviceId: req.sourceDeviceId,
      authTier,
      accepted: authTier === 'SAME_ACCOUNT' || authTier === 'OTHER_ACCOUNT' || authTier === 'UNVERIFIED',
      serverIdentity: localIdentity,
      sessionId: 'sess_' + Math.random().toString(36).substring(2, 12),
      timestamp: Date.now(),
    };

    this.authorizedSessions.set(req.sourceDeviceId, {
      authTier,
      userId: requesterUserId,
      deviceId: req.sourceDeviceId,
      verifiedAt: Date.now(),
    });

    DirectLANTransport.getInstance().sendMessage(req.sourceDeviceId, responseMsg);
  }

  public handleHandshakeResponse(resp: LANHandshakeResponseMessage) {
    this.authorizedSessions.set(resp.sourceDeviceId, {
      authTier: resp.authTier,
      userId: resp.serverIdentity?.userId,
      deviceId: resp.sourceDeviceId,
      verifiedAt: Date.now(),
    });
  }

  public getAuthTier(deviceId: string): LANAuthTier {
    const session = this.authorizedSessions.get(deviceId);
    if (session) return session.authTier;

    // Fall back to discovered device auth tier
    const discovered = LocalDiscoveryService.getInstance().getDiscoveredDevices().find((d) => d.deviceId === deviceId);
    if (discovered) {
      return discovered.authTier;
    }

    return 'UNVERIFIED';
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Permission Checks (Granular Control & Switch Verification)
  // ─────────────────────────────────────────────────────────────────────────────

  public addTrustedPeer(peer: TrustedPeer) {
    this.trustedPeers.set(peer.deviceId, peer);
    this.persistState();
  }

  public isPaired(deviceId: string): boolean {
    const peer = this.trustedPeers.get(deviceId);
    if (!peer) return false;
    if (peer.expiresAt && peer.expiresAt <= Date.now()) {
      this.trustedPeers.delete(deviceId);
      this.persistState();
      return false;
    }
    return true;
  }

  public canControl(deviceId: string): boolean {
    if (!deviceId || deviceId === 'local' || deviceId === 'local_device' || deviceId === 'broadcast') {
      return true;
    }
    const localId = LocalDiscoveryService.getInstance().getLocalIdentity().deviceId;
    if (deviceId === localId) return true;

    // 1. Same account is automatically authorized
    if (this.getAuthTier(deviceId) === 'SAME_ACCOUNT') return true;

    // 2. Open Wi-Fi policy allows all local peers
    if (this.controlPolicy === 'ANYONE_ON_WIFI') return true;

    // 3. Authorized handshake sessions
    const session = this.authorizedSessions.get(deviceId);
    if (session && session.authTier === 'SAME_ACCOUNT') {
      return true;
    }

    // 4. Explicitly paired with allowControl permission
    const peer = this.trustedPeers.get(deviceId);
    if (peer) {
      if (peer.expiresAt && peer.expiresAt <= Date.now()) {
        this.trustedPeers.delete(deviceId);
        this.persistState();
        return false;
      }
      return peer.permissions.allowControl;
    }

    return false;
  }

  public canSwitch(deviceId: string): boolean {
    if (!deviceId || deviceId === 'local' || deviceId === 'local_device' || deviceId === 'broadcast') {
      return true;
    }
    const localId = LocalDiscoveryService.getInstance().getLocalIdentity().deviceId;
    if (deviceId === localId) return true;

    // 1. Same account is automatically authorized
    if (this.getAuthTier(deviceId) === 'SAME_ACCOUNT') return true;

    // 2. Open Wi-Fi policy allows switching
    if (this.controlPolicy === 'ANYONE_ON_WIFI') return true;

    // 3. Authorized handshake sessions
    const session = this.authorizedSessions.get(deviceId);
    if (session && session.authTier === 'SAME_ACCOUNT') {
      return true;
    }

    // 4. Explicitly paired with allowSwitch permission
    const peer = this.trustedPeers.get(deviceId);
    if (peer) {
      if (peer.expiresAt && peer.expiresAt <= Date.now()) {
        this.trustedPeers.delete(deviceId);
        this.persistState();
        return false;
      }
      return peer.permissions.allowSwitch;
    }

    return false;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Replay Attack Defense & Monotonic Sequence Check
  // ─────────────────────────────────────────────────────────────────────────────

  public validateCommandSecurity(cmd: LANRemoteCommandMessage): boolean {
    // 1. Check idempotency deduplication
    if (this.processedCommandIds.has(cmd.commandId)) {
      console.warn(`[ConnectAuthManager] Replay attack detected: duplicate commandId ${cmd.commandId}`);
      return false;
    }

    // 2. Check timestamp freshness (within 10s window)
    const now = Date.now();
    if (cmd.timestamp && Math.abs(now - cmd.timestamp) > 10000) {
      console.warn(`[ConnectAuthManager] Stale timestamp for command ${cmd.commandId}: ${cmd.timestamp} (now: ${now})`);
      return false;
    }

    // 3. Monotonic sequence check if sequence is provided
    if (cmd.sequence !== undefined) {
      const lastSeq = this.lastSequences.get(cmd.sourceDeviceId) || 0;
      if (cmd.sequence <= lastSeq) {
        console.warn(`[ConnectAuthManager] Out-of-order/replayed sequence ${cmd.sequence} <= ${lastSeq}`);
        return false;
      }
      this.lastSequences.set(cmd.sourceDeviceId, cmd.sequence);
    }

    this.processedCommandIds.add(cmd.commandId);
    if (this.processedCommandIds.size > 2000) {
      // Prune old command IDs
      const iterator = this.processedCommandIds.values();
      for (let i = 0; i < 500; i++) {
        const val = iterator.next().value;
        if (val) this.processedCommandIds.delete(val);
      }
    }

    return true;
  }
}
