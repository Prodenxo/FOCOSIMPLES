#!/usr/bin/env node
/**
 * Força re-sincronização do espelho emitente a partir do CNPJ do certificado atual.
 *
 * Uso (Site/backend):
 *   node scripts/one-time/resync-emitente-from-cert.mjs --user-id=UUID
 */
import { createSupabaseClient } from '../../src/config/supabase.js';
import { getCertificateDocument } from '../../src/services/mei-certificate-store.js';
import { syncEmitenteMirrorAfterCertificateUpload } from '../../src/services/mei-emitente-empresa-sync.js';

const args = process.argv.slice(2);
const userArg = args.find((arg) => arg.startsWith('--user-id='));
const userId = userArg ? userArg.split('=')[1]?.trim() : '';

if (!userId) {
  console.error('Informe --user-id=UUID');
  process.exit(1);
}

const adminClient = createSupabaseClient({ useServiceRole: true });

const main = async () => {
  const certDocument = await getCertificateDocument(userId);
  if (!certDocument || String(certDocument).replace(/\D/g, '').length !== 14) {
    console.error('Usuário sem cert_document válido. Envie o certificado primeiro.');
    process.exit(1);
  }

  const result = await syncEmitenteMirrorAfterCertificateUpload(userId, {
    certDocument: String(certDocument).replace(/\D/g, ''),
    previousDoc: null,
    certInfo: null,
    payloadEmitente: null
  });

  console.log('Resultado:', result);
};

main().catch((error) => {
  console.error('Falha:', error?.message || error);
  process.exit(1);
});
