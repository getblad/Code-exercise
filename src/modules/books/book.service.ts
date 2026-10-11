import { ForbiddenError, NotFoundError } from '../../errors/app-error';
import type { Principal } from '../auth/auth.types';
import type { BookInput } from './book.schemas';
import type { BookData, BookRecord, BookStore } from './book.types';
import { computeRankScore } from './rank-score';

export interface ListBooksOptions {
  libraryId: string | undefined;
  afterId: string | undefined;
  limit: number;
}

export interface BookPage {
  items: BookRecord[];
  nextAfterId: string | undefined;
}

export class BookService {
  constructor(private readonly books: BookStore) {}

  async create(principal: Principal, input: BookInput): Promise<BookRecord> {
    assertMember(principal, input.libraryId);
    return this.books.create(withRankScore(input));
  }

  async get(principal: Principal, id: string): Promise<BookRecord> {
    return orNotFound(await this.books.findById(id, principal.libraryIds));
  }

  async list(
    principal: Principal,
    { libraryId, afterId, limit }: ListBooksOptions,
  ): Promise<BookPage> {
    if (libraryId !== undefined) assertMember(principal, libraryId);
    const libraryIds = libraryId === undefined ? principal.libraryIds : [libraryId];
    if (libraryIds.length === 0) return { items: [], nextAfterId: undefined };

    const rows = await this.books.list({ libraryIds, afterId, limit: limit + 1 });
    const items = rows.slice(0, limit);
    return { items, nextAfterId: rows.length > limit ? items.at(-1)?.id : undefined };
  }

  async replace(principal: Principal, id: string, input: BookInput): Promise<BookRecord> {
    assertMember(principal, input.libraryId);
    return orNotFound(await this.books.replace(id, principal.libraryIds, withRankScore(input)));
  }

  async delete(principal: Principal, id: string): Promise<void> {
    const deleted = await this.books.delete(id, principal.libraryIds);
    if (!deleted) throw new NotFoundError('Book not found');
  }
}

function assertMember(principal: Principal, libraryId: string): void {
  if (!principal.libraryIds.includes(libraryId)) {
    throw new ForbiddenError('You are not a member of this library');
  }
}

function withRankScore(input: BookInput): BookData {
  return { ...input, rankScore: computeRankScore(input.pages, input.publishedDate) };
}

function orNotFound(book: BookRecord | null): BookRecord {
  if (!book) throw new NotFoundError('Book not found');
  return book;
}
