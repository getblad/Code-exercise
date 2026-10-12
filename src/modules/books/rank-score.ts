const PAGES_WEIGHT = 0.8;
const AGE_WEIGHT = 0.2;
const PAGES_CAP = 2000;
const AGE_SPAN_MS = 500 * 365.25 * 24 * 60 * 60 * 1000;
const OLDEST_SCORED_DATE_MS = Date.UTC(1500, 0, 1);

// Age counts from the epoch, not from now: every book shifts equally over time, so the order is stable and indexable
export function computeRankScore(pages: number, publishedDate: Date): number {
  const pagesScore = Math.min(pages, PAGES_CAP) / PAGES_CAP;
  const ageScore = -Math.max(publishedDate.getTime(), OLDEST_SCORED_DATE_MS) / AGE_SPAN_MS;
  return PAGES_WEIGHT * pagesScore + AGE_WEIGHT * ageScore;
}
