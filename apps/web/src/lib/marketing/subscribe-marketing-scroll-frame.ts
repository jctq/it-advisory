type MarketingScrollFrameCallback = () => void;

const callbacks = new Set<MarketingScrollFrameCallback>();
let frameId = 0;
let isListening = false;

function executeFlushScrollFrame(): void {
  callbacks.forEach((callback) => {
    callback();
  });
}

function executeScheduleScrollFrame(): void {
  cancelAnimationFrame(frameId);
  frameId = requestAnimationFrame(executeFlushScrollFrame);
}

function executeStartListening(): void {
  if (isListening) {
    return;
  }
  isListening = true;
  window.addEventListener('scroll', executeScheduleScrollFrame, { passive: true });
  window.addEventListener('resize', executeScheduleScrollFrame, { passive: true });
}

function executeStopListening(): void {
  if (!isListening) {
    return;
  }
  isListening = false;
  cancelAnimationFrame(frameId);
  window.removeEventListener('scroll', executeScheduleScrollFrame);
  window.removeEventListener('resize', executeScheduleScrollFrame);
}

/**
 * Coalesces scroll/resize-driven work into a single animation frame per tick.
 */
export function subscribeMarketingScrollFrame(callback: MarketingScrollFrameCallback): () => void {
  callbacks.add(callback);
  executeStartListening();
  executeScheduleScrollFrame();
  return () => {
    callbacks.delete(callback);
    if (callbacks.size === 0) {
      executeStopListening();
    }
  };
}
