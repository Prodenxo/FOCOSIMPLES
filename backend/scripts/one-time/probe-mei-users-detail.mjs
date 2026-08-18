import '../../src/config/env.js';
import { query } from '../../src/config/pg.js';

const empresaId = 'ab799117-229d-46db-8ed6-7a2a91afb515';

const all = await query(
  `SELECT u.id, u.email,
    COALESCE(u.raw_user_meta_data->>'display_name', u.raw_user_meta_data->>'full_name') AS nome,
    rx.mei,
    umc.cert_document,
    umc.razao_social AS cert_razao,
    umc.optante_simples_nacional,
    umc.regime_tributario,
    umc.status AS cert_status,
    umc.plugnotas_cert_id,
    umc.documentos_ativos
   FROM role_x_user_x_empresa rx
   JOIN users u ON u.id = rx.user_id
   LEFT JOIN user_mei_certificates umc ON umc.user_id = rx.user_id
   WHERE rx.empresas_id = $1 AND rx.mei = true
   ORDER BY u.email`,
  [empresaId],
);
console.log(JSON.stringify(all.rows, null, 2));
process.exit(0);
