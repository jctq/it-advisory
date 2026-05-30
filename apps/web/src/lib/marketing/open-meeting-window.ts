const MEETING_POPUP_WIDTH = 1200;
const MEETING_POPUP_HEIGHT = 800;
const MEETING_POPUP_NAME = 'techmd-meeting';

/**
 * Opens a video meeting in a centered popup so users stay anchored to TeqMD while the call runs.
 */
export function openMeetingWindow(meetingUrl: string): Window | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const trimmed = meetingUrl.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - MEETING_POPUP_WIDTH) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - MEETING_POPUP_HEIGHT) / 2));
  const features = [
    `width=${String(MEETING_POPUP_WIDTH)}`,
    `height=${String(MEETING_POPUP_HEIGHT)}`,
    `left=${String(left)}`,
    `top=${String(top)}`,
    'resizable=yes',
    'scrollbars=yes',
  ].join(',');
  return window.open(trimmed, MEETING_POPUP_NAME, features);
}
