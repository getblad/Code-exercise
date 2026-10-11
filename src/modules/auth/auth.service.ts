import { randomUUID } from 'node:crypto';
import { UnauthorizedError } from '../../errors/app-error';
import type { UserStore } from '../users/user.types';
import { hashPassword, verifyPassword } from './password';
import type { Principal } from './auth.types';
import type { IssuedToken, TokenService } from './token.service';

export class AuthService {
  private readonly dummyHash = hashPassword(randomUUID());

  constructor(
    private readonly users: UserStore,
    private readonly tokens: TokenService,
  ) {}

  async login(username: string, password: string): Promise<IssuedToken> {
    const user = await this.users.findCredentialsByUsername(username);
    // Unknown usernames still pay for a hash check, so response time doesn't reveal which ones exist
    const passwordMatches = await verifyPassword(
      password,
      user?.passwordHash ?? (await this.dummyHash),
    );
    if (!user || !passwordMatches) throw new UnauthorizedError('Invalid username or password');

    return this.tokens.issue({ userId: user.id, role: user.role });
  }

  async authenticate(token: string): Promise<Principal> {
    const { userId } = this.tokens.verify(token);
    const user = await this.users.findProfileById(userId);
    if (!user) throw new UnauthorizedError('Invalid token');
    return user;
  }
}
