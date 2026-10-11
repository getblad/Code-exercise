import type { mongo } from 'mongoose';
import { BookModel } from '../modules/books/book.model';
import { computeRankScore } from '../modules/books/rank-score';
import { runMongoScript } from './run-script';

const BATCH_SIZE = 5_000;

runMongoScript('recompute-rank-scores', async (logger) => {
  const startedAt = Date.now();
  let matched = 0;
  let changedMeanwhile = 0;
  let batch: mongo.AnyBulkWriteOperation[] = [];

  const flush = async (): Promise<void> => {
    if (batch.length === 0) return;
    const result = await BookModel.collection.bulkWrite(batch, { ordered: false });
    matched += result.matchedCount;
    changedMeanwhile += batch.length - result.matchedCount;
    batch = [];
  };

  const books = BookModel.find({}, { pages: 1, publishedDate: 1 }).lean().cursor();
  for await (const { _id, pages, publishedDate } of books) {
    const rankScore = computeRankScore(pages, publishedDate);
    // Matching on the values read skips books edited since, whose write already stored a fresh score
    batch.push({
      updateOne: { filter: { _id, pages, publishedDate }, update: { $set: { rankScore } } },
    });
    if (batch.length === BATCH_SIZE) await flush();
  }
  await flush();

  logger.info(
    { matched, changedMeanwhile, seconds: (Date.now() - startedAt) / 1000 },
    'Rank scores recomputed',
  );
});
