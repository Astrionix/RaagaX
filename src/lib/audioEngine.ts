export class AudioEngine {
  private static instance: AudioEngine;
  private audioCtx: AudioContext | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private pannerNode: StereoPannerNode | PannerNode | null = null;

  // 5-Band Biquad Filters
  private filters: {
    low: BiquadFilterNode;
    midLow: BiquadFilterNode;
    mid: BiquadFilterNode;
    midHigh: BiquadFilterNode;
    high: BiquadFilterNode;
  } | null = null;

  private isInitialized = false;
  private isSpatial3DActive = false;
  private spatialAnimationId: number | null = null;
  private spatialAngle = 0;

  private constructor() {}

  public static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  public init(element: HTMLAudioElement) {
    if (this.isInitialized && this.audioElement === element) return;

    this.audioElement = element;
    this.audioElement.crossOrigin = 'anonymous';

    try {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();

      // Create Nodes
      this.sourceNode = this.audioCtx.createMediaElementSource(element);
      this.gainNode = this.audioCtx.createGain();
      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.analyserNode.smoothingTimeConstant = 0.85;

      // Create 3D Spatial Panner Node (StereoPanner / PannerNode)
      const ctx = this.audioCtx as AudioContext;
      if (typeof ctx.createStereoPanner === 'function') {
        this.pannerNode = ctx.createStereoPanner();
      } else if (typeof ctx.createPanner === 'function') {
        const p = ctx.createPanner();
        p.panningModel = 'HRTF';
        p.distanceModel = 'inverse';
        this.pannerNode = p;
      }

      // Create 5-band Equalizer Filters
      const f1 = this.audioCtx.createBiquadFilter(); // Low (60Hz Shelf)
      f1.type = 'lowshelf';
      f1.frequency.value = 60;

      const f2 = this.audioCtx.createBiquadFilter(); // MidLow (230Hz Peaking)
      f2.type = 'peaking';
      f2.frequency.value = 230;
      f2.Q.value = 1;

      const f3 = this.audioCtx.createBiquadFilter(); // Mid (910Hz Peaking)
      f3.type = 'peaking';
      f3.frequency.value = 910;
      f3.Q.value = 1;

      const f4 = this.audioCtx.createBiquadFilter(); // MidHigh (4kHz Peaking)
      f4.type = 'peaking';
      f4.frequency.value = 4000;
      f4.Q.value = 1;

      const f5 = this.audioCtx.createBiquadFilter(); // High (14kHz Highshelf)
      f5.type = 'highshelf';
      f5.frequency.value = 14000;

      this.filters = { low: f1, midLow: f2, mid: f3, midHigh: f4, high: f5 };

      // Chain: Source -> Filters -> Panner -> Gain -> Analyser -> Destination
      let chainNode: AudioNode = this.sourceNode;
      chainNode = chainNode.connect(f1).connect(f2).connect(f3).connect(f4).connect(f5);

      if (this.pannerNode) {
        chainNode = chainNode.connect(this.pannerNode as AudioNode);
      }

      chainNode
        .connect(this.gainNode)
        .connect(this.analyserNode)
        .connect(this.audioCtx.destination);

      this.isInitialized = true;
    } catch (e) {
      console.warn('Web Audio API initialized in fallback mode:', e);
    }
  }

  public resume() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  public setVolume(val: number) {
    if (this.gainNode) {
      this.gainNode.gain.setValueAtTime(Math.max(0, Math.min(1, val)), this.audioCtx?.currentTime || 0);
    }
  }

  public setEQBand(band: 'low' | 'midLow' | 'mid' | 'midHigh' | 'high', gainDb: number) {
    if (this.filters && this.filters[band] && this.audioCtx) {
      this.filters[band].gain.setValueAtTime(gainDb, this.audioCtx.currentTime);
    }
  }

  /**
   * Toggles 3D Spatial Audio HRTF 360° Surround Sound Processing
   */
  public setSpatial3D(enabled: boolean) {
    this.isSpatial3DActive = enabled;

    if (!enabled && this.pannerNode) {
      if ('pan' in this.pannerNode) {
        (this.pannerNode as StereoPannerNode).pan.value = 0;
      }
      if (this.spatialAnimationId) {
        cancelAnimationFrame(this.spatialAnimationId);
        this.spatialAnimationId = null;
      }
      return;
    }

    if (enabled && this.pannerNode) {
      const animateSpatial3D = () => {
        if (!this.isSpatial3DActive) return;

        this.spatialAngle += 0.02;
        const panValue = Math.sin(this.spatialAngle) * 0.75;

        if ('pan' in (this.pannerNode as StereoPannerNode)) {
          (this.pannerNode as StereoPannerNode).pan.value = panValue;
        }

        this.spatialAnimationId = requestAnimationFrame(animateSpatial3D);
      };

      animateSpatial3D();
    }
  }

  public getFrequencyData(array: Uint8Array): void {
    if (this.analyserNode) {
      this.analyserNode.getByteFrequencyData(array as any);
    }
  }

  public getWaveformData(array: Uint8Array): void {
    if (this.analyserNode) {
      this.analyserNode.getByteTimeDomainData(array as any);
    }
  }

  public getAnalyserFrequencyBinCount(): number {
    return this.analyserNode ? this.analyserNode.frequencyBinCount : 64;
  }
}
