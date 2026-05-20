/** Inclusive random integer between min and max. */
export function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Random float between min and max. */
export function randomFloatBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export type HeroFlowLineConfig = {
  readonly durationMs: number;
  readonly delayMs: number;
  readonly loopDelayMs: number;
  readonly drawForward: boolean;
  readonly useAlternate: boolean;
};

export function buildHeroFlowLineConfig(): HeroFlowLineConfig {
  return {
    durationMs: randomBetween(1600, 4800),
    delayMs: randomBetween(0, 3200),
    loopDelayMs: randomBetween(120, 2200),
    drawForward: Math.random() > 0.4,
    useAlternate: Math.random() > 0.25,
  };
}

export type HeroAmbientPulseConfig = {
  readonly durationMs: number;
  readonly delayMs: number;
  readonly loopDelayMs: number;
  readonly peakOpacity: number;
};

export function buildHeroAmbientPulseConfig(): HeroAmbientPulseConfig {
  return {
    durationMs: randomBetween(1400, 3600),
    delayMs: randomBetween(0, 5000),
    loopDelayMs: randomBetween(400, 4000),
    peakOpacity: randomFloatBetween(0.88, 1),
  };
}
