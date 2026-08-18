import { query } from '../../src/config/pg.js';

const empresa = await query(`
  SELECT id, empresa, cnpj, max_mei FROM empresas 
  WHERE empresa ILIKE '%JEH%' OR razao_social ILIKE '%JEH%' OR nome_fantasia ILIKE '%JEH%'
  LIMIT 5
`);
console.log('empresas:', JSON.stringify(empresa.rows, null, 2));

if (empresa.rows[0]) {
  const id = empresa.rows[0].id;
  const profiles = await query(`
    SELECT tenant_id, establishment_id, crt, status, valid_from
    FROM company_fiscal_profiles
    WHERE tenant_id = $1
    ORDER BY establishment_id
  `, [id]);
  console.log('profiles:', JSON.stringify(profiles.rows, null, 2));

  const users = await query(`
    SELECT u.id, u.email, u.nome, rx.mei, r.roles
    FROM role_x_user_x_empresa rx
    JOIN users u ON u.id = rx.user_id
    JOIN roles r ON r.id = rx.roles_id
    WHERE rx.empresas_id = $1
    ORDER BY u.nome
  `, [id]);
  console.log('users:', JSON.stringify(users.rows, null, 2));
}

process.exit(0);
