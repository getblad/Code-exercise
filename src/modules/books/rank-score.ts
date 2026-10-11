const PAGES_WEIGHT = 0.8;
const AGE_WEIGHT = 0.2;
const PAGES_CAP = 2000;
const AGE_SPAN_MS = 100 * 365.25 * 24 * 60 * 60 * 1000;

// Age is measured from a fixed point (the epoch) instead of "now": every book shifts by the same
// amount as time passes, so the ranking order never changes and the score can be stored and indexed.
export function computeRankScore(pages: number, publishedDate: Date): number {
  const pagesScore = Math.min(pages, PAGES_CAP) / PAGES_CAP;
  const ageScore = -publishedDate.getTime() / AGE_SPAN_MS;
  return PAGES_WEIGHT * pagesScore + AGE_WEIGHT * ageScore;
}
