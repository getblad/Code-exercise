import { model, Schema, type Types } from 'mongoose';
import { isCountryCode } from '../../validation/country-codes';

export interface Book {
  title: string;
  author: string;
  authorCountry: string | null;
  publishedDate: Date;
  pages: number;
  library: Types.ObjectId;
  rankScore: number;
}

const bookSchema = new Schema<Book>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    author: { type: String, required: true, trim: true, maxlength: 200 },
    authorCountry: {
      type: String,
      default: null,
      uppercase: true,
      validate: {
        validator: (code: string | null) => code === null || isCountryCode(code),
        message: 'authorCountry must be an ISO 3166-1 alpha-2 country code',
      },
    },
    publishedDate: { type: Date, required: true },
    pages: {
      type: Number,
      required: true,
      min: 1,
      max: 100_000,
      validate: { validator: Number.isInteger, message: 'pages must be an integer' },
    },
    library: { type: Schema.Types.ObjectId, ref: 'Library', required: true },
    rankScore: { type: Number, required: true },
  },
  { versionKey: false },
);

bookSchema.index({ library: 1, _id: -1 }, { name: 'library_recent' });
bookSchema.index(
  { library: 1, authorCountry: 1, rankScore: -1, _id: -1 },
  { name: 'feed_country_rank' },
);
bookSchema.index({ library: 1, rankScore: -1, _id: -1, authorCountry: 1 }, { name: 'feed_rank' });

export const BookModel = model<Book>('Book', bookSchema);
