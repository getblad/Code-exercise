import type { UserRole } from '../users/user.model';
import type { UserProfile } from '../users/user.types';

export type Principal = UserProfile;

export interface TokenClaims {
  userId: string;
  role: UserRole;
}

export interface IssuedToken {
  token: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export interface TokenIssuer {
  issue(claims: TokenClaims): IssuedToken;
  verify(token: string): string;
}
