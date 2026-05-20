'use client';

import { animate, createTimeline, svg, type JSAnimation } from 'animejs';
import { useEffect, useRef, type RefObject } from 'react';
import {
  buildHeroAmbientPulseConfig,
  buildHeroFlowLineConfig,
  randomBetween,
  randomFloatBetween,
} from '@/components/marketing/hero-flow-random';

const AMBIENT_SCHEDULE_MIN_MS = 900;
const AMBIENT_SCHEDULE_MAX_MS = 2800;

type UseHeroSvgFlowParams = {
  readonly svgRef: RefObject<SVGSVGElement | null>;
  readonly isBoosted: boolean;
  readonly isActive: boolean;
};

type FlowAnimationResult = JSAnimation | readonly JSAnimation[];

function collectAnimations(result: FlowAnimationResult): JSAnimation[] {
  if (Array.isArray(result)) {
    return Array.from(result) as JSAnimation[];
  }
  return [result as JSAnimation];
}

function executePauseAnimations(animations: readonly JSAnimation[]): void {
  animations.forEach((animation) => {
    animation.pause();
  });
}

/**
 * Organic SVG motion: each line/path loops on its own random cadence; ambient node/arc pulses fill quiet gaps.
 */
export function useHeroSvgFlow(params: UseHeroSvgFlowParams): void {
  const { svgRef, isBoosted, isActive } = params;
  const flowAnimationsRef = useRef<readonly JSAnimation[]>([]);
  const ambientAnimationsRef = useRef<readonly JSAnimation[]>([]);
  const pulseTimelineRef = useRef<ReturnType<typeof createTimeline> | null>(null);
  const ambientTimerRef = useRef<number | null>(null);
  useEffect(() => {
    const root = svgRef.current;
    executePauseAnimations(flowAnimationsRef.current);
    flowAnimationsRef.current = [];
    if (root === null || !isActive) {
      return;
    }
    const flowLines = root.querySelectorAll<SVGGeometryElement>('.marketing-hero-flow-line');
    const flowPaths = root.querySelectorAll<SVGGeometryElement>('.marketing-hero-flow-path');
    const flowArcs = root.querySelectorAll<SVGGeometryElement>('.marketing-hero-flow-arc');
    const lineTargets = [...flowLines, ...flowPaths, ...flowArcs];
    const spawned: JSAnimation[] = [];
    lineTargets.forEach((target) => {
      const config = buildHeroFlowLineConfig();
      const drawable = svg.createDrawable(target);
      const drawKeyframes = config.drawForward ? ['0 0', '0 1'] : ['0 1', '0 0'];
      const animation = animate(drawable, {
        draw: drawKeyframes,
        ease: 'linear',
        duration: config.durationMs,
        delay: config.delayMs,
        loopDelay: config.loopDelayMs,
        loop: true,
        alternate: config.useAlternate,
      });
      spawned.push(...collectAnimations(animation));
    });
    flowAnimationsRef.current = spawned;
    return () => {
      executePauseAnimations(flowAnimationsRef.current);
      flowAnimationsRef.current = [];
      lineTargets.forEach((line) => {
        line.style.opacity = '';
      });
    };
  }, [svgRef, isActive]);
  useEffect(() => {
    const root = svgRef.current;
    executePauseAnimations(ambientAnimationsRef.current);
    ambientAnimationsRef.current = [];
    if (ambientTimerRef.current !== null) {
      window.clearTimeout(ambientTimerRef.current);
      ambientTimerRef.current = null;
    }
    if (root === null || !isActive) {
      return;
    }
    const satelliteNodes = [...root.querySelectorAll<SVGCircleElement>('.marketing-hero-satellite-node')];
    const flowArcs = [...root.querySelectorAll<SVGGeometryElement>('.marketing-hero-flow-arc')];
    const ambientTargets = [...satelliteNodes, ...flowArcs];
    if (ambientTargets.length === 0) {
      return;
    }
    const executeRunAmbientPulse = (): void => {
      const batchSize = randomBetween(1, Math.min(3, ambientTargets.length));
      const shuffled = [...ambientTargets].sort(() => Math.random() - 0.5);
      const batch = shuffled.slice(0, batchSize);
      batch.forEach((target) => {
        const config = buildHeroAmbientPulseConfig();
        const baseOpacity = target instanceof SVGCircleElement ? 0.82 : 0.5;
        const animation = animate(target, {
          opacity: [baseOpacity, config.peakOpacity, baseOpacity],
          duration: config.durationMs,
          delay: config.delayMs,
          loop: false,
          ease: 'inOutSine',
        });
        ambientAnimationsRef.current = [
          ...ambientAnimationsRef.current,
          ...collectAnimations(animation),
        ];
      });
    };
    const executeScheduleAmbient = (): void => {
      executeRunAmbientPulse();
      const nextDelay = randomBetween(AMBIENT_SCHEDULE_MIN_MS, AMBIENT_SCHEDULE_MAX_MS);
      ambientTimerRef.current = window.setTimeout(executeScheduleAmbient, nextDelay);
    };
    executeScheduleAmbient();
    return () => {
      if (ambientTimerRef.current !== null) {
        window.clearTimeout(ambientTimerRef.current);
        ambientTimerRef.current = null;
      }
      executePauseAnimations(ambientAnimationsRef.current);
      ambientAnimationsRef.current = [];
      ambientTargets.forEach((target) => {
        target.style.opacity = '';
      });
    };
  }, [svgRef, isActive]);
  useEffect(() => {
    const root = svgRef.current;
    pulseTimelineRef.current?.pause();
    pulseTimelineRef.current = null;
    if (root === null || !isActive || !isBoosted) {
      return;
    }
    const hubNode = root.querySelector<SVGCircleElement>('.marketing-hero-hub-node');
    const satelliteNodes = root.querySelectorAll<SVGCircleElement>('.marketing-hero-satellite-node');
    const timeline = createTimeline({
      loop: true,
      defaults: { ease: 'inOutSine' },
    });
    if (hubNode !== null) {
      const hubRadius = Number(hubNode.getAttribute('r') ?? 11);
      timeline.add(
        hubNode,
        {
          r: [hubRadius, hubRadius * randomFloatBetween(1.08, 1.16), hubRadius],
          duration: randomBetween(1800, 2600),
        },
        0,
      );
    }
    satelliteNodes.forEach((node, index) => {
      timeline.add(
        node,
        {
          opacity: [0.78, randomFloatBetween(0.92, 1), 0.78],
          duration: randomBetween(1500, 2400),
          delay: randomBetween(0, 700) + index * 40,
        },
        0,
      );
    });
    pulseTimelineRef.current = timeline;
    return () => {
      timeline.pause();
      pulseTimelineRef.current = null;
      if (hubNode !== null) {
        hubNode.removeAttribute('style');
      }
      satelliteNodes.forEach((node) => {
        node.style.opacity = '';
      });
    };
  }, [svgRef, isActive, isBoosted]);
}
