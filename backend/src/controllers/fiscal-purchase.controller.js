import { badRequest } from '../utils/errors.js';
import {
  importPurchaseNfeXml,
} from '../fiscal-engine/acquisition/purchase-import.service.js';
import {
  findInvoiceByChave,
} from '../fiscal-engine/acquisition/fiscal-purchase.repository.js';
import { explainPriorStRetained } from '../fiscal-engine/acquisition/acquisition-classifier.js';
import {
  loadCatalogProductsForPurchase,
  validateCatalogProductForEmpresa,
} from '../fiscal-engine/acquisition/purchase-catalog.service.js';
import { getEmpresaFiscalDoc } from '../fiscal-engine/acquisition/fiscal-purchase.repository.js';

export const importPurchaseXml = async (req, res, next) => {
  try {
    const { empresaId, userId } = req.requesterContext || {};
    if (!empresaId) return next(badRequest('Empresa não vinculada ao usuário'));

    const file = req.file;
    if (!file?.buffer?.length) return next(badRequest('Arquivo XML obrigatório'));

    const confirmedCatalogId = req.body?.produtoCatalogoId || req.body?.confirmedCatalogId || null;
    let confirmedCatalogProduct = null;

    const catalogProducts = await loadCatalogProductsForPurchase(userId);

    if (confirmedCatalogId) {
      confirmedCatalogProduct = await validateCatalogProductForEmpresa({
        userId,
        empresaId,
        produtoCatalogoId: confirmedCatalogId,
      });
    }

    const empresaFiscalDoc = await getEmpresaFiscalDoc(empresaId);

    const result = await importPurchaseNfeXml({
      empresaId,
      xmlBuffer: file.buffer,
      userId,
      empresaFiscalDoc,
      catalogProducts,
      confirmedCatalogId,
      confirmedCatalogProduct,
    });

    return res.status(result.duplicate ? 200 : (result.blocked ? 422 : 201)).json({
      duplicate: result.duplicate,
      blocked: result.blocked ?? false,
      invoice: result.invoice,
      items: result.items,
      lots: result.lots?.map((lot) => ({
        ...lot,
        priorStExplain: lot.prior_st_status === 'RETAINED'
          ? explainPriorStRetained(lot.prior_st_evidence_json)
          : null,
      })),
      issues: result.issues,
    });
  } catch (err) {
    return next(badRequest(err instanceof Error ? err.message : String(err)));
  }
};

export const getPurchaseByChave = async (req, res, next) => {
  try {
    const empresaId = req.requesterContext?.empresaId;
    if (!empresaId) return next(badRequest('Empresa não vinculada'));

    const chave = String(req.params.chave || '').replace(/\D/g, '').slice(0, 44);
    if (chave.length !== 44) return next(badRequest('Chave NF-e inválida'));

    const found = await findInvoiceByChave(empresaId, chave);
    if (!found) return res.status(404).json({ message: 'NF-e de compra não encontrada' });

    return res.json(found);
  } catch (err) {
    return next(badRequest(err instanceof Error ? err.message : String(err)));
  }
};
