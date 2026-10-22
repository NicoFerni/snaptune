// HTTP Basic auth for /admin: any user name, the password in ADMIN_PASSWORD. proxy.ts checks it on
// every /admin request, and each admin Server Action checks it again, since those take direct POSTs.

export const adminEnabled = () => Boolean(process.env.ADMIN_PASSWORD);

export function isAdmin(authorization: string | null): boolean {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || !authorization?.startsWith("Basic ")) return false;
  const decoded = atob(authorization.slice(6));
  return decoded.slice(decoded.indexOf(":") + 1) === password;
}
