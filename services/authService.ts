
import { User, UserRole } from '../types';

const ADMIN_UN = 'fakhri';
const ADMIN_PW_OBF = 'RmFraHJpMTIzIQ=='; 

export const authService = {
  verify: (username: string, password: string): User => {
    const isPasswordCorrect = btoa(password) === ADMIN_PW_OBF;
    const isAdmin = username.toLowerCase() === ADMIN_UN && isPasswordCorrect;

    if (isAdmin) {
      return {
        id: 'admin_001',
        username: 'fakhri',
        role: 'Admin',
        fullName: 'Fakhri Ashour'
      };
    }

    // Default user access should always be set to viewer
    return {
      id: `user_${Math.random().toString(36).substr(2, 5)}`,
      username: username || 'guest_user',
      role: 'Viewer', 
      fullName: username || 'Marketing Viewer'
    };
  }
};
