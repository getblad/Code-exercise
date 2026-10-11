import assert from 'node:assert/strict';
import sinon from 'sinon';
import request from 'supertest';
import { z } from 'zod';
import type { BookRecord } from '../src/modules/books/book.types';
import { computeRankScore } from '../src/modules/books/rank-score';
import { ADMIN, buildTestApp, FOREIGN_LIBRARY_ID } from './helpers/test-app';

const CENTRAL_LIBRARY_ID = '64a000000000000000000001';
const BOOK_ID = '64c000000000000000000001';
const PUBLISHED = new Date('1851-10-18');

const input = {
  title: 'Moby-Dick',
  author: 'Herman Melville',
  authorCountry: 'us',
  publishedDate: '1851-10-18',
  pages: 635,
  libraryId: CENTRAL_LIBRARY_ID,
};

const stored: BookRecord = {
  id: BOOK_ID,
  title: 'Moby-Dick',
  author: 'Herman Melville',
  authorCountry: 'US',
  publishedDate: PUBLISHED,
  pages: 635,
  libraryId: CENTRAL_LIBRARY_ID,
};

const response = { ...stored, publishedDate: '1851-10-18' };

const problem = z.object({
  status: z.number(),
  detail: z.string(),
  errors: z.array(z.object({ path: z.string() })).optional(),
});

const bookWithId = (id: string): BookRecord => ({ ...stored, id });

describe('POST /books', () => {
  it('creates a book in a member library and stores its rank score', async () => {
    const { app, books, authorize } = buildTestApp();
    books.create.resolves(stored);

    const res = await request(app)
      .post('/books')
      .set('Authorization', authorize(ADMIN))
      .send(input);

    assert.equal(res.status, 201);
    assert.equal(res.get('Location'), `books/${BOOK_ID}`);
    assert.deepEqual(res.body, response);
    assert.deepEqual(books.create.args, [
      [
        {
          ...input,
          authorCountry: 'US',
          publishedDate: PUBLISHED,
          rankScore: computeRankScore(635, PUBLISHED),
        },
      ],
    ]);
  });

  it('rejects invalid input with a field error for each problem', async () => {
    const { app, books, authorize } = buildTestApp();

    const res = await request(app).post('/books').set('Authorization', authorize(ADMIN)).send({
      title: '  ',
      author: 'X',
      authorCountry: 'ZZ',
      publishedDate: '2999-01-01',
      pages: 0,
      libraryId: 'x',
      isbn: '1',
    });

    assert.equal(res.status, 400);
    const paths = (problem.parse(res.body).errors ?? []).map(({ path }) => path).toSorted();
    assert.deepEqual(paths, ['', 'authorCountry', 'libraryId', 'pages', 'publishedDate', 'title']);
    assert.equal(books.create.callCount, 0);
  });

  it('forbids creating a book in a library the user does not belong to', async () => {
    const { app, books, authorize } = buildTestApp();

    const res = await request(app)
      .post('/books')
      .set('Authorization', authorize(ADMIN))
      .send({ ...input, libraryId: FOREIGN_LIBRARY_ID });

    assert.equal(res.status, 403);
    assert.equal(books.create.callCount, 0);
  });

  it('accepts a date that is already today somewhere on Earth and rejects the day after', async () => {
    const clock = sinon.useFakeTimers({ now: new Date('2026-10-11T12:00:00Z'), toFake: ['Date'] });
    try {
      const { app, books, authorize } = buildTestApp();
      const auth = authorize(ADMIN);
      books.create.resolves(stored);

      const todayInUtcPlus14 = await request(app)
        .post('/books')
        .set('Authorization', auth)
        .send({ ...input, publishedDate: '2026-10-12' });
      const tomorrowEverywhere = await request(app)
        .post('/books')
        .set('Authorization', auth)
        .send({ ...input, publishedDate: '2026-10-13' });

      assert.equal(todayInUtcPlus14.status, 201);
      assert.equal(tomorrowEverywhere.status, 400);
    } finally {
      clock.restore();
    }
  });

  it('returns a Location relative to the request path, with or without a trailing slash', async () => {
    const { app, books, authorize } = buildTestApp();
    const auth = authorize(ADMIN);
    books.create.resolves(stored);

    const plain = await request(app).post('/books').set('Authorization', auth).send(input);
    const slashed = await request(app).post('/books/').set('Authorization', auth).send(input);

    assert.equal(plain.get('Location'), `books/${BOOK_ID}`);
    assert.equal(slashed.get('Location'), BOOK_ID);
  });

  it('treats ids case-insensitively when checking membership', async () => {
    const { app, books, authorize } = buildTestApp();
    books.create.resolves(stored);

    const res = await request(app)
      .post('/books')
      .set('Authorization', authorize(ADMIN))
      .send({ ...input, libraryId: CENTRAL_LIBRARY_ID.toUpperCase() });

    assert.equal(res.status, 201);
    assert.equal(books.create.firstCall.args[0].libraryId, CENTRAL_LIBRARY_ID);
  });
});

describe('GET /books/:id', () => {
  it('returns a book from a member library and 404 for any other, scoping the lookup', async () => {
    const { app, books, authorize } = buildTestApp();
    const auth = authorize(ADMIN);
    books.findById.resolves(null);
    books.findById.withArgs(BOOK_ID, ADMIN.libraryIds).resolves(stored);

    const found = await request(app).get(`/books/${BOOK_ID}`).set('Authorization', auth);
    const missing = await request(app)
      .get('/books/64c0000000000000000000ff')
      .set('Authorization', auth);

    assert.equal(found.status, 200);
    assert.deepEqual(found.body, response);
    assert.equal(missing.status, 404);
    assert.equal(problem.parse(missing.body).detail, 'Book not found');
  });

  it('rejects a malformed id with 400', async () => {
    const { app, authorize } = buildTestApp();

    const res = await request(app).get('/books/not-an-id').set('Authorization', authorize(ADMIN));

    assert.equal(res.status, 400);
    assert.deepEqual(
      problem.parse(res.body).errors?.map(({ path }) => path),
      ['id'],
    );
  });
});

describe('GET /books', () => {
  it('pages through the member libraries with a Link header and cursor', async () => {
    const { app, books, authorize } = buildTestApp();
    const auth = authorize(ADMIN);
    const first = bookWithId('64c000000000000000000001');
    const second = bookWithId('64c000000000000000000002');
    const third = bookWithId('64c000000000000000000003');
    books.list.onFirstCall().resolves([third, second, first]);
    books.list.onSecondCall().resolves([first]);

    const firstPage = await request(app).get('/books?limit=2').set('Authorization', auth);
    const nextLink = /^<([^>]+)>; rel="next"$/.exec(firstPage.get('Link') ?? '')?.[1];
    const secondPage = await request(app)
      .get(`/books${nextLink ?? ''}`)
      .set('Authorization', auth);

    assert.equal(firstPage.status, 200);
    assert.deepEqual(
      z
        .array(z.object({ id: z.string() }))
        .parse(firstPage.body)
        .map(({ id }) => id),
      [third.id, second.id],
    );
    assert.equal(secondPage.status, 200);
    assert.equal(secondPage.get('Link'), undefined);
    assert.deepEqual(books.list.args, [
      [{ libraryIds: ADMIN.libraryIds, afterId: undefined, limit: 3 }],
      [{ libraryIds: ADMIN.libraryIds, afterId: second.id, limit: 3 }],
    ]);
  });

  it('rejects a foreign library filter with 403 and a tampered cursor with 400', async () => {
    const { app, books, authorize } = buildTestApp();
    const auth = authorize(ADMIN);

    const foreign = await request(app)
      .get(`/books?libraryId=${FOREIGN_LIBRARY_ID}`)
      .set('Authorization', auth);
    const tampered = await request(app).get('/books?cursor=garbage').set('Authorization', auth);

    assert.equal(foreign.status, 403);
    assert.equal(tampered.status, 400);
    assert.deepEqual(
      problem.parse(tampered.body).errors?.map(({ path }) => path),
      ['cursor'],
    );
    assert.equal(books.list.callCount, 0);
  });
});

describe('PUT /books/:id', () => {
  it('replaces a book and recomputes its rank score', async () => {
    const { app, books, authorize } = buildTestApp();
    books.replace.resolves({ ...stored, pages: 700 });

    const res = await request(app)
      .put(`/books/${BOOK_ID}`)
      .set('Authorization', authorize(ADMIN))
      .send({ ...input, pages: 700 });

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { ...response, pages: 700 });
    assert.deepEqual(books.replace.args, [
      [
        BOOK_ID,
        ADMIN.libraryIds,
        {
          ...input,
          authorCountry: 'US',
          publishedDate: PUBLISHED,
          pages: 700,
          rankScore: computeRankScore(700, PUBLISHED),
        },
      ],
    ]);
  });

  it('forbids moving a book into a library the user does not belong to', async () => {
    const { app, books, authorize } = buildTestApp();

    const res = await request(app)
      .put(`/books/${BOOK_ID}`)
      .set('Authorization', authorize(ADMIN))
      .send({ ...input, libraryId: FOREIGN_LIBRARY_ID });

    assert.equal(res.status, 403);
    assert.equal(books.replace.callCount, 0);
  });
});

describe('DELETE /books/:id', () => {
  it('deletes a book and answers 404 when it is not in the user libraries', async () => {
    const { app, books, authorize } = buildTestApp();
    const auth = authorize(ADMIN);
    books.delete.resolves(false);
    books.delete.withArgs(BOOK_ID, ADMIN.libraryIds).resolves(true);

    const deleted = await request(app).delete(`/books/${BOOK_ID}`).set('Authorization', auth);
    const missing = await request(app)
      .delete('/books/64c0000000000000000000ff')
      .set('Authorization', auth);

    assert.equal(deleted.status, 204);
    assert.equal(missing.status, 404);
  });
});
