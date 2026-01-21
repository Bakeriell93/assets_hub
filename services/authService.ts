import { User } from '../types';
import { storageService } from './storageService';

export class AuthError extends Error {
  code: 'INVALID_CREDENTIALS' | 'USER_NOT_FOUND' | 'MISSING_CREDENTIALS';
  constructor(code: AuthError['code'], message: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

export const authService = {
  /**
   * Strict login:
   * - user must exist in the Users registry (Firestore or localStorage fallback)
   * - password must match the stored password
   */
  verify: async (username: string, password: string): Promise<User> => {
    const uname = (username || '').trim().toLowerCase();
    const pw = password || '';

    if (!uname || !pw) {
      throw new AuthError('MISSING_CREDENTIALS', 'Username and password are required.');
    }

    const user = await storageService.verifyCloudUser(uname);
    if (!user) {
      throw new AuthError('USER_NOT_FOUND', 'User not found. Ask an admin to create your account.');
    }

    // NOTE: This is still plaintext password matching (better than "allow all"),
    // but for real production you should use Firebase Auth / hashed passwords.
    if (!user.password || user.password !== pw) {
      throw new AuthError('INVALID_CREDENTIALS', 'Invalid username or password.');
    }

    return user;
  }
};
