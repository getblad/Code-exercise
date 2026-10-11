import type { Types } from 'mongoose';
import type { Book } from './book.model';
import type { BookRecord } from './book.types';

export interface BookResponse {
  id: string;
  title: string;
  author: string;
  authorCountry: string | null;
  publishedDate: string;
  pages: number;
  libraryId: string;
}

export function toBookRecord(book: Book & { _id: Types.ObjectId }): BookRecord {
  return {
    id: book._id.toString(),
    title: book.title,
    author: book.author,
    authorCountry: book.authorCountry,
    publishedDate: book.publishedDate,
    pages: book.pages,
    libraryId: book.library.toString(),
  };
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
