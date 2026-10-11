import type { Types } from 'mongoose';
import type { Logger } from 'pino';
import { hashPassword } from '../modules/auth/password';
import { BookModel } from '../modules/books/book.model';
import { computeRankScore } from '../modules/books/rank-score';
import { LibraryModel } from '../modules/libraries/library.model';
import { UserModel } from '../modules/users/user.model';
import { SEED_BOOKS, SEED_LIBRARIES, SEED_USERS } from './seed-data';

export async function seedDatabase(logger: Logger): Promise<void> {
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

  logger.info(
    {
      inserted: {
        libraries: libraryResult.upsertedCount,
        users: userResult.upsertedCount,
        books: bookResult.upsertedCount,
      },
    },
    'Seed data ensured',
  );
}

function insertIfMissing<T extends { _id: Types.ObjectId }>({ _id, ...fields }: T) {
  return { updateOne: { filter: { _id }, update: { $setOnInsert: fields }, upsert: true } };
}
