import '../../src/config/env.js';
import { query } from '../../src/config/pg.js';

const empresaId = 'ab799117-229d-46db-8ed6-7a2a91afb515';

const empresa = await query(
  `SELECT id, empresa, cnpj, max_mei FROM empresas WHERE id = $1`,
  [empresaId],
);
console.log('empresa:', empresa.rows[0]);

const users = await query(
  `SELECT u.id, u.email, rx.mei, rx.status AS rx_status,
    COALESCE(u.raw_user_meta_data->>'display_name', u.raw_user_meta_data->>'full_name') AS nome,
    umc.cert_document, umc.regime_tributario, umc.status AS cert_status,
    umc.razao_social AS cert_razao
   FROM role_x_user_x_empresa rx
   JOIN users u ON u.id = rx.user_id
   LEFT JOIN user_mei_certificates umc ON umc.user_id = rx.user_id
   WHERE rx.empresas_id = $1
   ORDER BY u.email`,
  [empresaId],
);
console.log('users+certs:', JSON.stringify(users.rows, null, 2));

const profiles = await query(
  `SELECT establishment_id, crt, status FROM company_fiscal_profiles WHERE tenant_id = $1`,
  [empresaId],
);
console.log('profiles:', profiles.rows);

process.exit(0);
