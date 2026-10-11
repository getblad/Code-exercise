import { model, Schema } from 'mongoose';

export interface Library {
  name: string;
  location: string;
}

const librarySchema = new Schema<Library>(
  {
    name: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
  },
  { versionKey: false },
);

export const LibraryModel = model<Library>('Library', librarySchema);
