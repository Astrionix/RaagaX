/**
 * WebAudioGraph — intentionally disabled.
 *
 * saavncdn.com does not send CORS headers, so createMediaElementSource()
 * causes the browser to output silence ("MediaElementAudioSource outputs zeroes
 * due to CORS access restrictions").
 *
 * Audio elements play fine without being routed through the Web Audio API.
 * Volume and mute are controlled directly on the HTMLAudioElement.
 * This class is kept as a stub so existing imports don't break.
 */
export class WebAudioGraph {
  private static instance: WebAudioGraph;
  public context: AudioContext | null = null;
  public gainA: GainNode | null = null;
  public gainB: GainNode | null = null;

  private constructor() {}

  public static getInstance(): WebAudioGraph {
    if (!WebAudioGraph.instance) {
      WebAudioGraph.instance = new WebAudioGraph();
    }
    return WebAudioGraph.instance;
  }

  // No-op: do NOT call createMediaElementSource — it breaks CORS audio
  public init(_audioA: HTMLAudioElement, _audioB: HTMLAudioElement) {
    // Intentionally empty — audio plays directly through HTMLAudioElement
  }

  public resume() {
    // No-op
  }
}
