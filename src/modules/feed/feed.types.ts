import type { BookRecord } from '../books/book.types';

export interface RankedBook extends BookRecord {
  rankScore: number;
}

export interface RankPosition {
  score: number;
  id: string;
}

export interface RankedBooksQuery {
  libraryIds: string[];
  country: string;
  sameCountry: boolean;
  after: RankPosition | undefined;
  limit: number;
}

export interface RankedBookSource {
  findRanked(query: RankedBooksQuery): Promise<RankedBook[]>;
}
