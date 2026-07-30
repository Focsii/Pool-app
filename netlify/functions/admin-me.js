const { json, requireAdmin } = require('./_lib');

exports.handler = async (event) => {
  const admin = await requireAdmin(event);
  if (!admin) return json(401, { error: 'Not logged in' });
  return json(200, { name: admin.name, email: admin.email });
};
