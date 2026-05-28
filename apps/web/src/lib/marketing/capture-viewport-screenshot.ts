import { toBlob } from 'html-to-image';

const MAX_CAPTURE_PIXEL_RATIO = 2;

/**
 * Captures only what is visible in the browser viewport (not the full scrollable page).
 */
export async function captureViewportScreenshotBlob(): Promise<Blob> {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const pixelRatio = Math.min(window.devicePixelRatio, MAX_CAPTURE_PIXEL_RATIO);
  const blob = await toBlob(document.documentElement, {
    cacheBust: true,
    width: viewportWidth,
    height: viewportHeight,
    canvasWidth: Math.round(viewportWidth * pixelRatio),
    canvasHeight: Math.round(viewportHeight * pixelRatio),
    pixelRatio: 1,
    skipFonts: false,
    style: {
      transform: `translate(-${scrollX}px, -${scrollY}px)`,
      transformOrigin: 'top left',
    },
  });
  if (blob === null) {
    throw new Error('Screenshot capture returned empty data.');
  }
  return blob;
}
