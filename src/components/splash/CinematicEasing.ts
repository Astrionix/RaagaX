/**
 * RaagaX Cinematic Easing & Spring Physics Engine
 * Ultra-smooth, weighted easing functions and second-order dynamics.
 */

export const Easing = {
  // Cubic & Quintic
  easeOutCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  easeInOutCubic: (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  easeOutQuint: (t: number) => 1 - Math.pow(1 - t, 5),
  easeInOutQuint: (t: number) => t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2,
  
  // Exponential
  easeOutExpo: (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  
  // Overshoot back-easing with subtle weighted settle
  easeOutBack: (t: number, overshoot = 1.15) => {
    const c1 = overshoot;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },

  // Hermite smoothstep curves
  smoothstep: (min: number, max: number, value: number) => {
    const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
    return x * x * (3 - 2 * x);
  },

  smootherstep: (min: number, max: number, value: number) => {
    const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
    return x * x * x * (x * (x * 6 - 15) + 10);
  }
};

export class Spring {
  public value: number;
  public target: number;
  public velocity: number = 0;
  public stiffness: number;
  public damping: number;

  constructor(initial: number, stiffness = 120, damping = 14) {
    this.value = initial;
    this.target = initial;
    this.stiffness = stiffness;
    this.damping = damping;
  }

  public setTarget(target: number) {
    this.target = target;
  }

  public update(delta: number): number {
    const clampedDelta = Math.min(delta, 0.05);
    const force = (this.target - this.value) * this.stiffness;
    const dampingForce = -this.velocity * this.damping;
    const acceleration = force + dampingForce;

    this.velocity += acceleration * clampedDelta;
    this.value += this.velocity * clampedDelta;
    return this.value;
  }
}
