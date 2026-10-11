import type { Principal } from '../auth/auth.types';
import type { BookRecord } from '../books/book.types';
import type { RankedBook, RankedBookSource, RankPosition } from './feed.types';

export type FeedPhase = 'same' | 'other';

export interface FeedPosition extends RankPosition {
  phase: FeedPhase;
}

export interface FeedPage {
  items: BookRecord[];
  next: FeedPosition | undefined;
}

export class FeedService {
  constructor(private readonly feed: RankedBookSource) {}

  async getFeed(
    principal: Principal,
    after: FeedPosition | undefined,
    limit: number,
  ): Promise<FeedPage> {
    const { libraryIds, country } = principal;
    if (libraryIds.length === 0) return { items: [], next: undefined };

    const fetch = (sameCountry: boolean, phase: FeedPhase, count: number) =>
      this.feed.findRanked({
        libraryIds,
        country,
        sameCountry,
        after: after?.phase === phase ? { score: after.score, id: after.id } : undefined,
        limit: count,
      });

    const sameCountry = after?.phase === 'other' ? [] : await fetch(true, 'same', limit + 1);
    const remaining = limit + 1 - sameCountry.length;
    const otherCountries = remaining > 0 ? await fetch(false, 'other', remaining) : [];

    const rows = [
      ...sameCountry.map((book) => ({ book, phase: 'same' as const })),
      ...otherCountries.map((book) => ({ book, phase: 'other' as const })),
    ];
    const page = rows.slice(0, limit);
    const last = page.at(-1);

    return {
      items: page.map(({ book }) => book),
      next: rows.length > limit && last ? positionOf(last.book, last.phase) : undefined,
    };
  }
}

function positionOf(book: RankedBook, phase: FeedPhase): FeedPosition {
  return { phase, score: book.rankScore, id: book.id };
}
