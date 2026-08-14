export type AuthUser = {
  sub: string;
  email: string;
  role: 'ADMIN' | 'HOST' | 'PLAYER';
};
