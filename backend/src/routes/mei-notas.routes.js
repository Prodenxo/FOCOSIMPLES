import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middlewares/auth.js';
import { requireMeiEnabled } from '../middlewares/requireMei.js';
import * as controller from '../controllers/mei-notas.controller.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

router.post('/webhook', controller.webhook);
router.post('/emitir', requireAuth, requireMeiEnabled, controller.emitir);
router.post(
  '/setup/emissao-fiscal/certificado',
  requireAuth,
  requireMeiEnabled,
  upload.single('arquivo'),
  controller.cadastrarPlugNotasCertificado
);
router.post(
  '/setup/emissao-fiscal/emitente',
  requireAuth,
  requireMeiEnabled,
  upload.single('arquivo'),
  controller.cadastrarPlugNotasEmitenteComposite
);
router.post('/setup/emissao-fiscal/empresa', requireAuth, requireMeiEnabled, controller.cadastrarPlugNotasEmpresa);
router.get('/setup/emissao-fiscal/empresa', requireAuth, requireMeiEnabled, controller.consultarPlugNotasEmpresa);
router.patch('/setup/emissao-fiscal/empresa', requireAuth, requireMeiEnabled, controller.atualizarPlugNotasEmpresa);
router.post(
  '/setup/plugnotas/certificado',
  requireAuth,
  requireMeiEnabled,
  upload.single('arquivo'),
  controller.cadastrarPlugNotasCertificado
);
router.post(
  '/setup/plugnotas/emitente',
  requireAuth,
  requireMeiEnabled,
  upload.single('arquivo'),
  controller.cadastrarPlugNotasEmitenteComposite
);
router.post('/setup/plugnotas/empresa', requireAuth, requireMeiEnabled, controller.cadastrarPlugNotasEmpresa);
router.get('/setup/plugnotas/empresa', requireAuth, requireMeiEnabled, controller.consultarPlugNotasEmpresa);
router.patch('/setup/plugnotas/empresa', requireAuth, requireMeiEnabled, controller.atualizarPlugNotasEmpresa);
router.get('/cnpj-lookup/:cnpj', requireAuth, controller.lookupCnpj);
router.get('/cep-lookup/:cep', requireAuth, requireMeiEnabled, controller.lookupCep);
router.get('/', requireAuth, requireMeiEnabled, controller.listar);
router.get('/limite-faturamento', requireAuth, requireMeiEnabled, controller.limiteFaturamento);
router.get('/relatorio/nfe', requireAuth, requireMeiEnabled, controller.relatorioNfe);
router.get('/catalogo/clientes', requireAuth, requireMeiEnabled, controller.listarCatalogoClientes);
router.post('/catalogo/clientes', requireAuth, requireMeiEnabled, controller.criarCatalogoCliente);
router.post('/catalogo/clientes/sync', requireAuth, requireMeiEnabled, controller.syncCatalogoClienteDocumentTypes);
router.post('/catalogo/clientes/soft-hide', requireAuth, requireMeiEnabled, controller.softHideCatalogoClientePorDocumento);
router.patch('/catalogo/clientes/:id', requireAuth, requireMeiEnabled, controller.atualizarCatalogoCliente);
router.delete('/catalogo/clientes/:id', requireAuth, requireMeiEnabled, controller.eliminarCatalogoCliente);
router.get('/catalogo/produtos', requireAuth, requireMeiEnabled, controller.listarCatalogoProdutos);
router.get('/catalogo/codigos-servicos', requireAuth, requireMeiEnabled, controller.listarCatalogoCodigosServicos);
router.get('/catalogo/codigos-servicos/sugerir', requireAuth, requireMeiEnabled, controller.sugerirCatalogoCodigosServicos);
router.post('/catalogo/produtos', requireAuth, requireMeiEnabled, controller.criarCatalogoProduto);
router.post('/catalogo/produtos/from-cnaes', requireAuth, requireMeiEnabled, controller.criarCatalogoProdutosFromCnaes);
router.patch('/catalogo/produtos/:id', requireAuth, requireMeiEnabled, controller.atualizarCatalogoProduto);
router.delete('/catalogo/produtos/:id', requireAuth, requireMeiEnabled, controller.eliminarCatalogoProduto);
router.patch('/:id', requireAuth, requireMeiEnabled, controller.atualizar);
router.post('/:id/cancelar', requireAuth, requireMeiEnabled, controller.cancelar);
router.post('/:id/arquivar', requireAuth, requireMeiEnabled, controller.arquivar);
router.get('/:id/pdf', requireAuth, requireMeiEnabled, controller.downloadPdf);
router.get('/:id/xml', requireAuth, requireMeiEnabled, controller.downloadXml);
router.get('/:id', requireAuth, requireMeiEnabled, controller.detalhar);

export default router;
