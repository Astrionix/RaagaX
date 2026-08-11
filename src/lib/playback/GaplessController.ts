export class GaplessController {
  private static instance: GaplessController;

  private constructor() {}

  public static getInstance(): GaplessController {
    if (!GaplessController.instance) {
      GaplessController.instance = new GaplessController();
    }
    return GaplessController.instance;
  }

  public handleBoundary(activeAudio: HTMLAudioElement, standbyAudio: HTMLAudioElement) {
    // Synchronous cutover
    activeAudio.pause();
    activeAudio.currentTime = 0;
    
    standbyAudio.volume = 1.0;
    standbyAudio.play().catch(e => {
      console.warn('Gapless transition play failed:', e);
    });
  }
}
