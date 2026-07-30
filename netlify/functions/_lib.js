const { neon } = require('@netlify/neon');
const crypto = require('crypto');

const sql = neon(); // uses NETLIFY_DATABASE_URL automatically

function json(status, body, extraHeaders) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', ...(extraHeaders || {}) },
    body: JSON.stringify(body)
  };
}

function parseCookies(event) {
  const header = event.headers.cookie || event.headers.Cookie || '';
  const out = {};
  header.split(';').forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    out[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
  });
  return out;
}

function sessionCookie(token, maxAgeSeconds) {
  return `pool_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`;
}

function clearSessionCookie() {
  return `pool_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

async function requireAdmin(event) {
  const cookies = parseCookies(event);
  const token = cookies.pool_session;
  if (!token) return null;
  const rows = await sql`
    SELECT i.* FROM sessions s
    JOIN investors i ON i.id = s.investor_id
    WHERE s.token = ${token} AND s.expires_at > now()
  `;
  const investor = rows[0];
  if (!investor || investor.role !== 'admin' || investor.status !== 'active') return null;
  return investor;
}

function newToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = { sql, json, parseCookies, sessionCookie, clearSessionCookie, requireAdmin, newToken };
