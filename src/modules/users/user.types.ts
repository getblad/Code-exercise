import type { UserRole } from './user.model';

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

export interface UserStore {
  findCredentialsByUsername(username: string): Promise<UserCredentials | null>;
  findProfileById(id: string): Promise<UserProfile | null>;
}
