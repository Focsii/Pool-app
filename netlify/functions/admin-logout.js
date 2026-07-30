const { sql, json, parseCookies, clearSessionCookie } = require('./_lib');

exports.handler = async (event) => {
  const cookies = parseCookies(event);
  if (cookies.pool_session) {
    await sql`DELETE FROM sessions WHERE token = ${cookies.pool_session}`;
  }
  return json(200, { status: 'logged-out' }, { 'Set-Cookie': clearSessionCookie() });
};
