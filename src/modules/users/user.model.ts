import { model, Schema, type Types } from 'mongoose';
import { COUNTRY_CODE_MESSAGE, isCountryCode } from '../../validation/country-codes';

export const USER_ROLES = ['admin', 'user'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface User {
  username: string;
  country: string;
  libraries: Types.ObjectId[];
  role: UserRole;
  passwordHash: string;
}

const userSchema = new Schema<User>(
  {
    username: { type: String, required: true, trim: true, unique: true },
    country: {
      type: String,
      required: true,
      uppercase: true,
      validate: {
        validator: isCountryCode,
        message: `{PATH} ${COUNTRY_CODE_MESSAGE}`,
      },
    },
    libraries: [{ type: Schema.Types.ObjectId, ref: 'Library' }],
    role: { type: String, enum: USER_ROLES, default: 'user' },
    passwordHash: { type: String, required: true, select: false },
  },
  { versionKey: false },
);

export const UserModel = model<User>('User', userSchema);
