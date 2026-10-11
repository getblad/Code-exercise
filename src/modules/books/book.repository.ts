import { Types } from 'mongoose';
import { type Book, BookModel } from './book.model';

export interface BookRecord {
  id: string;
  title: string;
  author: string;
  authorCountry: string | null;
  publishedDate: Date;
  pages: number;
  libraryId: string;
}

export interface BookData extends Omit<BookRecord, 'id'> {
  rankScore: number;
}

export interface ListBooksQuery {
  libraryIds: string[];
  afterId: string | undefined;
  limit: number;
}

export class BookRepository {
  async create(data: BookData): Promise<BookRecord> {
    const book = await BookModel.create(toDocument(data));
    return toRecord(book.toObject());
  }

  async findById(id: string, libraryIds: string[]): Promise<BookRecord | null> {
    const book = await BookModel.findOne({ _id: id, library: { $in: libraryIds } }).lean();
    return book && toRecord(book);
  }

  async list({ libraryIds, afterId, limit }: ListBooksQuery): Promise<BookRecord[]> {
    const books = await BookModel.find({
      library: { $in: libraryIds },
      ...(afterId === undefined ? {} : { _id: { $lt: afterId } }),
    })
      .sort({ _id: -1 })
      .limit(limit)
      .lean();
    return books.map(toRecord);
  }

  async replace(id: string, libraryIds: string[], data: BookData): Promise<BookRecord | null> {
    const book = await BookModel.findOneAndUpdate(
      { _id: id, library: { $in: libraryIds } },
      toDocument(data),
      { returnDocument: 'after', runValidators: true },
    ).lean();
    return book && toRecord(book);
  }

  async delete(id: string, libraryIds: string[]): Promise<boolean> {
    const result = await BookModel.deleteOne({ _id: id, library: { $in: libraryIds } });
    return result.deletedCount === 1;
  }
}

function toDocument({ libraryId, ...fields }: BookData): Book {
  return { ...fields, library: new Types.ObjectId(libraryId) };
}

function toRecord(book: Book & { _id: Types.ObjectId }): BookRecord {
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
