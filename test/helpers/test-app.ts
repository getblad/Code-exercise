import sinon from 'sinon';
import { createApp } from '../../src/app';
import { createLogger } from '../../src/infrastructure/logger';
import { AuthService } from '../../src/modules/auth/auth.service';
import { TokenService } from '../../src/modules/auth/token.service';
import { BookRepository } from '../../src/modules/books/book.repository';
import { BookService } from '../../src/modules/books/book.service';
import { FeedRepository } from '../../src/modules/feed/feed.repository';
import { FeedService } from '../../src/modules/feed/feed.service';
import { UserRepository } from '../../src/modules/users/user.repository';
import type { UserProfile } from '../../src/modules/users/user.types';

export const ADMIN: UserProfile = {
  id: '64b000000000000000000001',
  role: 'admin',
  country: 'US',
  libraryIds: ['64a000000000000000000001', '64a000000000000000000002'],
};

export const FOREIGN_LIBRARY_ID = '64a000000000000000000003';

const TEST_SECRET = 'test-secret-that-is-at-least-32-characters';
const TOKEN_TTL_SECONDS = 3600;

export function buildTestApp(checkDatabase: () => Promise<void> = () => Promise.resolve()) {
  const users = sinon.createStubInstance(UserRepository);
  const books = sinon.createStubInstance(BookRepository);
  const feed = sinon.createStubInstance(FeedRepository);
  const tokens = new TokenService(TEST_SECRET, TOKEN_TTL_SECONDS);
  const app = createApp({
    logger: createLogger('silent'),
    checkDatabase,
    authService: new AuthService(users, tokens),
    bookService: new BookService(books),
    feedService: new FeedService(feed),
    trustProxyHops: 0,
  });

  const authorize = (profile: UserProfile): string => {
    users.findProfileById.withArgs(profile.id).resolves(profile);
    return `Bearer ${tokens.issue({ userId: profile.id, role: profile.role }).token}`;
  };

  return { app, users, books, feed, tokens, authorize };
}
