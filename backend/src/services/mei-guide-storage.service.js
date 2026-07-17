import { createSupabaseClient } from '../config/supabase.js';
import { env } from '../config/env.js';
import { badRequest } from '../utils/errors.js';

const STORAGE_BUCKET = 'mei-das-pdfs';
const DEFAULT_EXPIRATION_SECONDS = 60 * 60;
let bucketEnsured = false;

const ensureStorageBucket = async () => {
  if (bucketEnsured) return;
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw badRequest('Supabase não configurado para armazenamento do DAS');
  }
  const supabase = createSupabaseClient({ useServiceRole: true });
  const { error } = await supabase.storage.createBucket(STORAGE_BUCKET, {
    public: false,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ['application/pdf']
  });
  if (error && !String(error.message || '').toLowerCase().includes('already exists')) {
    throw badRequest(error.message || 'Falha ao criar bucket de PDFs');
  }
  bucketEnsured = true;
};

const normalizePeriodo = (value) => String(value || '').replace(/\D/g, '');

export const uploadAdminMeiGuidePdf = async ({ userId, periodoApuracao, pdfBuffer }) => {
  if (!userId) {
    throw badRequest('Usuário não informado para upload do PDF');
  }
  if (!pdfBuffer) {
    throw badRequest('PDF não informado para upload');
  }
  const periodo = normalizePeriodo(periodoApuracao);
  if (!periodo) {
    throw badRequest('Período de apuração inválido para upload');
  }
  await ensureStorageBucket();
  const supabase = createSupabaseClient({ useServiceRole: true });
  const path = `${userId}/mei-guide/${periodo}.pdf`;
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, pdfBuffer, {
      upsert: true,
      contentType: 'application/pdf'
    });
  if (error) {
    throw badRequest(error.message || 'Falha ao armazenar PDF do DAS');
  }
  return { bucket: STORAGE_BUCKET, path };
};

const normalizeCompetencia = (value) => {
  const text = String(value || '').trim();
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(text)) return text;
  const digits = normalizePeriodo(value);
  if (!digits || digits.length !== 6) return null;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}`;
};

/** Tenta ler PDF já guardado no bucket (das_mensal_status ou caminhos padrão). */
export const downloadStoredDasPdfBuffer = async ({ userId, competencia, periodoApuracao }) => {
  if (!userId) return null;
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;

  const periodo = normalizePeriodo(periodoApuracao);
  const comp = normalizeCompetencia(competencia || periodoApuracao);
  const supabase = createSupabaseClient({ useServiceRole: true });
  const candidates = [];

  if (comp) {
    const { data: row } = await supabase
      .from('das_mensal_status')
      .select('pdf_bucket, pdf_path')
      .eq('user_id', userId)
      .eq('competencia', comp)
      .maybeSingle();
    if (row?.pdf_path) {
      candidates.push({ bucket: row.pdf_bucket || STORAGE_BUCKET, path: row.pdf_path });
    }
    candidates.push({ bucket: STORAGE_BUCKET, path: `${userId}/${comp}.pdf` });
  }
  if (periodo) {
    candidates.push({ bucket: STORAGE_BUCKET, path: `${userId}/mei-guide/${periodo}.pdf` });
    if (comp) {
      candidates.push({ bucket: STORAGE_BUCKET, path: `${userId}/mei-guide/${comp}.pdf` });
    }
  }

  const seen = new Set();
  for (const item of candidates) {
    const key = `${item.bucket}:${item.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const { data, error } = await supabase.storage.from(item.bucket).download(item.path);
    if (error || !data) continue;
    const buffer = Buffer.from(await data.arrayBuffer());
    if (buffer.length > 0) return buffer;
  }
  return null;
};

/** Remove PDFs armazenados para forçar nova geração na Receita. */
export const deleteStoredDasPdf = async ({ userId, competencia, periodoApuracao }) => {
  if (!userId || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return;
  const periodo = normalizePeriodo(periodoApuracao);
  const comp = normalizeCompetencia(competencia || periodoApuracao);
  const supabase = createSupabaseClient({ useServiceRole: true });
  const paths = new Set();
  if (comp) paths.add(`${userId}/${comp}.pdf`);
  if (periodo) paths.add(`${userId}/mei-guide/${periodo}.pdf`);
  if (comp) paths.add(`${userId}/mei-guide/${comp}.pdf`);

  const { data: row } = comp
    ? await supabase
      .from('das_mensal_status')
      .select('pdf_bucket, pdf_path')
      .eq('user_id', userId)
      .eq('competencia', comp)
      .maybeSingle()
    : { data: null };
  if (row?.pdf_path) {
    await supabase.storage.from(row.pdf_bucket || STORAGE_BUCKET).remove([row.pdf_path]);
  }
  if (paths.size > 0) {
    await supabase.storage.from(STORAGE_BUCKET).remove(Array.from(paths));
  }
};

export const createSignedPdfUrl = async ({ bucket = STORAGE_BUCKET, path, expiresIn = DEFAULT_EXPIRATION_SECONDS }) => {
  if (!bucket || !path) {
    throw badRequest('Bucket ou caminho inválidos para URL assinada');
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw badRequest('Supabase não configurado para assinar URL do PDF');
  }
  const supabase = createSupabaseClient({ useServiceRole: true });
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) {
    throw badRequest(error.message || 'Falha ao gerar URL assinada');
  }
  if (!data?.signedUrl) {
    throw badRequest('URL assinada não retornada');
  }
  return data.signedUrl;
};
