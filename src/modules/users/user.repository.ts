import { UserModel } from './user.model';
import type { UserCredentials, UserProfile, UserStore } from './user.types';

export class UserRepository implements UserStore {
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
