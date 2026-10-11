import type { BookRecord } from './book.repository';

export interface BookResponse {
  id: string;
  title: string;
  author: string;
  authorCountry: string | null;
  publishedDate: string;
  pages: number;
  libraryId: string;
}

export function toBookResponse(book: BookRecord): BookResponse {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    authorCountry: book.authorCountry,
    publishedDate: book.publishedDate.toISOString().slice(0, 10),
    pages: book.pages,
    libraryId: book.libraryId,
  };
}
