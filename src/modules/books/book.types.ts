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

export interface BookStore {
  create(data: BookData): Promise<BookRecord>;
  findById(id: string, libraryIds: string[]): Promise<BookRecord | null>;
  list(query: ListBooksQuery): Promise<BookRecord[]>;
  replace(id: string, libraryIds: string[], data: BookData): Promise<BookRecord | null>;
  delete(id: string, libraryIds: string[]): Promise<boolean>;
}
