export type AudioFocusResult = 
  | "GRANTED"
  | "DELAYED"
  | "DENIED"
  | "UNSUPPORTED";

export type AudioFocusEvent = 
  | { type: "GAIN" }
  | { type: "LOSS" }
  | { type: "LOSS_TRANSIENT" }
  | { type: "LOSS_DUCK" };

export interface AudioFocusAdapter {
  isSupported(): boolean;
  requestFocus(): Promise<AudioFocusResult>;
  releaseFocus(): void;
  subscribe(listener: (event: AudioFocusEvent) => void): () => void;
}
