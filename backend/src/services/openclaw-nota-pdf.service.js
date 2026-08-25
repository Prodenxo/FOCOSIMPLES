/**
 * PDF OpenClaw — NFSe, NF-e e NFC-e (mesma tabela mei_nfse).
 */
import { badRequest } from '../utils/errors.js';
import { baixarPdf, obterNota } from './mei-notas.service.js';

/** Status em que o PDF costuma existir na Plugnotas. */
export const isOpenclawNotaPdfReadyStatus = (status) => {
  const s = String(status || '').trim().toLowerCase();
  return s === 'concluido' || s.includes('autoriz');
};

const buildNotaPdfFileName = (record) => {
  const docType = String(record?.document_type || 'NFSE').toUpperCase();
  const short = String(record?.id || 'nota').slice(0, 8);
  const tomador = String(record?.cnpj_tomador || '').replace(/\D/g, '').slice(-6) || 'nota';
  const prefix = docType === 'NFE' ? 'NFe' : docType === 'NFCE' ? 'NFCe' : 'NFSe';
  return `${prefix}-${tomador}-${short}.pdf`.replace(/[^a-zA-Z0-9._-]/g, '_');
};

const notaPdfNotReadyError = (record) => {
  const docType = String(record?.document_type || 'NFSE').toUpperCase();
  const label = docType === 'NFE' ? 'NF-e' : docType === 'NFCE' ? 'NFC-e' : 'NFSe';
  return badRequest(
    `${label} ainda não está pronta para PDF (status: ${record?.status || 'processando'}).`,
    {
      code: 'NOTA_PDF_NOT_READY',
      documentType: docType,
      botHint: `Consulte a nota com sync até status concluido; depois use get_${docType === 'NFE' ? 'nfe' : 'nfse'}_pdf.`,
      status: record?.status,
      notaId: record?.id,
    },
  );
};

/**
 * Sincroniza a nota (opcional), valida status e devolve PDF em base64.
 */
export const fetchOpenclawNotaPdfBase64 = async (userId, { id, sync = true } = {}) => {
  const recordId = String(id || '').trim();
  if (!recordId) {
    throw badRequest('payload.id da nota é obrigatório', { code: 'NOTA_ID_REQUIRED' });
  }

  const record = await obterNota(userId, recordId, {
    sync: sync !== false,
    skipWhatsappDelivery: true,
  });

  if (!isOpenclawNotaPdfReadyStatus(record?.status)) {
    throw notaPdfNotReadyError(record);
  }

  const file = await baixarPdf(userId, recordId);
  const buffer = file?.buffer;
  if (!buffer?.length) {
    throw badRequest('PDF da nota vazio ou indisponível', { code: 'NOTA_PDF_EMPTY' });
  }

  return {
    base64: Buffer.from(buffer).toString('base64'),
    fileName: buildNotaPdfFileName(record),
    mimeType: file.contentType || 'application/pdf',
    nota: {
      id: record.id,
      status: record.status,
      plugnotas_id: record.plugnotas_id,
      document_type: record.document_type,
      cnpj_tomador: record.cnpj_tomador,
    },
  };
};
