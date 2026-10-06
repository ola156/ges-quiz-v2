export function isAdmin(req) {
  const pw = req.headers.get('x-admin-password');
  return Boolean(process.env.ADMIN_PASSWORD) && pw === process.env.ADMIN_PASSWORD;
}
