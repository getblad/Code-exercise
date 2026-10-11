import assert from 'node:assert/strict';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import mongoose, { Types } from 'mongoose';
import { z } from 'zod';
import type { Principal } from '../../src/modules/auth/principal';
import { type Book, BookModel } from '../../src/modules/books/book.model';
import { BookRepository } from '../../src/modules/books/book.repository';
import { computeRankScore } from '../../src/modules/books/rank-score';
import { FeedRepository } from '../../src/modules/feed/feed.repository';
import { type FeedPosition, FeedService } from '../../src/modules/feed/feed.service';
import { UserModel } from '../../src/modules/users/user.model';
import { UserRepository } from '../../src/modules/users/user.repository';

const MONGO_VERSION = '8.0.32';
const MEMBER_LIBRARY = new Types.ObjectId();
const SECOND_MEMBER_LIBRARY = new Types.ObjectId();
const FOREIGN_LIBRARY = new Types.ObjectId();
const MEMBER_LIBRARY_IDS = [MEMBER_LIBRARY.toString(), SECOND_MEMBER_LIBRARY.toString()];
const COUNTRIES = ['US', 'GB', 'FR', 'DE', 'ES', 'IT', 'JP', 'BR', 'IN', null];

type BookDocument = Book & { _id: Types.ObjectId };

const explainSchema = z.object({
  queryPlanner: z.object({ winningPlan: z.unknown() }),
  executionStats: z.object({
    nReturned: z.number(),
    totalKeysExamined: z.number(),
    totalDocsExamined: z.number(),
  }),
});

function makeBook(
  library: Types.ObjectId,
  authorCountry: string | null,
  pages: number,
  year: number,
): BookDocument {
  const publishedDate = new Date(Date.UTC(year, 0, 1));
  return {
    _id: new Types.ObjectId(),
    title: 'Generated',
    author: 'Author',
    authorCountry,
    publishedDate,
    pages,
    library,
    rankScore: computeRankScore(pages, publishedDate),
  };
}

function pick<T>(items: readonly T[], index: number): T {
  const item = items[index % items.length];
  if (item === undefined) throw new Error('Cannot pick from an empty list');
  return item;
}

function planStages(plan: unknown): string[] {
  if (typeof plan !== 'object' || plan === null) return [];
  const own = 'stage' in plan && typeof plan.stage === 'string' ? [plan.stage] : [];
  return [...own, ...Object.values(plan).flatMap(planStages)];
}

describe('MongoDB integration', () => {
  let server: MongoMemoryServer | undefined;

  before(async () => {
    const externalUri = process.env.MONGO_TEST_URI;
    if (externalUri === undefined) {
      server = await MongoMemoryServer.create({ binary: { version: MONGO_VERSION } });
    }
    await mongoose.connect(externalUri ?? server?.getUri() ?? '', {
      dbName: `books_test_${Date.now().toString()}`,
    });
    await Promise.all([BookModel.init(), UserModel.init()]);
  });

  after(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    await server?.stop();
  });

  beforeEach(async () => {
    await Promise.all([BookModel.deleteMany({}), UserModel.deleteMany({})]);
  });

  it('scopes every book operation to the given libraries', async () => {
    const books = new BookRepository();
    const data = {
      title: 'Scoped',
      author: 'Author',
      authorCountry: null,
      publishedDate: new Date('1900-01-01'),
      pages: 10,
      libraryId: FOREIGN_LIBRARY.toString(),
      rankScore: computeRankScore(10, new Date('1900-01-01')),
    };
    const created = await books.create(data);
    const member = [FOREIGN_LIBRARY.toString()];

    assert.equal(await books.findById(created.id, MEMBER_LIBRARY_IDS), null);
    assert.deepEqual(await books.findById(created.id, member), created);
    assert.equal(await books.replace(created.id, MEMBER_LIBRARY_IDS, { ...data, pages: 99 }), null);
    assert.equal((await books.replace(created.id, member, { ...data, pages: 99 }))?.pages, 99);
    assert.equal(await books.delete(created.id, MEMBER_LIBRARY_IDS), false);
    assert.equal(await books.delete(created.id, member), true);
  });

  it('lists the newest books first and continues after a cursor', async () => {
    const docs = [1, 2, 3, 4, 5].map((pages) => makeBook(MEMBER_LIBRARY, 'US', pages, 1900));
    await BookModel.insertMany([...docs, makeBook(FOREIGN_LIBRARY, 'US', 6, 1900)]);
    const books = new BookRepository();
    const newestFirst = docs.map(({ _id }) => _id.toString()).toReversed();

    const firstPage = await books.list({
      libraryIds: MEMBER_LIBRARY_IDS,
      afterId: undefined,
      limit: 2,
    });
    const secondPage = await books.list({
      libraryIds: MEMBER_LIBRARY_IDS,
      afterId: firstPage.at(-1)?.id,
      limit: 10,
    });

    assert.deepEqual(
      [...firstPage, ...secondPage].map(({ id }) => id),
      newestFirst,
    );
  });

  it('pages the feed in exactly the brute-force order, across phases and ties', async () => {
    const libraries = [MEMBER_LIBRARY, SECOND_MEMBER_LIBRARY, FOREIGN_LIBRARY];
    const varied = Array.from({ length: 60 }, (_, index) =>
      makeBook(
        pick(libraries, index),
        pick(COUNTRIES, index * 7),
        50 + ((index * 37) % 900),
        1700 + ((index * 13) % 300),
      ),
    );
    const tiedSameCountry = Array.from({ length: 10 }, () =>
      makeBook(MEMBER_LIBRARY, 'US', 400, 1900),
    );
    const docs = [...varied, ...tiedSameCountry];
    await BookModel.insertMany(docs);
    const principal: Principal = {
      userId: new Types.ObjectId().toString(),
      role: 'user',
      country: 'US',
      libraryIds: MEMBER_LIBRARY_IDS,
    };
    const feed = new FeedService(new FeedRepository());

    const seen: string[] = [];
    let after: FeedPosition | undefined;
    do {
      const page = await feed.getFeed(principal, after, 7);
      seen.push(...page.items.map(({ id }) => id));
      after = page.next;
    } while (after !== undefined);

    const expected = docs
      .filter(({ library }) => !library.equals(FOREIGN_LIBRARY))
      .toSorted(
        (a, b) =>
          Number(b.authorCountry === 'US') - Number(a.authorCountry === 'US') ||
          b.rankScore - a.rankScore ||
          b._id.toString().localeCompare(a._id.toString()),
      )
      .map(({ _id }) => _id.toString());
    assert.deepEqual(seen, expected);
  });

  it('serves both feed phases in index order without an in-memory sort', async () => {
    const docs = Array.from({ length: 2000 }, (_, index) =>
      makeBook(
        pick([MEMBER_LIBRARY, SECOND_MEMBER_LIBRARY], index),
        pick(COUNTRIES, index),
        50 + ((index * 37) % 1500),
        1600 + ((index * 13) % 420),
      ),
    );
    await BookModel.insertMany(docs);
    const feed = new FeedRepository();
    const limit = 21;
    const middle = docs.toSorted((a, b) => b.rankScore - a.rankScore)[1000];
    const cursors = [undefined, middle && { score: middle.rankScore, id: middle._id.toString() }];

    for (const sameCountry of [true, false]) {
      for (const after of cursors) {
        const query = { libraryIds: MEMBER_LIBRARY_IDS, country: 'US', sameCountry, after, limit };
        const explanation: unknown = await feed.rankedQuery(query).explain('executionStats');
        const { queryPlanner, executionStats } = explainSchema.parse(explanation);
        const context = JSON.stringify({
          sameCountry,
          cursor: after !== undefined,
          executionStats,
        });

        assert.ok(!planStages(queryPlanner.winningPlan).includes('SORT'), context);
        // The book at the cursor position lies inside the index range and is dropped only after it is fetched
        assert.ok(executionStats.totalDocsExamined <= executionStats.nReturned + 1, context);
        assert.ok(executionStats.totalKeysExamined < limit * 3, context);
      }
    }
  });

  it('loads credentials by username and profiles by id', async () => {
    const user = await UserModel.create({
      username: 'reader',
      country: 'GB',
      libraries: [MEMBER_LIBRARY],
      role: 'user',
      passwordHash: 'scrypt$salt$key',
    });
    const users = new UserRepository();

    assert.deepEqual(await users.findCredentialsByUsername('reader'), {
      id: user._id.toString(),
      role: 'user',
      passwordHash: 'scrypt$salt$key',
    });
    assert.equal(await users.findCredentialsByUsername('nobody'), null);
    assert.deepEqual(await users.findProfileById(user._id.toString()), {
      id: user._id.toString(),
      role: 'user',
      country: 'GB',
      libraryIds: [MEMBER_LIBRARY.toString()],
    });
  });
});
