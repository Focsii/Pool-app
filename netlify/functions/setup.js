const bcrypt = require('bcryptjs');
const { sql, json } = require('./_lib');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  await sql`
    CREATE TABLE IF NOT EXISTS investors (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'client',
      status TEXT NOT NULL DEFAULT 'active',
      split_pct NUMERIC NOT NULL DEFAULT 100,
      base_capital NUMERIC NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS weeks (
      id SERIAL PRIMARY KEY,
      week_label TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      publish_at TIMESTAMPTZ,
      released_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS balances (
      id SERIAL PRIMARY KEY,
      week_id INTEGER NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
      investor_id INTEGER NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
      prev_balance NUMERIC NOT NULL DEFAULT 0,
      deposit NUMERIC NOT NULL DEFAULT 0,
      withdrawal NUMERIC NOT NULL DEFAULT 0,
      pnl NUMERIC NOT NULL DEFAULT 0,
      curr_balance NUMERIC NOT NULL DEFAULT 0,
      UNIQUE(week_id, investor_id)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS requests (
      id SERIAL PRIMARY KEY,
      investor_id INTEGER NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      amount NUMERIC NOT NULL,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      resolved_at TIMESTAMPTZ
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      investor_id INTEGER NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL
    )
  `;

  const existing = await sql`SELECT COUNT(*)::int AS n FROM investors`;
  if (existing[0].n > 0) {
    return json(200, { status: 'already-initialized' });
  }

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch (e) {}
  const adminEmail = body.adminEmail || 'admin@pool.local';
  const adminPassword = body.adminPassword;
  if (!adminPassword) return json(400, { error: 'adminPassword required for first-time setup' });

  const hash = await bcrypt.hash(adminPassword, 10);
  await sql`
    INSERT INTO investors (name, email, password_hash, role, status, split_pct, base_capital)
    VALUES ('Manager', ${adminEmail}, ${hash}, 'admin', 'active', 100, 0)
  `;

  const seedClients = [
    { name: 'Stefan', email: 'stefan@pool.local', split: 50, capital: 30.49 },
    { name: 'Bog', email: 'bog@pool.local', split: 68.29, capital: 48.44 },
    { name: 'Andrei', email: 'andrei@pool.local', split: 56.81, capital: 36.46 },
    { name: 'Dave', email: 'dave@pool.local', split: 74.92, capital: 163.52 }
  ];
  for (const c of seedClients) {
    const placeholderHash = await bcrypt.hash(require('crypto').randomBytes(16).toString('hex'), 10);
    await sql`
      INSERT INTO investors (name, email, password_hash, role, status, split_pct, base_capital)
      VALUES (${c.name}, ${c.email}, ${placeholderHash}, 'client', 'active', ${c.split}, ${c.capital})
    `;
  }

  return json(200, { status: 'initialized', adminEmail });
};
