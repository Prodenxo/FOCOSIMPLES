import '../../src/config/env.js';
import { query } from '../../src/config/pg.js';
import { listAccountantClients } from '../../src/services/accountant/accountant-access.service.js';
import { signLocalAccessToken } from '../../src/services/local-auth.service.js';

const admins = await query(`
  SELECT u.id, u.email, r.roles
  FROM users u
  JOIN role_x_user_x_empresa rx ON rx.user_id = u.id
  JOIN roles r ON r.id = rx.roles_id
  WHERE r.roles IN ('superadmin', 'admin')
  LIMIT 5
`);

const superadmin = admins.rows.find((r) => r.roles === 'superadmin') ?? admins.rows[0];
if (!superadmin) {
  console.error('Nenhum admin encontrado');
  process.exit(1);
}

const clients = await listAccountantClients(superadmin.id);
console.log('clients count=', clients.length);
console.log(JSON.stringify(clients.slice(0, 10), null, 2));

const token = signLocalAccessToken({ sub: superadmin.id, email: superadmin.email, role: 'authenticated' });
try {
  const res = await fetch('http://localhost:3333/api/accountant/clients', {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('HTTP', res.status, await res.text());
} catch (error) {
  console.warn('HTTP probe skipped:', error instanceof Error ? error.message : error);
}

process.exit(0);
