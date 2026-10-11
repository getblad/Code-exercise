import { parseArgs } from 'node:util';
import mongoose, { type Types } from 'mongoose';
import { z } from 'zod';
import { createLogger } from '../infrastructure/logger';
import { BookModel } from '../modules/books/book.model';
import { computeRankScore } from '../modules/books/rank-score';
import { LIBRARY_IDS } from './seed-data';

const COUNTRIES = ['US', 'GB', 'DE', 'FR', 'ES', 'IT', 'JP', 'BR', 'IN', null];
const PROGRESS_EVERY = 100_000;
const logger = createLogger('info');

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      count: { type: 'string', default: '1000000' },
      batch: { type: 'string', default: '10000' },
    },
  });
  const count = z.coerce.number().int().positive().parse(values.count);
  const batchSize = z.coerce.number().int().positive().parse(values.batch);
  const uri = z
    .string()
    .regex(/^mongodb(\+srv)?:\/\//)
    .parse(process.env.MONGO_URI);

  await mongoose.connect(uri);
  await BookModel.init();
  const libraries = Object.values(LIBRARY_IDS);
  const startedAt = Date.now();

  for (let inserted = 0; inserted < count; inserted += batchSize) {
    const size = Math.min(batchSize, count - inserted);
    const books = Array.from({ length: size }, (_, offset) =>
      randomBook(inserted + offset, libraries),
    );
    await BookModel.collection.insertMany(books, { ordered: false });
    if ((inserted + size) % PROGRESS_EVERY === 0)
      logger.info({ inserted: inserted + size }, 'Bulk insert progress');
  }

  const seconds = (Date.now() - startedAt) / 1000;
  logger.info({ count, seconds, perSecond: Math.round(count / seconds) }, 'Bulk insert complete');
  await mongoose.disconnect();
}

function randomBook(sequence: number, libraries: readonly Types.ObjectId[]) {
  const pages = 50 + Math.floor(Math.random() * 1450);
  const publishedDate = new Date(
    Date.UTC(
      1600 + Math.floor(Math.random() * 425),
      Math.floor(Math.random() * 12),
      1 + Math.floor(Math.random() * 28),
    ),
  );
  return {
    title: `Generated book ${sequence.toString()}`,
    author: `Author ${(sequence % 10_000).toString()}`,
    authorCountry: pick(COUNTRIES, sequence),
    publishedDate,
    pages,
    library: pick(libraries, sequence),
    rankScore: computeRankScore(pages, publishedDate),
  };
}

function pick<T>(items: readonly T[], index: number): T {
  const item = items[index % items.length];
  if (item === undefined) throw new Error('Cannot pick from an empty list');
  return item;
}

main().catch((err: unknown) => {
  logger.fatal({ err }, 'Bulk insert failed');
  process.exitCode = 1;
});
