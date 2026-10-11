import type { UserRole } from '../users/user.model';

export interface Principal {
  userId: string;
  role: UserRole;
  country: string;
  libraryIds: string[];
}
