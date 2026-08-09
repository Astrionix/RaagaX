export class AudioEngine {
  private static instance: AudioEngine;
  private audioCtx: AudioContext | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private pannerNode: StereoPannerNode | PannerNode | null = null;

  private isInitialized = false;

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

      // Chain: Source -> Gain -> Analyser -> Destination
      this.sourceNode
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
