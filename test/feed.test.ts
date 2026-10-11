import assert from 'node:assert/strict';
import { computeRankScore } from '../src/modules/books/rank-score';

const date = (iso: string) => new Date(iso);

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
