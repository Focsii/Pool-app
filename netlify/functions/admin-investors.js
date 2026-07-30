const bcrypt = require('bcryptjs');
const { sql, json, requireAdmin } = require('./_lib');

exports.handler = async (event) => {
  const admin = await requireAdmin(event);
  if (!admin) return json(401, { error: 'Not logged in' });

  if (event.httpMethod === 'GET') {
    const rows = await sql`
      SELECT id, name, email, role, status, split_pct, base_capital, created_at
      FROM investors ORDER BY role DESC, name ASC
    `;
    return json(200, { investors: rows });
  }

  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'Invalid JSON' }); }
    const { name, email, password, splitPct, baseCapital } = body;
    if (!name || !email || !password) return json(400, { error: 'name, email, password required' });
    const hash = await bcrypt.hash(password, 10);
    try {
      const rows = await sql`
        INSERT INTO investors (name, email, password_hash, role, status, split_pct, base_capital)
        VALUES (${name}, ${email}, ${hash}, 'client', 'active', ${splitPct ?? 100}, ${baseCapital ?? 0})
        RETURNING id, name, email, role, status, split_pct, base_capital
      `;
      return json(201, { investor: rows[0] });
    } catch (e) {
      if (String(e.message || '').includes('duplicate')) return json(409, { error: 'Email already in use' });
      return json(500, { error: 'Could not create investor' });
    }
  }

  if (event.httpMethod === 'PATCH') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'Invalid JSON' }); }
    const { id, name, splitPct, baseCapital, status, password } = body;
    if (!id) return json(400, { error: 'id required' });

    if (name !== undefined) await sql`UPDATE investors SET name = ${name} WHERE id = ${id}`;
    if (splitPct !== undefined) await sql`UPDATE investors SET split_pct = ${splitPct} WHERE id = ${id}`;
    if (baseCapital !== undefined) await sql`UPDATE investors SET base_capital = ${baseCapital} WHERE id = ${id}`;
    if (status !== undefined) await sql`UPDATE investors SET status = ${status} WHERE id = ${id}`;
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      await sql`UPDATE investors SET password_hash = ${hash} WHERE id = ${id}`;
    }
    const rows = await sql`SELECT id, name, email, role, status, split_pct, base_capital FROM investors WHERE id = ${id}`;
    return json(200, { investor: rows[0] });
  }

  if (event.httpMethod === 'DELETE') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'Invalid JSON' }); }
    const { id } = body;
    if (!id) return json(400, { error: 'id required' });
    if (Number(id) === admin.id) return json(400, { error: "You can't delete your own admin account" });
    await sql`DELETE FROM investors WHERE id = ${id}`;
    return json(200, { status: 'deleted' });
  }

  return json(405, { error: 'Method not allowed' });
};
