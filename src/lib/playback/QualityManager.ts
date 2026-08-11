import { NetworkMonitor, NetworkProfile } from './NetworkMonitor';
import { BufferMonitor, BufferHealth } from './BufferMonitor';
import { DeviceCapability } from './DeviceCapability';
import { AudioQuality } from './types';
import { usePlayerStore } from '@/context/usePlayerStore';

export interface QualityDecision {
  requested: AudioQuality;
  target: AudioQuality;
  reason: 'USER' | 'NETWORK' | 'BUFFER' | 'DEVICE' | 'DATA_SAVER' | 'SOURCE_LIMIT';
}

export class QualityManager {
  private static instance: QualityManager;
  private currentTarget: AudioQuality = 'AUTO';
  
  // Hysteresis counters
  private consecutivePoorBufferSeconds = 0;
  private consecutiveHealthyBufferSeconds = 0;

  private readonly QUALITY_LEVELS: AudioQuality[] = ['LOW', 'NORMAL', 'HIGH', 'VERY_HIGH', 'LOSSLESS'];

  private constructor() {
    NetworkMonitor.getInstance().subscribe(this.handleNetworkChange);
    BufferMonitor.getInstance().subscribe(this.handleBufferChange);
  }

  public static getInstance(): QualityManager {
    if (!QualityManager.instance) {
      QualityManager.instance = new QualityManager();
    }
    return QualityManager.instance;
  }

  public async getTargetQuality(): Promise<QualityDecision> {
    const store = usePlayerStore.getState();
    const requested = store.streamingQuality;
    const isDataSaver = store.isDataSaverEnabled;
    const network = NetworkMonitor.getInstance().getProfile();
    
    // 1. Check Data Saver
    if (isDataSaver || network.saveData) {
      return {
        requested,
        target: 'NORMAL',
        reason: 'DATA_SAVER'
      };
    }

    // 2. Resolve AUTO
    let target = requested;
    if (requested === 'AUTO') {
      target = this.evaluateAutoQuality(network);
    }
    
    // 3. Override if Lossless is requested but device can't handle it smoothly
    if (target === 'LOSSLESS') {
      const caps = await DeviceCapability.getInstance().getCapabilities();
      if (!caps.canPlayLossless) {
        return { requested, target: 'VERY_HIGH', reason: 'DEVICE' };
      }
    }

    // 4. Apply hysteresis buffer caps
    if (requested === 'AUTO') {
      target = this.applyBufferHysteresis(target);
    }
    
    this.currentTarget = target;
    return { requested, target, reason: requested === 'AUTO' ? 'NETWORK' : 'USER' };
  }

  private evaluateAutoQuality(network: NetworkProfile): AudioQuality {
    if (!network.isOnline) return 'LOW';
    if (network.type === 'cellular') {
      if (network.effectiveType === '4g' || network.effectiveType === '5g') {
        return 'NORMAL';
      }
      return 'LOW';
    }
    
    if (network.type === 'wifi' || network.type === 'ethernet') {
      if (network.downlinkMbps && network.downlinkMbps < 5) {
        return 'HIGH';
      }
      return 'VERY_HIGH';
    }
    
    return 'NORMAL';
  }

  private applyBufferHysteresis(networkSuggested: AudioQuality): AudioQuality {
    // If we've been struggling for > 10 seconds, cap at NORMAL
    if (this.consecutivePoorBufferSeconds > 10) {
      return this.minQuality(networkSuggested, 'NORMAL');
    }
    // If we're doing amazing for > 30 seconds, we can trust the network
    if (this.consecutiveHealthyBufferSeconds > 30) {
      return networkSuggested;
    }
    
    // Otherwise stick to the last currentTarget to avoid rapid oscillation
    if (this.currentTarget !== 'AUTO' && this.currentTarget !== 'LOSSLESS') {
      return this.currentTarget;
    }
    
    return networkSuggested;
  }

  private minQuality(q1: AudioQuality, q2: AudioQuality): AudioQuality {
    const idx1 = this.QUALITY_LEVELS.indexOf(q1);
    const idx2 = this.QUALITY_LEVELS.indexOf(q2);
    if (idx1 === -1) return q2;
    if (idx2 === -1) return q1;
    return this.QUALITY_LEVELS[Math.min(idx1, idx2)];
  }

  private handleNetworkChange = (profile: NetworkProfile) => {
    // We could proactively trigger a QualityManager resolution here if desired,
    // but typically we let PreloadManager ask when it needs to.
  };

  private handleBufferChange = (health: BufferHealth) => {
    if (health.isStalled || health.bufferedDurationSec < 5) {
      this.consecutivePoorBufferSeconds += 1;
      this.consecutiveHealthyBufferSeconds = 0;
    } else if (health.bufferedDurationSec > 15) {
      this.consecutiveHealthyBufferSeconds += 1;
      // Cool down the poor buffer counter if we're recovering
      this.consecutivePoorBufferSeconds = Math.max(0, this.consecutivePoorBufferSeconds - 1);
    } else {
      // Neutral zone, do nothing
    }
  };
}
