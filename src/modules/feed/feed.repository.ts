import { BookModel } from '../books/book.model';
import { toBookRecord } from '../books/book.repository';
import type { RankedBook, RankedBookSource, RankedBooksQuery } from './feed.types';

const SAME_COUNTRY_INDEX = 'feed_country_rank';
const OTHER_COUNTRIES_INDEX = 'feed_rank';

export class FeedRepository implements RankedBookSource {
  async findRanked(query: RankedBooksQuery): Promise<RankedBook[]> {
    const books = await rankedBooksQuery(query).lean();
    return books.map((book) => ({ ...toBookRecord(book), rankScore: book.rankScore }));
  }
}

export function rankedBooksQuery({
  libraryIds,
  country,
  sameCountry,
  after,
  limit,
}: RankedBooksQuery) {
  return (
    BookModel.find({
      library: { $in: libraryIds },
      authorCountry: sameCountry ? country : { $ne: country },
      ...(after === undefined
        ? {}
        : {
            rankScore: { $lte: after.score },
            $or: [{ rankScore: { $lt: after.score } }, { _id: { $lt: after.id } }],
          }),
    })
      .sort({ rankScore: -1, _id: -1 })
      .limit(limit)
      // Each phase has an index whose equality prefix lets MongoDB merge per-library scans already in rank order
      .hint(sameCountry ? SAME_COUNTRY_INDEX : OTHER_COUNTRIES_INDEX)
  );
}
