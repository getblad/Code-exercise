import { Types } from 'mongoose';
import type { Book } from '../modules/books/book.model';
import type { Library } from '../modules/libraries/library.model';
import type { User } from '../modules/users/user.model';

type WithId<T> = T & { _id: Types.ObjectId };
type SeedBook = WithId<Omit<Book, 'rankScore'>>;
type SeedUser = WithId<Omit<User, 'passwordHash'>> & { password: string };

const DEMO_PASSWORD = 'password123';

export const LIBRARY_IDS = {
  central: new Types.ObjectId('64a000000000000000000001'),
  riverside: new Types.ObjectId('64a000000000000000000002'),
  harbor: new Types.ObjectId('64a000000000000000000003'),
};

export const SEED_LIBRARIES: WithId<Library>[] = [
  { _id: LIBRARY_IDS.central, name: 'Central Library', location: 'New York, US' },
  { _id: LIBRARY_IDS.riverside, name: 'Riverside Library', location: 'London, GB' },
  { _id: LIBRARY_IDS.harbor, name: 'Harbor Library', location: 'Hamburg, DE' },
];

export const SEED_USERS: SeedUser[] = [
  {
    _id: new Types.ObjectId('64b000000000000000000001'),
    username: 'admin',
    password: DEMO_PASSWORD,
    country: 'US',
    role: 'admin',
    libraries: [LIBRARY_IDS.central, LIBRARY_IDS.riverside],
  },
  {
    _id: new Types.ObjectId('64b000000000000000000002'),
    username: 'alice',
    password: DEMO_PASSWORD,
    country: 'GB',
    role: 'user',
    libraries: [LIBRARY_IDS.riverside, LIBRARY_IDS.harbor],
  },
  {
    _id: new Types.ObjectId('64b000000000000000000003'),
    username: 'bob',
    password: DEMO_PASSWORD,
    country: 'DE',
    role: 'user',
    libraries: [LIBRARY_IDS.harbor],
  },
];

const books: [string, string, string | null, string, number, Types.ObjectId][] = [
  ['Moby-Dick', 'Herman Melville', 'US', '1851-10-18', 635, LIBRARY_IDS.central],
  ['The Great Gatsby', 'F. Scott Fitzgerald', 'US', '1925-04-10', 180, LIBRARY_IDS.central],
  ['Infinite Jest', 'David Foster Wallace', 'US', '1996-02-01', 1079, LIBRARY_IDS.central],
  ['Beloved', 'Toni Morrison', 'US', '1987-09-02', 324, LIBRARY_IDS.central],
  ['Les Misérables', 'Victor Hugo', 'FR', '1862-04-03', 1462, LIBRARY_IDS.central],
  ['Pride and Prejudice', 'Jane Austen', 'GB', '1813-01-28', 432, LIBRARY_IDS.central],
  ['Don Quixote', 'Miguel de Cervantes', 'ES', '1605-01-16', 1023, LIBRARY_IDS.central],
  ["Gravity's Rainbow", 'Thomas Pynchon', 'US', '1973-02-28', 776, LIBRARY_IDS.riverside],
  ['Leaves of Grass', 'Walt Whitman', 'US', '1855-07-04', 95, LIBRARY_IDS.riverside],
  ['Middlemarch', 'George Eliot', 'GB', '1871-12-01', 880, LIBRARY_IDS.riverside],
  ['Nineteen Eighty-Four', 'George Orwell', 'GB', '1949-06-08', 328, LIBRARY_IDS.riverside],
  ['Ulysses', 'James Joyce', 'IE', '1922-02-02', 730, LIBRARY_IDS.riverside],
  ['The Count of Monte Cristo', 'Alexandre Dumas', 'FR', '1844-08-28', 1276, LIBRARY_IDS.riverside],
  ['One Thousand and One Nights', 'Anonymous', null, '1706-01-01', 1500, LIBRARY_IDS.riverside],
  ['The Magic Mountain', 'Thomas Mann', 'DE', '1924-11-20', 720, LIBRARY_IDS.harbor],
  ['Steppenwolf', 'Hermann Hesse', 'DE', '1927-06-01', 237, LIBRARY_IDS.harbor],
  ['The Trial', 'Franz Kafka', 'CZ', '1925-04-26', 255, LIBRARY_IDS.harbor],
  ['War and Peace', 'Leo Tolstoy', 'RU', '1869-01-01', 1225, LIBRARY_IDS.harbor],
];

export const SEED_BOOKS: SeedBook[] = books.map(
  ([title, author, authorCountry, publishedDate, pages, library], index) => ({
    _id: new Types.ObjectId(`64c${String(index + 1).padStart(21, '0')}`),
    title,
    author,
    authorCountry,
    publishedDate: new Date(publishedDate),
    pages,
    library,
  }),
);
