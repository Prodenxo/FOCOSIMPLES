import * as transactionsService from '../services/transactions.service.js';
import * as categoriesService from '../services/categories.service.js';
import * as usersService from '../services/users.service.js';
import * as meiDasService from '../services/mei-das.service.js';
import * as meiGuideService from '../services/mei-guide.service.js';
import * as meiGuideDasBase64Service from '../services/mei-guide-das-base64.service.js';
import * as meiNotasService from '../services/mei-notas.service.js';
import * as n8nWhatsappService from '../services/n8n-whatsapp.service.js';
import { badRequest, forbidden } from '../utils/errors.js';
import { parseCatalogLimit } from '../utils/mei-catalog-query.js';
import { sendCreated, sendSuccess } from '../utils/response.js';
import { buildAccessRequestReport } from '../services/access-request-report.service.js';
import { upsertDocumentosAtivosMirrorForAdmin } from '../services/mei-certificate-store.js';
import {
  assertAtLeastOneDocumentoAtivo,
  normalizeDocumentosAtivosShape,
} from '../services/plugnotas/plugnotas-empresa-documentos-ativos.js';

let meiDasServiceRef = meiDasService;
let meiGuideServiceRef = meiGuideService;
let meiGuideDasBase64ServiceRef = meiGuideDasBase64Service;
let meiNotasServiceRef = meiNotasService;
let n8nWhatsappServiceRef = n8nWhatsappService;
let usersServiceRef = usersService;

export const __setMeiDasServiceForTests = (service) => {
  meiDasServiceRef = service || meiDasService;
};

export const __setMeiGuideServiceForTests = (service) => {
  meiGuideServiceRef = service || meiGuideService;
};

export const __setMeiGuideDasBase64ServiceForTests = (service) => {
  meiGuideDasBase64ServiceRef = service || meiGuideDasBase64Service;
};

export const __setN8nWhatsappServiceForTests = (service) => {
  n8nWhatsappServiceRef = service || n8nWhatsappService;
};

export const __setUsersServiceForTests = (service) => {
  usersServiceRef = service || usersService;
};

export const __setMeiNotasServiceForTests = (service) => {
  meiNotasServiceRef = service || meiNotasService;
};

const ensureCanViewUser = async (accessToken, targetUserId) => {
  const allowed = await usersServiceRef.canViewUser(accessToken, targetUserId);
  if (!allowed) throw forbidden();
};

const ensureMeiEnabledForUser = async (accessToken, targetUserId) => {
  if (typeof usersServiceRef.isUserMeiSlotActive !== 'function') {
    if (typeof usersServiceRef.listUsers !== 'function') {
      return { mei: true };
    }
    const user = await resolveAdminUserContext(accessToken, targetUserId);
    if (user?.mei !== true) {
      throw forbidden('Acesso MEI desabilitado para este usuário');
    }
    return user;
  }
  const meiActive = await usersServiceRef.isUserMeiSlotActive(targetUserId);
  if (!meiActive) {
    throw forbidden('Acesso MEI desabilitado para este usuário');
  }
  return { id: targetUserId, mei: true };
};

const resolveAdminUserContext = async (accessToken, targetUserId) => {
  const { users } = await usersServiceRef.listUsers(accessToken);
  const user = (users || []).find((item) => item.id === targetUserId);
  if (!user) {
    throw badRequest('Usuário não encontrado no escopo');
  }
  return user;
};

const toCompetencia = (periodoApuracao) => {
  const digits = String(periodoApuracao || '').replace(/\D/g, '');
  if (digits.length !== 6) return null;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}`;
};

export const listUserTransactions = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    await ensureCanViewUser(req.accessToken, userId);
    const data = await transactionsService.listTransactions(userId);
    return sendSuccess(res, data, 'Transações do usuário listadas');
  } catch (error) {
    return next(error);
  }
};

export const listUserCategories = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    await ensureCanViewUser(req.accessToken, userId);
    const data = await categoriesService.listCategories(userId, req.query?.type);
    return sendSuccess(res, data, 'Categorias do usuário listadas');
  } catch (error) {
    return next(error);
  }
};

export const listUserBudgetsSummary = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    await ensureCanViewUser(req.accessToken, userId);
    const year = req.query?.year ? Number(req.query.year) : undefined;
    const month = req.query?.month ? Number(req.query.month) : undefined;
    const data = await categoriesService.listCategoryBudgetsSummary(userId, { year, month });
    return sendSuccess(res, data, 'Resumo de orçamento do usuário');
  } catch (error) {
    return next(error);
  }
};

export const listUserBudgetsYearly = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    await ensureCanViewUser(req.accessToken, userId);
    const year = Number(req.query?.year);
    const data = await categoriesService.listCategoryBudgetsYearly(userId, year);
    return sendSuccess(res, data, 'Orçamentos anuais do usuário');
  } catch (error) {
    return next(error);
  }
};

export const getUserBalance = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    await ensureCanViewUser(req.accessToken, userId);

    const transactions = await transactionsService.listTransactions(userId);
    let totalEntradas = 0;
    let totalSaidas = 0;

    (transactions || []).forEach((transaction) => {
      const valor = Number(transaction?.valor ?? 0);
      if (Number.isNaN(valor)) return;
      const tipo = String(transaction?.tipo || '').toLowerCase();
      if (tipo === 'entrada') {
        totalEntradas += valor;
      } else {
        totalSaidas += valor;
      }
    });

    const balance = totalEntradas - totalSaidas;
    return sendSuccess(res, { balance, totalEntradas, totalSaidas }, 'Saldo do usuário');
  } catch (error) {
    return next(error);
  }
};

export const listPendingDas = async (req, res, next) => {
  try {
    const competencia = req.query?.competencia;
    const data = await meiDasServiceRef.listAdminCompanyPendingDas(req.accessToken, competencia);
    return sendSuccess(res, data, 'Pendências DAS listadas');
  } catch (error) {
    return next(error);
  }
};

export const listDasStatus = async (req, res, next) => {
  try {
    const data = await meiDasServiceRef.listAdminCompanyDasStatus(req.accessToken, {
      competencia: req.query?.competencia,
      status: req.query?.status,
      q: req.query?.q
    });
    return sendSuccess(res, data, 'Status DAS listados');
  } catch (error) {
    return next(error);
  }
};

export const reprocessDas = async (req, res, next) => {
  try {
    const data = await meiDasServiceRef.reprocessDasForAdmin(req.accessToken, {
      userId: req.body?.userId,
      competencia: req.body?.competencia
    });
    return sendSuccess(res, data, 'Reprocessamento DAS concluído');
  } catch (error) {
    return next(error);
  }
};

export const getAdminMeiCertificateStatus = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    await ensureCanViewUser(req.accessToken, userId);
    await ensureMeiEnabledForUser(req.accessToken, userId);
    const data = await meiGuideServiceRef.getCertificateStatus(userId);
    return sendSuccess(res, data, 'Status do certificado obtido');
  } catch (error) {
    return next(error);
  }
};

/** Admin define quais tipos de nota o utilizador pode emitir (espelho local). */
export const patchAdminMeiDocumentosAtivos = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    await ensureCanViewUser(req.accessToken, userId);
    await ensureMeiEnabledForUser(req.accessToken, userId);

    const selection = normalizeDocumentosAtivosShape(req.body?.documentosAtivos ?? req.body);
    assertAtLeastOneDocumentoAtivo(selection);

    const saved = await upsertDocumentosAtivosMirrorForAdmin(userId, selection);
    if (!saved) {
      throw badRequest('Não foi possível gravar as permissões de emissão para este utilizador.');
    }
    return sendSuccess(res, { documentosAtivos: saved }, 'Permissões de emissão atualizadas');
  } catch (error) {
    return next(error);
  }
};

export const listAdminMeiPeriods = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    await ensureCanViewUser(req.accessToken, userId);
    await ensureMeiEnabledForUser(req.accessToken, userId);
    const refresh =
      String(req.query?.refresh || '').toLowerCase() === 'true'
      || String(req.query?.refresh || '') === '1';
    const data = await meiGuideServiceRef.listPeriods(userId, {
      cnpj: req.query?.cnpj,
      refresh,
    });
    return sendSuccess(res, data, 'Períodos MEI listados');
  } catch (error) {
    return next(error);
  }
};

export const listAdminMeiPeriodsByCnpj = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    await ensureCanViewUser(req.accessToken, userId);
    await ensureMeiEnabledForUser(req.accessToken, userId);
    const refresh =
      String(req.query?.refresh || '').toLowerCase() === 'true'
      || String(req.query?.refresh || '') === '1';
    const data = await meiGuideServiceRef.listPeriodsByCnpj(userId, {
      cnpj: req.query?.cnpj,
      refresh,
    });
    return sendSuccess(res, data, 'Períodos MEI listados');
  } catch (error) {
    return next(error);
  }
};

export const downloadAdminMeiGuide = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const periodoApuracao = req.params.periodoApuracao;
    await ensureCanViewUser(req.accessToken, userId);
    await ensureMeiEnabledForUser(req.accessToken, userId);
    const file = await meiGuideServiceRef.downloadGuide({
      userId,
      cnpj: req.query?.cnpj,
      periodoApuracao
    });
    await meiGuideDasBase64ServiceRef.upsertDasBase64({
      userId,
      periodoApuracao,
      pdfBase64: file.buffer.toString('base64')
    });
    res.setHeader('Content-Type', file.contentType || 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename || 'guia-mei.pdf'}"`);
    return res.send(file.buffer);
  } catch (error) {
    return next(error);
  }
};

export const listAdminUserMeiNfse = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    await ensureCanViewUser(req.accessToken, userId);
    const limit = req.query?.limit ? Number(req.query.limit) : undefined;
    const documentType = req.query?.documentType || undefined;
    const includeArchived = req.query?.includeArchived !== 'false';
    const data = await meiNotasServiceRef.listNotasByUserId(userId, {
      limit,
      documentType,
      includeArchived
    });
    return sendSuccess(res, data, 'Notas fiscais do usuário listadas');
  } catch (error) {
    return next(error);
  }
};

export const listAdminUserMeiCatalogoClientes = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    await ensureCanViewUser(req.accessToken, userId);
    const q = String(req.query?.q || '').trim();
    const limit = parseCatalogLimit(req.query?.limit);
    const documentType = String(req.query?.documentType || '').trim() || undefined;
    const data = await meiNotasServiceRef.listarCatalogoClientes(userId, { q, limit, documentType });
    return sendSuccess(res, data, 'Catálogo de clientes listado');
  } catch (error) {
    return next(error);
  }
};

export const listAdminUserMeiCatalogoProdutos = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    await ensureCanViewUser(req.accessToken, userId);
    const q = String(req.query?.q || '').trim();
    const limit = parseCatalogLimit(req.query?.limit);
    const documentType = String(req.query?.documentType || '').trim() || undefined;
    const data = await meiNotasServiceRef.listarCatalogoProdutos(userId, { q, limit, documentType });
    return sendSuccess(res, data, 'Catálogo de produtos listado');
  } catch (error) {
    return next(error);
  }
};

export const createAdminUserMeiCatalogoCliente = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    await ensureCanViewUser(req.accessToken, userId);
    await ensureMeiEnabledForUser(req.accessToken, userId);
    const data = await meiNotasServiceRef.criarCatalogoCliente(userId, req.body);
    return sendCreated(res, data, 'Cliente do catálogo registado');
  } catch (error) {
    return next(error);
  }
};

export const updateAdminUserMeiCatalogoCliente = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    await ensureCanViewUser(req.accessToken, userId);
    await ensureMeiEnabledForUser(req.accessToken, userId);
    const data = await meiNotasServiceRef.atualizarCatalogoCliente(userId, req.params.id, req.body);
    return sendSuccess(res, data, 'Cliente do catálogo atualizado');
  } catch (error) {
    return next(error);
  }
};

export const deleteAdminUserMeiCatalogoCliente = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    await ensureCanViewUser(req.accessToken, userId);
    await ensureMeiEnabledForUser(req.accessToken, userId);
    await meiNotasServiceRef.eliminarCatalogoCliente(userId, req.params.id);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
};

export const emitirNotaAsAdmin = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    await ensureCanViewUser(req.accessToken, userId);
    const data = await meiNotasServiceRef.emitirNota(userId, req.body);
    return sendSuccess(res, data, 'Nota fiscal enviada para emissão');
  } catch (error) {
    return next(error);
  }
};

export const listAdminUserParcelamentos = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    await ensureCanViewUser(req.accessToken, userId);
    const contribuinte = req.query?.contribuinteNumero
      ? {
          numero: req.query.contribuinteNumero,
          tipo: req.query.contribuinteTipo
        }
      : null;
    let cnpj = req.query?.cnpj || null;
    if (!cnpj) {
      try {
        const certStatus = await meiGuideServiceRef.getCertificateStatus(userId);
        if (certStatus?.documento) cnpj = certStatus.documento;
      } catch (_) {
        // ignorar; listParcelamentos pode falhar sem CNPJ/certificado
      }
    }
    const data = await meiGuideServiceRef.listParcelamentos(userId, {
      cnpj,
      contribuinte
    });
    return sendSuccess(res, data, 'Parcelamentos do usuário listados');
  } catch (error) {
    return next(error);
  }
};

export const downloadAdminUserParcelamentoPdf = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const numero = req.params.numero;
    await ensureCanViewUser(req.accessToken, userId);
    const contribuinte = req.query?.contribuinteNumero
      ? {
          numero: req.query.contribuinteNumero,
          tipo: req.query.contribuinteTipo
        }
      : null;
    const file = await meiGuideServiceRef.getOrDownloadParcelamentoPdf(userId, {
      numero,
      cnpj: req.query?.cnpj || undefined,
      modalidade: req.query?.modalidade || undefined,
      contribuinte
    });
    res.setHeader('Content-Type', file.contentType || 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename || `parcelamento-${numero}.pdf`}"`);
    return res.send(file.buffer);
  } catch (error) {
    return next(error);
  }
};

export const sendAdminMeiWhatsapp = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const periodoApuracao = req.body?.periodoApuracao;
    if (!periodoApuracao) {
      throw badRequest('Período de apuração é obrigatório');
    }
    await ensureCanViewUser(req.accessToken, userId);
    const user = await ensureMeiEnabledForUser(req.accessToken, userId);
    if (!user?.phone) {
      throw badRequest('Telefone do usuário não encontrado para envio');
    }

    const certStatus = await meiGuideServiceRef.getCertificateStatus(userId);
    const cnpj = req.body?.cnpj || certStatus?.documento || null;
    const competencia = req.body?.competencia || toCompetencia(periodoApuracao) || periodoApuracao;

    let pdfBase64 = await meiGuideDasBase64ServiceRef.getDasBase64({
      userId,
      periodoApuracao
    });
    if (!pdfBase64) {
      const file = await meiGuideServiceRef.downloadGuide({
        userId,
        cnpj,
        periodoApuracao
      });
      pdfBase64 = file.buffer.toString('base64');
      await meiGuideDasBase64ServiceRef.upsertDasBase64({
        userId,
        periodoApuracao,
        pdfBase64
      });
    }
    const displayName = user.displayName || user.email || 'Cliente';
    const message = `Olá ${displayName}, segue a guia DAS MEI da competência ${competencia}.`;
    const payload = {
      userId,
      displayName,
      email: user.email || null,
      phone: user.phone || null,
      empresaId: user.empresaId || null,
      empresaName: user.empresaName || null,
      competencia,
      periodoApuracao,
      cnpj,
      pdfBase64,
      fileName: `das-mei-${periodoApuracao}.pdf`,
      source: 'admin_mei_mirror',
      message
    };
    const webhook = await n8nWhatsappServiceRef.sendWhatsappMessage(payload);
    return sendSuccess(res, { sent: true, webhook }, 'Envio para WhatsApp solicitado');
  } catch (error) {
    return next(error);
  }
};

export const getAccessRequestsReport = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query?.limit) || 200, 1), 500);
    const eventType = String(req.query?.eventType || '').trim().toLowerCase();
    let { entries } = await buildAccessRequestReport(limit);
    if (eventType && ['submitted', 'approved'].includes(eventType)) {
      entries = entries.filter((e) => e.eventType === eventType);
    }
    return sendSuccess(res, { entries });
  } catch (error) {
    return next(error);
  }
};
