/** Scrolls the document to the top after the next paint (e.g. after step content swaps). */
export function scheduleScrollPageToTop(): void {
  requestAnimationFrame(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}
