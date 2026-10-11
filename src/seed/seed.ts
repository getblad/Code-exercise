import mongoose, { type Types } from 'mongoose';
import type { Logger } from 'pino';
import { hashPassword } from '../modules/auth/password';
import { BookModel } from '../modules/books/book.model';
import { computeRankScore } from '../modules/books/rank-score';
import { LibraryModel } from '../modules/libraries/library.model';
import { UserModel } from '../modules/users/user.model';
import { SEED_BOOKS, SEED_LIBRARIES, SEED_USERS } from './seed-data';

const SEED_ID = 'demo-data-v1';

interface SeedRun {
  _id: string;
  appliedAt: Date;
}

export async function seedDatabase(logger: Logger): Promise<void> {
  const seedRuns = mongoose.connection.collection<SeedRun>('seed_runs');
  if (await seedRuns.findOne({ _id: SEED_ID })) {
    logger.info({ seed: SEED_ID }, 'Seed data already applied');
    return;
  }

  const users = await Promise.all(
    SEED_USERS.map(async ({ password, ...user }) => ({
      ...user,
      passwordHash: await hashPassword(password),
    })),
  );
  const books = SEED_BOOKS.map((book) => ({
    ...book,
    rankScore: computeRankScore(book.pages, book.publishedDate),
  }));

  const [libraryResult, userResult, bookResult] = await Promise.all([
    LibraryModel.bulkWrite(SEED_LIBRARIES.map(insertIfMissing)),
    UserModel.bulkWrite(users.map(insertIfMissing)),
    BookModel.bulkWrite(books.map(insertIfMissing)),
  ]);
  await seedRuns.updateOne(
    { _id: SEED_ID },
    { $setOnInsert: { appliedAt: new Date() } },
    { upsert: true },
  );

  logger.info(
    {
      seed: SEED_ID,
      inserted: {
        libraries: libraryResult.upsertedCount,
        users: userResult.upsertedCount,
        books: bookResult.upsertedCount,
      },
    },
    'Seed data applied',
  );
}

function insertIfMissing<T extends { _id: Types.ObjectId }>({ _id, ...fields }: T) {
  return { updateOne: { filter: { _id }, update: { $setOnInsert: fields }, upsert: true } };
}
