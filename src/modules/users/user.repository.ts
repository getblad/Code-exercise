import { UserModel, type UserRole } from './user.model';

export interface UserCredentials {
  id: string;
  role: UserRole;
  passwordHash: string;
}

export interface UserProfile {
  id: string;
  role: UserRole;
  country: string;
  libraryIds: string[];
}

export class UserRepository {
  async findCredentialsByUsername(username: string): Promise<UserCredentials | null> {
    const user = await UserModel.findOne({ username }).select('+passwordHash').lean();
    if (!user) return null;
    return { id: user._id.toString(), role: user.role, passwordHash: user.passwordHash };
  }

  async findProfileById(id: string): Promise<UserProfile | null> {
    const user = await UserModel.findById(id).lean();
    if (!user) return null;
    return {
      id: user._id.toString(),
      role: user.role,
      country: user.country,
      libraryIds: user.libraries.map((libraryId) => libraryId.toString()),
    };
  }
}
