import '../../src/config/env.js';
import { query } from '../../src/config/pg.js';

const empresaId = 'ab799117-229d-46db-8ed6-7a2a91afb515';

const certs = await query(
  `SELECT u.email,
    umc.cert_document,
    umc.regime_tributario,
    umc.optante_simples_nacional,
    umc.razao_social,
    umc.nome_fantasia,
    umc.documentos_ativos,
    umc.plugnotas_cert_id
   FROM role_x_user_x_empresa rx
   JOIN users u ON u.id = rx.user_id
   JOIN user_mei_certificates umc ON umc.user_id = rx.user_id
   WHERE rx.empresas_id = $1 AND rx.mei = true
   ORDER BY u.email`,
  [empresaId],
);
console.log(JSON.stringify(certs.rows, null, 2));
process.exit(0);
