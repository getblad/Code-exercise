import assert from 'node:assert/strict';
import request from 'supertest';
import { z } from 'zod';
import { encodeCursor } from '../src/http/pagination';
import { computeRankScore } from '../src/modules/books/rank-score';
import type { RankedBook } from '../src/modules/feed/feed.repository';
import type { UserProfile } from '../src/modules/users/user.repository';
import { ADMIN, buildTestApp } from './helpers/test-app';

const date = (iso: string) => new Date(iso);
const idsOf = (body: unknown) =>
  z
    .array(z.object({ id: z.string() }))
    .parse(body)
    .map(({ id }) => id);
const nextLinkOf = (link: string | undefined) => /^<([^>]+)>; rel="next"$/.exec(link ?? '')?.[1];

function ranked(suffix: string, rankScore: number, authorCountry: string | null): RankedBook {
  return {
    id: `64c0000000000000000000${suffix}`,
    title: 'Title',
    author: 'Author',
    authorCountry,
    publishedDate: date('1900-01-01'),
    pages: 100,
    libraryId: '64a000000000000000000001',
    rankScore,
  };
}

const query = (
  sameCountry: boolean,
  after: { score: number; id: string } | undefined,
  limit: number,
) => ({
  libraryIds: ADMIN.libraryIds,
  country: 'US',
  sameCountry,
  after,
  limit,
});

describe('computeRankScore', () => {
  it('ranks longer books higher when published on the same date', () => {
    assert.ok(
      computeRankScore(500, date('1950-01-01')) > computeRankScore(300, date('1950-01-01')),
    );
  });

  it('ranks older books higher when they have the same page count', () => {
    assert.ok(
      computeRankScore(300, date('1900-01-01')) > computeRankScore(300, date('1950-01-01')),
    );
  });

  it('stops rewarding length beyond 2000 pages', () => {
    assert.equal(
      computeRankScore(5000, date('1950-01-01')),
      computeRankScore(2000, date('1950-01-01')),
    );
  });

  it('weights pages 80% and age 20%, so one year of age is worth five pages', () => {
    const shorterButOlder = computeRankScore(300, date('1949-01-01'));
    const longerButNewer = computeRankScore(305, date('1950-01-01'));

    assert.ok(Math.abs(shorterButOlder - longerButNewer) < 1e-5);
  });
});

describe('GET /feed', () => {
  it('lists same-country books first, then continues with other countries across pages', async () => {
    const { app, feed, authorize } = buildTestApp();
    const auth = authorize(ADMIN);
    const [localTop, localNext] = [ranked('01', 0.9, 'US'), ranked('02', 0.4, 'US')];
    const [foreignTop, foreignNext] = [ranked('03', 1.2, 'FR'), ranked('04', 0.7, null)];
    feed.findRanked.onCall(0).resolves([localTop, localNext]);
    feed.findRanked.onCall(1).resolves([foreignTop, foreignNext]);
    feed.findRanked.onCall(2).resolves([foreignNext]);

    const firstPage = await request(app).get('/feed?limit=3').set('Authorization', auth);
    const secondPage = await request(app)
      .get(nextLinkOf(firstPage.get('Link')) ?? '')
      .set('Authorization', auth);

    assert.deepEqual(idsOf(firstPage.body), [localTop.id, localNext.id, foreignTop.id]);
    assert.deepEqual(idsOf(secondPage.body), [foreignNext.id]);
    assert.equal(secondPage.get('Link'), undefined);
    assert.deepEqual(feed.findRanked.args, [
      [query(true, undefined, 4)],
      [query(false, undefined, 2)],
      [query(false, { score: 1.2, id: foreignTop.id }, 4)],
    ]);
  });

  it('keeps paging through same-country books while they fill whole pages', async () => {
    const { app, feed, authorize } = buildTestApp();
    const auth = authorize(ADMIN);
    const [first, second, third] = [
      ranked('01', 0.9, 'US'),
      ranked('02', 0.8, 'US'),
      ranked('03', 0.7, 'US'),
    ];
    const foreign = ranked('04', 1.5, 'GB');
    feed.findRanked.onCall(0).resolves([first, second, third]);
    feed.findRanked.onCall(1).resolves([third]);
    feed.findRanked.onCall(2).resolves([foreign]);

    const firstPage = await request(app).get('/feed?limit=2').set('Authorization', auth);
    const secondPage = await request(app)
      .get(nextLinkOf(firstPage.get('Link')) ?? '')
      .set('Authorization', auth);

    assert.deepEqual(idsOf(firstPage.body), [first.id, second.id]);
    assert.deepEqual(idsOf(secondPage.body), [third.id, foreign.id]);
    assert.deepEqual(feed.findRanked.args, [
      [query(true, undefined, 3)],
      [query(true, { score: 0.8, id: second.id }, 3)],
      [query(false, undefined, 2)],
    ]);
  });

  it('returns an empty array when nothing matches or the user has no libraries', async () => {
    const { app, feed, authorize } = buildTestApp();
    const withoutLibraries: UserProfile = {
      id: '64b000000000000000000009',
      role: 'user',
      country: 'FR',
      libraryIds: [],
    };
    feed.findRanked.resolves([]);

    const nothingMatches = await request(app).get('/feed').set('Authorization', authorize(ADMIN));
    const noLibraries = await request(app)
      .get('/feed')
      .set('Authorization', authorize(withoutLibraries));

    assert.equal(nothingMatches.status, 200);
    assert.deepEqual(nothingMatches.body, []);
    assert.equal(nothingMatches.get('Link'), undefined);
    assert.deepEqual(noLibraries.body, []);
    assert.equal(feed.findRanked.callCount, 2);
  });

  it('requires a token and rejects a tampered cursor', async () => {
    const { app, feed, authorize } = buildTestApp();
    const tamperedCursor = encodeCursor({
      phase: 'later',
      score: 1,
      id: '64c000000000000000000001',
    });

    const anonymous = await request(app).get('/feed');
    const tampered = await request(app)
      .get(`/feed?cursor=${tamperedCursor}`)
      .set('Authorization', authorize(ADMIN));

    assert.equal(anonymous.status, 401);
    assert.equal(tampered.status, 400);
    assert.equal(feed.findRanked.callCount, 0);
  });
});
