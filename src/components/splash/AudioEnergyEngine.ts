/**
 * RaagaX Cinematic Splash Audio Energy Engine
 * Procedural harmonic audio synthesis + Web Audio Analyser bridge.
 * Drives synchronized micro-reactions across logo, particles, waveform, terrain, and lighting.
 */

export interface AudioEnergyState {
  bass: number;
  mid: number;
  treble: number;
  energy: number;
  beat: number;
}

export class AudioEnergyEngine {
  private static instance: AudioEnergyEngine;
  private state: AudioEnergyState = { bass: 0, mid: 0, treble: 0, energy: 0, beat: 0 };
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;

  private constructor() {}

  public static getInstance(): AudioEnergyEngine {
    if (!AudioEnergyEngine.instance) {
      AudioEnergyEngine.instance = new AudioEnergyEngine();
    }
    return AudioEnergyEngine.instance;
  }

  public setAnalyser(analyser: AnalyserNode) {
    this.analyser = analyser;
    this.dataArray = new Uint8Array(analyser.frequencyBinCount);
  }

  public update(time: number, delta: number): AudioEnergyState {
    if (this.analyser && this.dataArray) {
      (this.analyser as any).getByteFrequencyData(this.dataArray);
      const binCount = this.dataArray.length;
      
      const avgRange = (startRatio: number, endRatio: number) => {
        if (!this.dataArray) return 0;
        const start = Math.floor(binCount * startRatio);
        const end = Math.floor(binCount * endRatio);
        let sum = 0;
        const len = Math.max(1, end - start);
        for (let i = start; i < end; i++) sum += this.dataArray[i];
        return sum / len / 255;
      };

      const rawBass = avgRange(0, 0.15);
      const rawMid = avgRange(0.15, 0.6);
      const rawTreble = avgRange(0.6, 1.0);

      this.state.bass += (rawBass - this.state.bass) * 0.2;
      this.state.mid += (rawMid - this.state.mid) * 0.2;
      this.state.treble += (rawTreble - this.state.treble) * 0.2;
      this.state.energy = this.state.bass * 0.55 + this.state.mid * 0.30 + this.state.treble * 0.15;
      this.state.beat = this.state.bass > 0.65 ? 1 : 0;
      return this.state;
    }

    // Procedural Cinematic Audio Simulation (Weighted Harmonics)
    const t = time;
    const basePulse = Math.sin(t * 2.8);
    const harmonicA = Math.sin(t * 5.6 + 0.4);
    const harmonicB = Math.cos(t * 8.4 - 0.2);

    const bass = Math.max(0, basePulse * 0.5 + 0.5) * Math.pow(Math.sin(t * 1.4) * 0.5 + 0.5, 2);
    const mid = Math.max(0, harmonicA * 0.4 + 0.4);
    const treble = Math.max(0, harmonicB * 0.3 + 0.3);

    const energy = bass * 0.55 + mid * 0.30 + treble * 0.15;
    const beat = bass > 0.7 ? 1.0 : 0.0;

    this.state.bass += (bass - this.state.bass) * (delta * 8);
    this.state.mid += (mid - this.state.mid) * (delta * 8);
    this.state.treble += (treble - this.state.treble) * (delta * 8);
    this.state.energy += (energy - this.state.energy) * (delta * 8);
    this.state.beat = beat;

    return this.state;
  }
}
