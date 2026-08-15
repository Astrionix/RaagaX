/**
 * TransportHealthMonitor — watches RTT and heartbeat trends per peer and classifies
 * the LAN connection health as STABLE, DEGRADING, or RECOVERING.
 *
 * Used by TransportRouter to pre-warm Cloud before LAN dies, eliminating the
 * "visible disconnect" window when quality degrades.
 *
 * Health transitions:
 *   STABLE    → DEGRADING: 3 consecutive samples with RTT > DEGRADED_RTT_MS or loss > DEGRADED_LOSS
 *   DEGRADING → STABLE:    Cloud already warm; LAN score recovers
 *   DEGRADING → RECOVERING: LAN score drops below Cloud (TransportRouter switches transport)
 *   RECOVERING → STABLE:   LAN score exceeds Cloud again after at least MIN_STABLE_SAMPLES
 */

import { TransportScorer } from './TransportScorer';
import { ConnectivityRouter } from './ConnectivityRouter';

export type LanHealthTrend = 'STABLE' | 'DEGRADING' | 'RECOVERING';

const DEGRADED_RTT_MS = 250;    // RTT above this is "degraded"
const DEGRADED_LOSS = 0.1;      // 10% loss is "degraded"
const DEGRADE_CONSECUTIVE = 3;  // Consecutive bad samples before transition
const MIN_STABLE_SAMPLES = 3;   // Samples needed before declaring STABLE again

export class TransportHealthMonitor {
  private static instance: TransportHealthMonitor;

  private trend: LanHealthTrend = 'STABLE';
  private badSampleCount = 0;
  private goodSampleCount = 0;

  private constructor() {}

  public static getInstance(): TransportHealthMonitor {
    if (!TransportHealthMonitor.instance) {
      TransportHealthMonitor.instance = new TransportHealthMonitor();
    }
    return TransportHealthMonitor.instance;
  }

  /**
   * Called on each heartbeat cycle (from LocalPeerConnection).
   * Updates trend state and triggers pre-warm or recovery as needed.
   */
  public onHeartbeatCycle(deviceId: string) {
    const scorer = TransportScorer.getInstance();
    const lan = scorer.getScore('LOCAL_DIRECT');
    const cloud = scorer.getScore('CLOUD_RELAY');

    if (!lan.isAvailable) {
      this.trend = 'RECOVERING';
      this.badSampleCount = 0;
      this.goodSampleCount = 0;
      return;
    }

    const isLanBad =
      lan.rttMs > DEGRADED_RTT_MS ||
      lan.lossRate > DEGRADED_LOSS ||
      scorer.isLanDegrading();

    if (isLanBad) {
      this.badSampleCount++;
      this.goodSampleCount = 0;

      if (this.badSampleCount >= DEGRADE_CONSECUTIVE && this.trend === 'STABLE') {
        console.warn(
          `[TransportHealthMonitor] LAN DEGRADING for ${deviceId}. ` +
          `RTT=${lan.rttMs.toFixed(0)}ms, loss=${(lan.lossRate * 100).toFixed(0)}%. ` +
          `Pre-warming Cloud relay.`
        );
        this.trend = 'DEGRADING';
        // Cloud is already being maintained; recalculate to potentially switch
        ConnectivityRouter.getInstance().recalculateBestRoute();
      }
    } else {
      this.goodSampleCount++;
      this.badSampleCount = 0;

      if (this.goodSampleCount >= MIN_STABLE_SAMPLES && this.trend !== 'STABLE') {
        console.log(
          `[TransportHealthMonitor] LAN RECOVERING for ${deviceId}. ` +
          `RTT=${lan.rttMs.toFixed(0)}ms, score=${lan.score.toFixed(1)} vs cloud=${cloud.score.toFixed(1)}`
        );
        this.trend = 'STABLE';
        ConnectivityRouter.getInstance().recalculateBestRoute();
      }
    }
  }

  public getTrend(): LanHealthTrend {
    return this.trend;
  }

  public reset() {
    this.trend = 'STABLE';
    this.badSampleCount = 0;
    this.goodSampleCount = 0;
  }
}
