import type { mongo } from 'mongoose';
import { BookModel } from '../modules/books/book.model';
import { computeRankScore } from '../modules/books/rank-score';
import { runMongoScript } from './run-script';

const BATCH_SIZE = 5_000;

runMongoScript('recompute-rank-scores', async (logger) => {
  const startedAt = Date.now();
  let updated = 0;
  let batch: mongo.AnyBulkWriteOperation[] = [];

  const flush = async (): Promise<void> => {
    if (batch.length === 0) return;
    await BookModel.collection.bulkWrite(batch, { ordered: false });
    updated += batch.length;
    batch = [];
  };

  const books = BookModel.find({}, { pages: 1, publishedDate: 1 }).lean().cursor();
  for await (const { _id, pages, publishedDate } of books) {
    const rankScore = computeRankScore(pages, publishedDate);
    batch.push({ updateOne: { filter: { _id }, update: { $set: { rankScore } } } });
    if (batch.length === BATCH_SIZE) await flush();
  }
  await flush();

  logger.info({ updated, seconds: (Date.now() - startedAt) / 1000 }, 'Rank scores recomputed');
});
