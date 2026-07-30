const bcrypt = require('bcryptjs');
const { sql, json, sessionCookie, newToken } = require('./_lib');

const SESSION_SECONDS = 60 * 60 * 24 * 7;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'Invalid JSON' }); }

  const { email, password } = body;
  if (!email || !password) return json(400, { error: 'Email and password required' });

  const rows = await sql`SELECT * FROM investors WHERE email = ${email} AND role = 'admin'`;
  const investor = rows[0];
  if (!investor || investor.status !== 'active') return json(401, { error: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, investor.password_hash);
  if (!ok) return json(401, { error: 'Invalid credentials' });

  const token = newToken();
  await sql`
    INSERT INTO sessions (token, investor_id, expires_at)
    VALUES (${token}, ${investor.id}, now() + interval '7 days')
  `;

  return json(200, { name: investor.name, email: investor.email }, {
    'Set-Cookie': sessionCookie(token, SESSION_SECONDS)
  });
};
