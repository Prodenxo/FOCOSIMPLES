'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Trash2,
  User,
  X,
} from 'lucide-react';
import {
  applyClienteToNfseForm,
  applyClienteToNfeForm,
  applyProdutoToNfseServico,
  applyProdutoToNfeItem,
  buildNfeLikePayload,
  buildNfsePayload,
  computeNfeItemsTotal,
  getDefaultNfseForm,
  getDefaultNfeLikeForm,
  getDefaultNfeItem,
  isValidCpfCnpj,
  maskCep,
  maskCpfCnpj,
  maskMoney,
  normalizeCodigoServico,
  parseDecimal,
  parseMoney,
  validateNfeLikeForm,
  validateNfseForm,
} from '@/lib/fiscalEmit';
import {
  DESTINATARIO_IE_OPTIONS,
  NFSE_SERVICO_CODIGO_MIN_LENGTH,
} from '@/lib/fiscalEmit';
import { catalogProdutoNeedsNfseReformaCompletion } from '@/lib/nfseCatalogProdutoMetadata';
import { isCatalogProdutoUsableForNfeLike } from '@/lib/nfeCatalogProdutoMetadata';
import { recalculateNfeItemsTax } from '@/lib/recalculateNfeItemsTax';
import {
  emitirNota,
  fetchCatalogoClientes,
  fetchCatalogoProdutos,
  fetchCertificateStatus,
  fetchFiscalCompany,
  fetchNfsePrestadorPrefill,
  lookupCep,
  lookupCnpj,
} from '@/lib/fiscalApi';
import {
  empresaFiscalToPrestadorPrefill,
  isNfsePrestadorPrefillEffectivelyEmpty,
  isPrestadorPrefillStaleForCert,
  mergeNfeEmitentePrefillIntoForm,
  mergeNfsePrestadorPrefillIntoForm,
  PRESTADOR_PREFILL_MSG_EMPTY,
  PRESTADOR_PREFILL_MSG_ERROR,
} from '@/lib/nfsePrestadorPrefill';
import { formatCurrencyBRL } from '@/lib/fiscalFormat';
import { Card } from '@/components/ui/Card';
import { EmptyPanel } from '@/components/ui/EmptyPanel';
import { LoadingPanel } from '@/components/ui/LoadingPanel';

const STEPS = [
  { id: 'tipo', label: 'Tipo' },
  { id: 'tomador', label: 'Cliente' },
  { id: 'itens', label: 'Itens' },
  { id: 'revisar', label: 'Revisão' },
];

const DOCUMENT_TYPES = [
  { id: 'NFSE', label: 'NFS-e', description: 'Nota Fiscal de Serviço', icon: '📄' },
  { id: 'NFE', label: 'NF-e', description: 'Nota Fiscal Eletrônica (mercadoria)', icon: '📦' },
  { id: 'NFCE', label: 'NFC-e', description: 'Nota Fiscal de Consumidor (varejo)', icon: '🛒' },
];

/**
 * Modal de emissão de nota fiscal.
 * Fluxo: Seleção do tipo → Dados do tomador/destinatário → Itens/Serviço → Revisão → Envio.
 * Integração com catálogo de clientes/produtos via API.
 */
export function EmitirNotaModal({ onClose, onSuccess, company = null, certDocumento = null }) {
  const [step, setStep] = useState('tipo');
  const [documentType, setDocumentType] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [successData, setSuccessData] = useState(null);

  // Dados do formulário
  const [nfseForm, setNfseForm] = useState(getDefaultNfseForm);
  const [nfeForm, setNfeForm] = useState(getDefaultNfeLikeForm);

  // Catálogo
  const [clientes, setClientes] = useState([]);
  const [clientesLoading, setClientesLoading] = useState(false);
  const [clienteSearch, setClienteSearch] = useState('');
  const [showClienteList, setShowClienteList] = useState(false);

  const [produtos, setProdutos] = useState([]);
  const [produtosLoading, setProdutosLoading] = useState(false);
  const [produtoSearch, setProdutoSearch] = useState('');
  const [showProdutoList, setShowProdutoList] = useState(false);
  const [nfeItemEditIndex, setNfeItemEditIndex] = useState(0);
  const [produtoApplying, setProdutoApplying] = useState(false);
  const [catalogNotice, setCatalogNotice] = useState(null);

  const catalogDocumentType = useMemo(() => {
    if (documentType === 'NFE' || documentType === 'NFCE') return documentType;
    return 'NFSE';
  }, [documentType]);

  const nfeEmitenteUf = useMemo(
    () => String(company?.endereco?.estado || nfseForm.prestadorEndereco?.estado || '').trim().toUpperCase().slice(0, 2),
    [company?.endereco?.estado, nfseForm.prestadorEndereco?.estado],
  );

  const nfeDestinatarioUf = useMemo(
    () => String(nfeForm.destinatarioEndereco?.estado || '').trim().toUpperCase().slice(0, 2),
    [nfeForm.destinatarioEndereco?.estado],
  );

  const nfeDestinatarioTaxContext = useMemo(
    () => ({
      destinatarioDoc: nfeForm.destinatarioCpfCnpj,
      indIEDest: nfeForm.destinatarioIndIEDest,
      inscricaoEstadual: nfeForm.destinatarioInscricaoEstadual,
    }),
    [nfeForm.destinatarioCpfCnpj, nfeForm.destinatarioIndIEDest, nfeForm.destinatarioInscricaoEstadual],
  );

  // Lookup states
  const [lookingUpCnpj, setLookingUpCnpj] = useState(false);
  const [lookingUpCep, setLookingUpCep] = useState(false);

  const [prestadorPrefillLoading, setPrestadorPrefillLoading] = useState(false);
  const [prestadorPrefillBanner, setPrestadorPrefillBanner] = useState(null);
  const prestadorUserEditedRef = useRef(false);
  const emitenteUserEditedRef = useRef(false);

  const loadClientes = useCallback(async () => {
    if (!catalogDocumentType) return;
    setClientesLoading(true);
    try {
      const data = await fetchCatalogoClientes({
        q: clienteSearch,
        limit: 20,
        documentType: catalogDocumentType,
      });
      setClientes(Array.isArray(data) ? data : data?.clientes || data?.items || []);
    } catch (err) {
      console.warn('Falha ao carregar clientes:', err);
    } finally {
      setClientesLoading(false);
    }
  }, [clienteSearch, catalogDocumentType]);

  const loadProdutos = useCallback(async () => {
    if (!catalogDocumentType) return;
    setProdutosLoading(true);
    try {
      const data = await fetchCatalogoProdutos({
        q: produtoSearch,
        limit: 20,
        documentType: catalogDocumentType,
      });
      setProdutos(Array.isArray(data) ? data : data?.produtos || data?.items || []);
    } catch (err) {
      console.warn('Falha ao carregar produtos:', err);
    } finally {
      setProdutosLoading(false);
    }
  }, [produtoSearch, catalogDocumentType]);

  // Carrega clientes quando abre a lista
  useEffect(() => {
    if (showClienteList && clientes.length === 0) {
      loadClientes();
    }
  }, [showClienteList, clientes.length, loadClientes]);

  // Carrega produtos quando abre a lista ou entra no passo Itens
  useEffect(() => {
    if ((showProdutoList || step === 'itens') && documentType) {
      loadProdutos();
    }
  }, [showProdutoList, step, documentType, loadProdutos]);

  const openProdutoCatalog = useCallback((itemIndex = 0) => {
    setNfeItemEditIndex(itemIndex);
    setShowProdutoList(true);
    setCatalogNotice(null);
  }, []);

  // Prefill automático do prestador/emitente a partir do certificado PFX
  useEffect(() => {
    if (!documentType) return;
    if (documentType === 'NFSE' && prestadorUserEditedRef.current) return;
    if ((documentType === 'NFE' || documentType === 'NFCE') && emitenteUserEditedRef.current) return;

    let cancelled = false;

    (async () => {
      setPrestadorPrefillLoading(true);
      setPrestadorPrefillBanner(null);

      try {
        let empresa = company;
        let certDoc = certDocumento;

        if (!empresa || !certDoc) {
          const cert = await fetchCertificateStatus().catch(() => null);
          if (cancelled) return;
          certDoc = certDoc || cert?.documento || null;
          if (certDoc && !empresa) {
            empresa = await fetchFiscalCompany(certDoc).catch(() => null);
          }
        }

        const localPrefill = await fetchNfsePrestadorPrefill();
        if (cancelled) return;
        if (documentType === 'NFSE' && prestadorUserEditedRef.current) return;
        if ((documentType === 'NFE' || documentType === 'NFCE') && emitenteUserEditedRef.current) return;

        const empresaPrefill = empresaFiscalToPrestadorPrefill(empresa);
        const localStale = isPrestadorPrefillStaleForCert(certDoc, localPrefill);

        if (documentType === 'NFSE') {
          setNfseForm((f) => {
            let next = f;
            if (!localStale) {
              next = mergeNfsePrestadorPrefillIntoForm(f, localPrefill, { onlyFillEmpty: true });
            }
            return mergeNfsePrestadorPrefillIntoForm(next, empresaPrefill, {
              onlyFillEmpty: !localStale,
            });
          });
        } else {
          const ieExtra = { inscricaoEstadual: empresa?.inscricaoEstadual ?? null };
          setNfeForm((f) => {
            let next = mergeNfeEmitentePrefillIntoForm(f, localPrefill, ieExtra, { onlyFillEmpty: true });
            next = mergeNfeEmitentePrefillIntoForm(next, empresaPrefill, ieExtra, { onlyFillEmpty: true });
            return next;
          });
        }

        const localEmpty = localStale || isNfsePrestadorPrefillEffectivelyEmpty(localPrefill);
        const empresaEmpty = isNfsePrestadorPrefillEffectivelyEmpty(empresaPrefill);
        const hasIe = Boolean(String(empresa?.inscricaoEstadual ?? '').trim());

        if (documentType === 'NFSE') {
          if (localEmpty && empresaEmpty) {
            setPrestadorPrefillBanner(PRESTADOR_PREFILL_MSG_EMPTY);
          }
        } else if (localEmpty && empresaEmpty && !hasIe) {
          setPrestadorPrefillBanner(PRESTADOR_PREFILL_MSG_EMPTY);
        }
      } catch (err) {
        if (cancelled) return;
        console.warn('Falha no prefill do prestador:', err);

        try {
          let empresa = company;
          if (!empresa && certDocumento) {
            empresa = await fetchFiscalCompany(certDocumento).catch(() => null);
          }
          const empresaPrefill = empresaFiscalToPrestadorPrefill(empresa);
          if (!isNfsePrestadorPrefillEffectivelyEmpty(empresaPrefill)) {
            if (documentType === 'NFSE') {
              setNfseForm((f) => mergeNfsePrestadorPrefillIntoForm(f, empresaPrefill, { onlyFillEmpty: true }));
            } else {
              setNfeForm((f) => mergeNfeEmitentePrefillIntoForm(
                f,
                empresaPrefill,
                { inscricaoEstadual: empresa?.inscricaoEstadual ?? null },
                { onlyFillEmpty: true },
              ));
            }
            return;
          }
        } catch {
          /* segue banner de erro */
        }

        setPrestadorPrefillBanner(PRESTADOR_PREFILL_MSG_ERROR);
      } finally {
        if (!cancelled) setPrestadorPrefillLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [documentType, company, certDocumento]);

  const touchPrestadorFields = useCallback(() => {
    prestadorUserEditedRef.current = true;
    if (prestadorPrefillBanner) setPrestadorPrefillBanner(null);
  }, [prestadorPrefillBanner]);

  const touchEmitenteFields = useCallback(() => {
    emitenteUserEditedRef.current = true;
    if (prestadorPrefillBanner) setPrestadorPrefillBanner(null);
  }, [prestadorPrefillBanner]);

  // Funções de navegação
  const goNext = useCallback(() => {
    const idx = STEPS.findIndex((s) => s.id === step);
    if (idx < STEPS.length - 1) {
      setStep(STEPS[idx + 1].id);
      setError(null);
    }
  }, [step]);

  const goBack = useCallback(() => {
    const idx = STEPS.findIndex((s) => s.id === step);
    if (idx > 0) {
      setStep(STEPS[idx - 1].id);
      setError(null);
    }
  }, [step]);

  // Seleção do tipo de documento
  const handleSelectDocType = (type) => {
    setDocumentType(type);
    goNext();
  };

  // Lookup CNPJ (tomador/destinatário)
  const handleLookupCnpj = async (field) => {
    const form = documentType === 'NFSE' ? nfseForm : nfeForm;
    const doc = field === 'tomador'
      ? (documentType === 'NFSE' ? form.tomadorCpfCnpj : form.destinatarioCpfCnpj)
      : form.emitenteCpfCnpj;

    const digits = String(doc).replace(/\D/g, '');
    if (digits.length !== 11 && digits.length !== 14) return;

    setLookingUpCnpj(true);
    try {
      const data = await lookupCnpj(digits);
      if (data) {
        if (documentType === 'NFSE') {
          if (field === 'tomador') {
            setNfseForm((prev) => ({
              ...prev,
              tomadorRazaoSocial: data.nome || data.razaoSocial || prev.tomadorRazaoSocial,
              tomadorEmail: data.email || prev.tomadorEmail,
              tomadorEndereco: {
                ...prev.tomadorEndereco,
                logradouro: data.endereco?.logradouro || prev.tomadorEndereco.logradouro,
                numero: data.endereco?.numero || prev.tomadorEndereco.numero,
                complemento: data.endereco?.complemento || prev.tomadorEndereco.complemento,
                bairro: data.endereco?.bairro || prev.tomadorEndereco.bairro,
                cep: data.endereco?.cep || prev.tomadorEndereco.cep,
                estado: data.endereco?.uf || prev.tomadorEndereco.estado,
              },
            }));
          }
        } else {
          if (field === 'destinatario') {
            setNfeForm((prev) => ({
              ...prev,
              destinatarioRazaoSocial: data.nome || data.razaoSocial || prev.destinatarioRazaoSocial,
              destinatarioEmail: data.email || prev.destinatarioEmail,
              destinatarioEndereco: {
                ...prev.destinatarioEndereco,
                logradouro: data.endereco?.logradouro || prev.destinatarioEndereco.logradouro,
                numero: data.endereco?.numero || prev.destinatarioEndereco.numero,
                complemento: data.endereco?.complemento || prev.destinatarioEndereco.complemento,
                bairro: data.endereco?.bairro || prev.destinatarioEndereco.bairro,
                cep: data.endereco?.cep || prev.destinatarioEndereco.cep,
                estado: data.endereco?.uf || prev.destinatarioEndereco.estado,
              },
            }));
          }
        }
      }
    } catch (err) {
      console.warn('Lookup CNPJ falhou:', err);
    } finally {
      setLookingUpCnpj(false);
    }
  };

  // Lookup CEP
  const handleLookupCep = async (field, isTomador = true) => {
    const form = documentType === 'NFSE' ? nfseForm : nfeForm;
    const cep = isTomador
      ? (documentType === 'NFSE' ? form.tomadorEndereco?.cep : form.destinatarioEndereco?.cep)
      : (documentType === 'NFSE' ? form.prestadorEndereco?.cep : form.emitenteEndereco?.cep);

    const digits = String(cep).replace(/\D/g, '');
    if (digits.length !== 8) return;

    setLookingUpCep(true);
    try {
      const data = await lookupCep(digits);
      if (data) {
        if (documentType === 'NFSE') {
          if (isTomador) {
            setNfseForm((prev) => ({
              ...prev,
              tomadorEndereco: {
                ...prev.tomadorEndereco,
                logradouro: data.logradouro || prev.tomadorEndereco.logradouro,
                bairro: data.bairro || prev.tomadorEndereco.bairro,
                cep: digits,
                descricaoCidade: data.cidade || data.localidade || prev.tomadorEndereco.descricaoCidade,
                estado: data.uf || prev.tomadorEndereco.estado,
                codigoCidade: data.ibge || prev.tomadorEndereco.codigoCidade,
              },
            }));
          } else {
            setNfseForm((prev) => ({
              ...prev,
              prestadorEndereco: {
                ...prev.prestadorEndereco,
                logradouro: data.logradouro || prev.prestadorEndereco.logradouro,
                bairro: data.bairro || prev.prestadorEndereco.bairro,
                cep: digits,
                descricaoCidade: data.cidade || data.localidade || prev.prestadorEndereco.descricaoCidade,
                estado: data.uf || prev.prestadorEndereco.estado,
                codigoCidade: data.ibge || prev.prestadorEndereco.codigoCidade,
              },
            }));
          }
        } else {
          if (isTomador) {
            setNfeForm((prev) => ({
              ...prev,
              destinatarioEndereco: {
                ...prev.destinatarioEndereco,
                logradouro: data.logradouro || prev.destinatarioEndereco.logradouro,
                bairro: data.bairro || prev.destinatarioEndereco.bairro,
                cep: digits,
                descricaoCidade: data.cidade || data.localidade || prev.destinatarioEndereco.descricaoCidade,
                estado: data.uf || prev.destinatarioEndereco.estado,
                codigoCidade: data.ibge || prev.destinatarioEndereco.codigoCidade,
              },
            }));
          }
        }
      }
    } catch (err) {
      console.warn('Lookup CEP falhou:', err);
    } finally {
      setLookingUpCep(false);
    }
  };

  // Aplicar cliente do catálogo
  const handleApplyCliente = (cliente) => {
    if (documentType === 'NFSE') {
      const prefill = applyClienteToNfseForm(cliente);
      setNfseForm((prev) => ({ ...prev, ...prefill }));
    } else {
      const prefill = applyClienteToNfeForm(cliente);
      setNfeForm((prev) => ({ ...prev, ...prefill }));
    }
    setShowClienteList(false);
    setClienteSearch('');
  };

  // Aplicar produto do catálogo
  const handleApplyProduto = async (produto, itemIndex) => {
    setCatalogNotice(null);

    if (documentType === 'NFSE') {
      const prefill = applyProdutoToNfseServico(produto);
      setNfseForm((prev) => ({
        ...prev,
        servico: { ...prev.servico, ...prefill },
      }));
      if (catalogProdutoNeedsNfseReformaCompletion(produto)) {
        setCatalogNotice('Este serviço ainda não tem NBS/cIndOp. Complete no catálogo antes da emissão.');
      }
      const codigoNorm = normalizeCodigoServico(prefill.codigo);
      if (codigoNorm.length < NFSE_SERVICO_CODIGO_MIN_LENGTH) {
        setCatalogNotice(
          `Este serviço ainda não tem código LC 116 completo (mín. ${NFSE_SERVICO_CODIGO_MIN_LENGTH} dígitos). Complete o campo Código serviço.`,
        );
      }
    } else {
      const idx = itemIndex ?? nfeItemEditIndex;
      setProdutoApplying(true);
      try {
        let row = applyProdutoToNfeItem(produto);
        if (nfeEmitenteUf && nfeDestinatarioUf) {
          const [recalculated] = await recalculateNfeItemsTax(
            [row],
            nfeEmitenteUf,
            nfeDestinatarioUf,
            {
              businessType: company?.businessType || 'COMERCIO',
              destinatario: nfeDestinatarioTaxContext,
            },
          );
          if (recalculated) row = recalculated;
        }
        setNfeForm((f) => {
          const safeIdx = Math.min(Math.max(idx, 0), Math.max(f.itens.length - 1, 0));
          if (f.itens.length === 0) {
            setNfeItemEditIndex(0);
            return { ...f, itens: [row] };
          }
          return {
            ...f,
            itens: f.itens.map((it, i) => (i === safeIdx ? row : it)),
          };
        });
        if (!isCatalogProdutoUsableForNfeLike(produto, documentType)) {
          setCatalogNotice('Produto incompleto: preencha o NCM (8 dígitos) no formulário ou edite no catálogo antes de emitir.');
        }
      } finally {
        setProdutoApplying(false);
      }
    }

    setShowProdutoList(false);
    setProdutoSearch('');
  };

  // Adicionar item NF-e
  const handleAddItem = () => {
    setNfeForm((prev) => ({
      ...prev,
      itens: [...prev.itens, getDefaultNfeItem()],
    }));
  };

  // Remover item NF-e
  const handleRemoveItem = (index) => {
    setNfeForm((prev) => ({
      ...prev,
      itens: prev.itens.filter((_, i) => i !== index),
    }));
  };

  const setNestedItemField = (item, path, value) => {
    const parts = path.split('.');
    if (parts.length === 1) return { ...item, [path]: value };
    const [head, ...rest] = parts;
    return {
      ...item,
      [head]: setNestedItemField(item[head] || {}, rest.join('.'), value),
    };
  };

  // Atualizar campo do item (suporta paths aninhados como tributos.icms.csosn)
  const handleItemChange = (index, field, value) => {
    setNfeForm((prev) => {
      const newItens = [...prev.itens];
      newItens[index] = field.includes('.')
        ? setNestedItemField(newItens[index], field, value)
        : { ...newItens[index], [field]: value };
      return { ...prev, itens: newItens };
    });
  };

  // Validar antes de avançar
  const validateCurrentStep = () => {
    if (step === 'tomador') {
      if (documentType === 'NFSE') {
        const f = nfseForm;
        if (!f.prestadorCpfCnpj || f.prestadorCpfCnpj.replace(/\D/g, '').length !== 14) {
          setError('Informe o CNPJ do prestador.');
          return false;
        }
        if (!f.tomadorCpfCnpj || !isValidCpfCnpj(f.tomadorCpfCnpj)) {
          setError('Informe um CPF/CNPJ válido do tomador.');
          return false;
        }
        if (!f.tomadorRazaoSocial?.trim()) {
          setError('Informe a razão social do tomador.');
          return false;
        }
      } else {
        const f = nfeForm;
        if (!f.emitenteCpfCnpj || f.emitenteCpfCnpj.replace(/\D/g, '').length !== 14) {
          setError('Informe o CNPJ do emitente.');
          return false;
        }
        if (!f.destinatarioCpfCnpj || !isValidCpfCnpj(f.destinatarioCpfCnpj)) {
          setError('Informe um CPF/CNPJ válido do destinatário.');
          return false;
        }
        if (!f.destinatarioRazaoSocial?.trim()) {
          setError('Informe a razão social do destinatário.');
          return false;
        }
      }
    }
    if (step === 'itens') {
      if (documentType === 'NFSE') {
        const s = nfseForm.servico;
        if (!s.codigo?.trim() || !s.discriminacao?.trim() || !s.valorServico?.trim()) {
          setError('Preencha o código, discriminação e valor do serviço.');
          return false;
        }
      } else {
        if (!nfeForm.itens || nfeForm.itens.length === 0) {
          setError('Adicione ao menos um item.');
          return false;
        }
        for (let i = 0; i < nfeForm.itens.length; i++) {
          const item = nfeForm.itens[i];
          if (!item.codigo?.trim() || !item.descricao?.trim()) {
            setError(`Item ${i + 1}: código e descrição são obrigatórios.`);
            return false;
          }
        }
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      goNext();
    }
  };

  // Enviar para emissão
  const handleEmitir = async () => {
    setSending(true);
    setError(null);
    try {
      let payload;

      if (documentType === 'NFSE') {
        const validationError = validateNfseForm(nfseForm);
        if (validationError) {
          setError(validationError);
          return;
        }
        payload = {
          documentType: 'NFSE',
          ...buildNfsePayload(nfseForm),
        };
      } else {
        let form = nfeForm;
        const validationError = validateNfeLikeForm(form, documentType);
        if (validationError) {
          setError(validationError);
          return;
        }

        if (documentType === 'NFE' && nfeEmitenteUf && nfeDestinatarioUf && form.itens.length > 0) {
          try {
            const itensAtualizados = await recalculateNfeItemsTax(
              form.itens,
              nfeEmitenteUf,
              nfeDestinatarioUf,
              {
                businessType: company?.businessType || 'COMERCIO',
                destinatario: nfeDestinatarioTaxContext,
              },
            );
            form = { ...form, itens: itensAtualizados };
            setNfeForm(form);
          } catch {
            /* tributação: backend valida na emissão */
          }
        }

        payload = {
          documentType,
          ...buildNfeLikePayload(form, documentType),
        };
      }

      const result = await emitirNota(payload);
      setSuccessData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao emitir nota.');
    } finally {
      setSending(false);
    }
  };

  const currentStepIndex = STEPS.findIndex((s) => s.id === step);

  // Renderização
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[20px] border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--shadow-card)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--card-border)] px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Emitir nota fiscal</h2>
            <p className="text-xs text-[var(--text-muted)]">
              {documentType ? `${DOCUMENT_TYPES.find((t) => t.id === documentType)?.label} - Passo ${currentStepIndex + 1} de ${STEPS.length}` : 'Selecione o tipo de documento'}
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-[var(--text-muted)] hover:bg-[var(--canvas)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-between border-b border-[var(--card-border)] bg-[var(--canvas)] px-5 py-3">
          {STEPS.map((s, idx) => (
            <div key={s.id} className="flex items-center">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                  idx < currentStepIndex
                    ? 'bg-[var(--accent)] text-white'
                    : idx === currentStepIndex
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--card-border)] text-[var(--text-muted)]'
                }`}
              >
                {idx < currentStepIndex ? <Check className="h-4 w-4" /> : idx + 1}
              </div>
              <span className={`ml-2 text-xs font-medium ${idx <= currentStepIndex ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
                {s.label}
              </span>
              {idx < STEPS.length - 1 && <ChevronRight className="mx-2 h-4 w-4 text-[var(--text-muted)]" />}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {successData ? (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <Check className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-xl font-semibold text-[var(--text-primary)]">Nota emitida com sucesso!</h3>
              <p className="text-sm text-[var(--text-muted)]">
                Sua nota foi enviada para processamento. Você receberá uma confirmação em breve.
              </p>
              {successData.documento && (
                <p className="text-lg font-mono font-semibold text-[var(--accent)]">
                  {successData.documento}
                </p>
              )}
              <button
                onClick={() => {
                  onSuccess?.(successData);
                  onClose();
                }}
                className="mt-4 inline-flex h-10 items-center gap-2 rounded-[12px] bg-[var(--accent)] px-6 text-sm font-semibold text-white"
              >
                Fechar
              </button>
            </div>
          ) : step === 'tipo' ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {DOCUMENT_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => handleSelectDocType(type.id)}
                  className="flex flex-col items-center gap-3 rounded-[16px] border border-[var(--card-border)] bg-[var(--canvas)] p-5 text-center transition-all hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
                >
                  <span className="text-3xl">{type.icon}</span>
                  <div>
                    <p className="font-semibold text-[var(--text-primary)]">{type.label}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{type.description}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : step === 'tomador' ? (
            documentType === 'NFSE' ? (
              <NfseTomadorForm
                form={nfseForm}
                setForm={setNfseForm}
                onLookupCnpj={() => handleLookupCnpj('tomador')}
                onLookupCep={() => handleLookupCep('prestador', false)}
                onLookupTomadorCep={() => handleLookupCep('tomador', true)}
                lookingUpCnpj={lookingUpCnpj}
                lookingUpCep={lookingUpCep}
                showClienteList={showClienteList}
                setShowClienteList={setShowClienteList}
                clienteSearch={clienteSearch}
                setClienteSearch={setClienteSearch}
                clientes={clientes}
                clientesLoading={clientesLoading}
                onApplyCliente={handleApplyCliente}
                loadClientes={loadClientes}
                onPrestadorEdit={touchPrestadorFields}
                prefillLoading={prestadorPrefillLoading}
                prefillBanner={prestadorPrefillBanner}
              />
            ) : (
              <NfeDestinatarioForm
                form={nfeForm}
                setForm={setNfeForm}
                documentType={documentType}
                onLookupCnpj={() => handleLookupCnpj('destinatario')}
                onLookupCep={() => handleLookupCep('destinatario', true)}
                lookingUpCnpj={lookingUpCnpj}
                lookingUpCep={lookingUpCep}
                showClienteList={showClienteList}
                setShowClienteList={setShowClienteList}
                clienteSearch={clienteSearch}
                setClienteSearch={setClienteSearch}
                clientes={clientes}
                clientesLoading={clientesLoading}
                onApplyCliente={handleApplyCliente}
                loadClientes={loadClientes}
                onEmitenteEdit={touchEmitenteFields}
                prefillLoading={prestadorPrefillLoading}
                prefillBanner={prestadorPrefillBanner}
              />
            )
          ) : step === 'itens' ? (
            <>
              {catalogNotice ? (
                <div className="mb-4 rounded-[12px] border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                  {catalogNotice}
                </div>
              ) : null}
              {documentType === 'NFSE' ? (
                <NfseServicoForm
                  form={nfseForm}
                  setForm={setNfseForm}
                  showProdutoList={showProdutoList}
                  setShowProdutoList={setShowProdutoList}
                  produtoSearch={produtoSearch}
                  setProdutoSearch={setProdutoSearch}
                  produtos={produtos}
                  produtosLoading={produtosLoading || produtoApplying}
                  onApplyProduto={(p) => handleApplyProduto(p, 0)}
                  loadProdutos={loadProdutos}
                />
              ) : (
                <NfeItensForm
                  form={nfeForm}
                  setForm={setNfeForm}
                  onAddItem={handleAddItem}
                  onRemoveItem={handleRemoveItem}
                  onItemChange={handleItemChange}
                  showProdutoList={showProdutoList}
                  setShowProdutoList={setShowProdutoList}
                  produtoSearch={produtoSearch}
                  setProdutoSearch={setProdutoSearch}
                  produtos={produtos}
                  produtosLoading={produtosLoading || produtoApplying}
                  onApplyProduto={handleApplyProduto}
                  loadProdutos={loadProdutos}
                  nfeItemEditIndex={nfeItemEditIndex}
                  onOpenCatalog={openProdutoCatalog}
                />
              )}
            </>
          ) : step === 'revisar' ? (
            <ReviewStep
              documentType={documentType}
              nfseForm={nfseForm}
              nfeForm={nfeForm}
            />
          ) : null}

          {/* Error */}
          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-[12px] border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        {!successData && (
          <div className="flex items-center justify-between border-t border-[var(--card-border)] px-5 py-4">
            <button
              onClick={step === 'tipo' ? onClose : goBack}
              className="inline-flex h-10 items-center gap-2 rounded-[12px] border border-[var(--card-border)] bg-[var(--card-bg)] px-4 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--canvas)]"
            >
              <ArrowLeft className="h-4 w-4" />
              {step === 'tipo' ? 'Cancelar' : 'Voltar'}
            </button>
            {step === 'revisar' ? (
              <button
                onClick={handleEmitir}
                disabled={sending}
                className="inline-flex h-10 items-center gap-2 rounded-[12px] bg-[var(--accent)] px-6 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Emitir nota
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="inline-flex h-10 items-center gap-2 rounded-[12px] bg-[var(--accent)] px-6 text-sm font-semibold text-white hover:opacity-90"
              >
                Continuar
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Componentes de formulário auxiliares

function NfseTomadorForm({
  form, setForm, onLookupCnpj, onLookupCep, onLookupTomadorCep, lookingUpCnpj, lookingUpCep,
  showClienteList, setShowClienteList, clienteSearch, setClienteSearch, clientes, clientesLoading,
  onApplyCliente, loadClientes, onPrestadorEdit, prefillLoading, prefillBanner,
}) {
  const handleChange = (field, value) => {
    onPrestadorEdit?.();
    setForm((prev) => ({ ...prev, [field]: value }));
  };
  const handleEnderecoChange = (field, value) => {
    onPrestadorEdit?.();
    setForm((prev) => ({ ...prev, prestadorEndereco: { ...prev.prestadorEndereco, [field]: value } }));
  };
  const handleTomadorEnderecoChange = (field, value) => {
    setForm((prev) => ({ ...prev, tomadorEndereco: { ...prev.tomadorEndereco, [field]: value } }));
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Prestador (Empresa) */}
      <div className="rounded-[16px] border border-[var(--card-border)] p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
          <Building2 className="h-4 w-4" /> Dados do Prestador (Sua empresa)
          {prefillLoading ? <Loader2 className="h-4 w-4 animate-spin text-[var(--text-muted)]" /> : null}
        </h3>
        {prefillBanner ? (
          <div className="mb-3 rounded-[10px] border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
            {prefillBanner}
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="CNPJ" value={form.prestadorCpfCnpj} onChange={(v) => handleChange('prestadorCpfCnpj', maskCpfCnpj(v))} placeholder="00.000.000/0001-00" />
          <Input label="Razão Social" value={form.prestadorRazaoSocial} onChange={(v) => handleChange('prestadorRazaoSocial', v)} placeholder="Nome da empresa" />
          <Input label="Inscrição Municipal" value={form.prestadorInscricaoMunicipal} onChange={(v) => handleChange('prestadorInscricaoMunicipal', v)} placeholder="IM" />
          <Input label="Email" value={form.prestadorEmail} onChange={(v) => handleChange('prestadorEmail', v)} placeholder="email@empresa.com" />
          <div className="sm:col-span-2">
            <Input label="Logradouro" value={form.prestadorEndereco.logradouro} onChange={(v) => handleEnderecoChange('logradouro', v)} placeholder="Rua, Av., etc." />
          </div>
          <Input label="Número" value={form.prestadorEndereco.numero} onChange={(v) => handleEnderecoChange('numero', v)} placeholder="123" />
          <Input label="CEP" value={form.prestadorEndereco.cep} onChange={(v) => handleEnderecoChange('cep', maskCep(v))} placeholder="00000-000" onBlur={onLookupCep} icon={lookingUpCep ? Loader2 : Search} iconSpin={lookingUpCep} />
          <Input label="Bairro" value={form.prestadorEndereco.bairro} onChange={(v) => handleEnderecoChange('bairro', v)} />
          <Input label="Cidade" value={form.prestadorEndereco.descricaoCidade} onChange={(v) => handleEnderecoChange('descricaoCidade', v)} placeholder="Cidade" />
          <Input label="UF" value={form.prestadorEndereco.estado} onChange={(v) => handleEnderecoChange('estado', v.toUpperCase().slice(0, 2))} placeholder="SP" maxLength={2} />
          <Input label="Código IBGE" value={form.prestadorEndereco.codigoCidade} onChange={(v) => handleEnderecoChange('codigoCidade', v.replace(/\D/g, ''))} placeholder="3550308" />
        </div>
      </div>

      {/* Tomador (Cliente) */}
      <div className="rounded-[16px] border border-[var(--card-border)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <User className="h-4 w-4" /> Dados do Tomador (Cliente)
          </h3>
          <button
            type="button"
            onClick={() => setShowClienteList(!showClienteList)}
            className="text-xs text-[var(--accent)] hover:underline"
          >
            {showClienteList ? 'Ocultar catálogo' : 'Buscar no catálogo'}
          </button>
        </div>

        {showClienteList && (
          <div className="mb-3 rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] p-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={clienteSearch}
                onChange={(e) => setClienteSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadClientes()}
                placeholder="Buscar por nome ou documento..."
                className="flex-1 rounded-[8px] border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm"
              />
              <button onClick={loadClientes} className="rounded-[8px] bg-[var(--accent)] px-3 text-white">
                <Search className="h-4 w-4" />
              </button>
            </div>
            {clientesLoading ? (
              <div className="py-4 text-center text-xs text-[var(--text-muted)]">Carregando...</div>
            ) : clientes.length > 0 ? (
              <ul className="mt-2 max-h-32 overflow-y-auto">
                {clientes.slice(0, 5).map((c) => (
                  <li key={c.id || c.documento}>
                    <button
                      type="button"
                      onClick={() => onApplyCliente(c)}
                      className="w-full truncate px-2 py-1 text-left text-xs hover:bg-[var(--card-bg)]"
                    >
                      <span className="font-medium">{c.nome || c.razaoSocial}</span>
                      <span className="text-[var(--text-muted)]"> - {c.documento}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-2 text-center text-xs text-[var(--text-muted)]">Nenhum cliente encontrado</div>
            )}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="relative">
            <Input label="CPF/CNPJ" value={form.tomadorCpfCnpj} onChange={(v) => handleChange('tomadorCpfCnpj', maskCpfCnpj(v))} placeholder="000.000.000-00" onBlur={onLookupCnpj} icon={lookingUpCnpj ? Loader2 : Search} iconSpin={lookingUpCnpj} />
          </div>
          <Input label="Razão Social / Nome" value={form.tomadorRazaoSocial} onChange={(v) => handleChange('tomadorRazaoSocial', v)} placeholder="Nome do cliente" />
          <Input label="Email" value={form.tomadorEmail} onChange={(v) => handleChange('tomadorEmail', v)} placeholder="email@cliente.com" className="sm:col-span-2" />
          <div className="sm:col-span-2">
            <Input label="Logradouro" value={form.tomadorEndereco.logradouro} onChange={(v) => handleTomadorEnderecoChange('logradouro', v)} placeholder="Rua, Av., etc." />
          </div>
          <Input label="Número" value={form.tomadorEndereco.numero} onChange={(v) => handleTomadorEnderecoChange('numero', v)} placeholder="123" />
          <Input label="CEP" value={form.tomadorEndereco.cep} onChange={(v) => handleTomadorEnderecoChange('cep', maskCep(v))} placeholder="00000-000" onBlur={onLookupTomadorCep} icon={lookingUpCep ? Loader2 : Search} iconSpin={lookingUpCep} />
          <Input label="Bairro" value={form.tomadorEndereco.bairro} onChange={(v) => handleTomadorEnderecoChange('bairro', v)} />
          <Input label="Cidade" value={form.tomadorEndereco.descricaoCidade} onChange={(v) => handleTomadorEnderecoChange('descricaoCidade', v)} />
          <Input label="UF" value={form.tomadorEndereco.estado} onChange={(v) => handleTomadorEnderecoChange('estado', v.toUpperCase().slice(0, 2))} placeholder="SP" maxLength={2} />
          <Input label="Código IBGE" value={form.tomadorEndereco.codigoCidade} onChange={(v) => handleTomadorEnderecoChange('codigoCidade', v.replace(/\D/g, ''))} placeholder="3550308" />
        </div>
      </div>
    </div>
  );
}

function NfeDestinatarioForm({
  form, setForm, documentType, onLookupCnpj, onLookupCep, lookingUpCnpj, lookingUpCep,
  showClienteList, setShowClienteList, clienteSearch, setClienteSearch, clientes, clientesLoading,
  onApplyCliente, loadClientes, onEmitenteEdit, prefillLoading, prefillBanner,
}) {
  const handleChange = (field, value) => {
    if (field.startsWith('emitente')) onEmitenteEdit?.();
    setForm((prev) => ({ ...prev, [field]: value }));
  };
  const handleEmitenteChange = (field, value) => {
    onEmitenteEdit?.();
    setForm((prev) => ({ ...prev, [field]: value }));
  };
  const handleEnderecoChange = (field, value) => {
    setForm((prev) => ({ ...prev, destinatarioEndereco: { ...prev.destinatarioEndereco, [field]: value } }));
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Emitente */}
      <div className="rounded-[16px] border border-[var(--card-border)] p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
          <Building2 className="h-4 w-4" /> Dados do Emitente (Sua empresa)
          {prefillLoading ? <Loader2 className="h-4 w-4 animate-spin text-[var(--text-muted)]" /> : null}
        </h3>
        {prefillBanner ? (
          <div className="mb-3 rounded-[10px] border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
            {prefillBanner}
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="CNPJ" value={form.emitenteCpfCnpj} onChange={(v) => handleEmitenteChange('emitenteCpfCnpj', maskCpfCnpj(v))} placeholder="00.000.000/0001-00" />
          <Input label="Razão Social" value={form.emitenteRazaoSocial} onChange={(v) => handleEmitenteChange('emitenteRazaoSocial', v)} placeholder="Nome da empresa" />
          <Input label="Inscrição Estadual" value={form.emitenteInscricaoEstadual} onChange={(v) => handleEmitenteChange('emitenteInscricaoEstadual', v)} placeholder="ISENTO ou número da IE" className="sm:col-span-2" />
        </div>
      </div>

      {/* Destinatário */}
      <div className="rounded-[16px] border border-[var(--card-border)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <User className="h-4 w-4" /> Dados do Destinatário (Cliente)
          </h3>
          <button
            type="button"
            onClick={() => setShowClienteList(!showClienteList)}
            className="text-xs text-[var(--accent)] hover:underline"
          >
            {showClienteList ? 'Ocultar catálogo' : 'Buscar no catálogo'}
          </button>
        </div>

        {showClienteList && (
          <div className="mb-3 rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] p-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={clienteSearch}
                onChange={(e) => setClienteSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadClientes()}
                placeholder="Buscar por nome ou documento..."
                className="flex-1 rounded-[8px] border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm"
              />
              <button onClick={loadClientes} className="rounded-[8px] bg-[var(--accent)] px-3 text-white">
                <Search className="h-4 w-4" />
              </button>
            </div>
            {clientesLoading ? (
              <div className="py-4 text-center text-xs text-[var(--text-muted)]">Carregando...</div>
            ) : clientes.length > 0 ? (
              <ul className="mt-2 max-h-32 overflow-y-auto">
                {clientes.slice(0, 5).map((c) => (
                  <li key={c.id || c.documento}>
                    <button
                      type="button"
                      onClick={() => onApplyCliente(c)}
                      className="w-full truncate px-2 py-1 text-left text-xs hover:bg-[var(--card-bg)]"
                    >
                      <span className="font-medium">{c.nome || c.razaoSocial}</span>
                      <span className="text-[var(--text-muted)]"> - {c.documento}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-2 text-center text-xs text-[var(--text-muted)]">Nenhum cliente encontrado</div>
            )}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="relative">
            <Input label="CPF/CNPJ" value={form.destinatarioCpfCnpj} onChange={(v) => handleChange('destinatarioCpfCnpj', maskCpfCnpj(v))} placeholder="000.000.000-00" onBlur={onLookupCnpj} icon={lookingUpCnpj ? Loader2 : Search} iconSpin={lookingUpCnpj} />
          </div>
          <Input label="Razão Social / Nome" value={form.destinatarioRazaoSocial} onChange={(v) => handleChange('destinatarioRazaoSocial', v)} placeholder="Nome do cliente" />
          <Input label="Email" value={form.destinatarioEmail} onChange={(v) => handleChange('destinatarioEmail', v)} placeholder="email@cliente.com" className="sm:col-span-2" />

          {/* IE e indicador */}
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Indicador de IE</label>
            <select
              value={form.destinatarioIndIEDest}
              onChange={(e) => handleChange('destinatarioIndIEDest', e.target.value)}
              className="w-full rounded-[10px] border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm"
            >
              {DESTINATARIO_IE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          {form.destinatarioIndIEDest === '1' && (
            <Input label="Inscrição Estadual" value={form.destinatarioInscricaoEstadual} onChange={(v) => handleChange('destinatarioInscricaoEstadual', v)} placeholder="Número da IE" />
          )}

          {/* Endereço - apenas NF-e */}
          {documentType === 'NFE' && (
            <>
              <div className="sm:col-span-2">
                <Input label="Logradouro" value={form.destinatarioEndereco.logradouro} onChange={(v) => handleEnderecoChange('logradouro', v)} placeholder="Rua, Av., etc." />
              </div>
              <Input label="Número" value={form.destinatarioEndereco.numero} onChange={(v) => handleEnderecoChange('numero', v)} placeholder="123" />
              <Input label="CEP" value={form.destinatarioEndereco.cep} onChange={(v) => handleEnderecoChange('cep', maskCep(v))} placeholder="00000-000" onBlur={onLookupCep} icon={lookingUpCep ? Loader2 : Search} iconSpin={lookingUpCep} />
              <Input label="Bairro" value={form.destinatarioEndereco.bairro} onChange={(v) => handleEnderecoChange('bairro', v)} />
              <Input label="Cidade" value={form.destinatarioEndereco.descricaoCidade} onChange={(v) => handleEnderecoChange('descricaoCidade', v)} />
              <Input label="UF" value={form.destinatarioEndereco.estado} onChange={(v) => handleEnderecoChange('estado', v.toUpperCase().slice(0, 2))} placeholder="SP" maxLength={2} />
              <Input label="Código IBGE" value={form.destinatarioEndereco.codigoCidade} onChange={(v) => handleEnderecoChange('codigoCidade', v.replace(/\D/g, ''))} placeholder="3550308" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function NfseServicoForm({ form, setForm, showProdutoList, setShowProdutoList, produtoSearch, setProdutoSearch, produtos, produtosLoading, onApplyProduto, loadProdutos }) {
  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, servico: { ...prev.servico, [field]: value } }));
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-[16px] border border-[var(--card-border)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Dados do Serviço</h3>
          <button
            type="button"
            onClick={() => setShowProdutoList(!showProdutoList)}
            className="text-xs text-[var(--accent)] hover:underline"
          >
            {showProdutoList ? 'Ocultar catálogo' : 'Buscar no catálogo'}
          </button>
        </div>

        {showProdutoList && (
          <div className="mb-3 rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] p-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={produtoSearch}
                onChange={(e) => setProdutoSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadProdutos()}
                placeholder="Buscar serviço..."
                className="flex-1 rounded-[8px] border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm"
              />
              <button onClick={loadProdutos} className="rounded-[8px] bg-[var(--accent)] px-3 text-white">
                <Search className="h-4 w-4" />
              </button>
            </div>
            {produtosLoading ? (
              <div className="py-4 text-center text-xs text-[var(--text-muted)]">Carregando...</div>
            ) : produtos.length > 0 ? (
              <ul className="mt-2 max-h-32 overflow-y-auto">
                {produtos.slice(0, 5).map((p) => (
                  <li key={p.id || p.codigo}>
                    <button
                      type="button"
                      onClick={() => onApplyProduto(p)}
                      className="w-full truncate px-2 py-1 text-left text-xs hover:bg-[var(--card-bg)]"
                    >
                      <span className="font-medium">{p.discriminacao || p.nome}</span>
                      <span className="text-[var(--text-muted)]"> - {p.codigo}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-2 text-center text-xs text-[var(--text-muted)]">Nenhum serviço encontrado</div>
            )}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Código do Serviço (LC 116)" value={form.servico.codigo} onChange={(v) => handleChange('codigo', v)} placeholder="171901" hint="Código sem pontos (mín. 6 dígitos)" />
          <Input label="CNAE" value={form.servico.cnae} onChange={(v) => handleChange('cnae', v.replace(/\D/g, ''))} placeholder="4530701" />
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Discriminação do Serviço *</label>
            <textarea
              value={form.servico.discriminacao}
              onChange={(e) => handleChange('discriminacao', e.target.value)}
              rows={3}
              placeholder="Descreva o serviço prestado..."
              className="w-full rounded-[10px] border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm"
            />
          </div>
          <Input label="Valor do Serviço (R$)" value={form.servico.valorServico} onChange={(v) => handleChange('valorServico', maskMoney(v))} placeholder="0,00" />
          <Input label="Alíquota ISS (%)" value={form.servico.aliquota} onChange={(v) => handleChange('aliquota', v)} placeholder="5" />
          <Input label="Código NBS" value={form.servico.codigoNbs} onChange={(v) => handleChange('codigoNbs', v.replace(/\D/g, '').slice(0, 9))} placeholder="9 dígitos" hint="Reforma Tributária (quando exigido)" />
          <Input label="cIndOp" value={form.servico.cIndOp} onChange={(v) => handleChange('cIndOp', v.replace(/\D/g, '').slice(0, 6))} placeholder="6 dígitos" hint="Indicador de operação (Reforma Tributária)" />
        </div>
      </div>

      {/* Informações adicionais */}
      <div className="rounded-[16px] border border-[var(--card-border)] p-4">
        <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Opções</h3>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.enviarEmail}
            onChange={(e) => setForm((prev) => ({ ...prev, enviarEmail: e.target.checked }))}
            className="h-4 w-4 rounded border-[var(--card-border)] text-[var(--accent)]"
          />
          <span className="text-[var(--text-primary)]">Enviar nota por email ao tomador</span>
        </label>
        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Informações complementares</label>
          <textarea
            value={form.informacoesComplementares}
            onChange={(e) => setForm((prev) => ({ ...prev, informacoesComplementares: e.target.value }))}
            rows={2}
            placeholder="Observações adicionais..."
            className="w-full rounded-[10px] border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm"
          />
        </div>
      </div>
    </div>
  );
}

function NfeItensForm({
  form,
  setForm,
  onAddItem,
  onRemoveItem,
  onItemChange,
  showProdutoList,
  setShowProdutoList,
  produtoSearch,
  setProdutoSearch,
  produtos,
  produtosLoading,
  onApplyProduto,
  loadProdutos,
  nfeItemEditIndex,
  onOpenCatalog,
}) {
  const total = computeNfeItemsTotal(form.itens);

  return (
    <div className="flex flex-col gap-5">
      {/* Lista de produtos/catálogo flutuante */}
      {showProdutoList && (
        <div className="rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] p-3">
          <p className="mb-2 text-xs font-medium text-[var(--text-muted)]">
            Selecionando produto para o Item {nfeItemEditIndex + 1}
          </p>
          <div className="mb-2 flex gap-2">
            <input
              type="text"
              value={produtoSearch}
              onChange={(e) => setProdutoSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadProdutos()}
              placeholder="Buscar produto..."
              className="flex-1 rounded-[8px] border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm"
            />
            <button onClick={loadProdutos} className="rounded-[8px] bg-[var(--accent)] px-3 text-white">
              <Search className="h-4 w-4" />
            </button>
            <button onClick={() => setShowProdutoList(false)} className="rounded-[8px] border border-[var(--card-border)] px-2 text-[var(--text-muted)]">
              <X className="h-4 w-4" />
            </button>
          </div>
          {produtosLoading ? (
            <div className="py-2 text-center text-xs text-[var(--text-muted)]">Carregando...</div>
          ) : produtos.length > 0 ? (
            <ul className="max-h-32 overflow-y-auto">
              {produtos.slice(0, 8).map((p) => (
                <li key={p.id || p.codigo}>
                  <button
                    type="button"
                    onClick={() => onApplyProduto(p, nfeItemEditIndex)}
                    className="w-full truncate px-2 py-1 text-left text-xs hover:bg-[var(--card-bg)]"
                  >
                    <span className="font-medium">{p.discriminacao || p.descricao || p.nome}</span>
                    <span className="text-[var(--text-muted)]"> - {p.codigo || p.ncm}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-2 text-center text-xs text-[var(--text-muted)]">Nenhum produto encontrado</div>
          )}
        </div>
      )}

      {/* Itens */}
      {form.itens.map((item, idx) => (
        <div
          key={idx}
          className={`relative rounded-[16px] border p-4 ${
            showProdutoList && nfeItemEditIndex === idx
              ? 'border-[var(--accent)]'
              : 'border-[var(--card-border)]'
          }`}
        >
          <div className="absolute right-2 top-2 flex items-center gap-1">
            <button
              type="button"
              onClick={() => onOpenCatalog(idx)}
              className="rounded-[8px] px-2 py-1 text-xs text-[var(--accent)] hover:bg-[var(--accent-soft)]"
            >
              Buscar no catálogo
            </button>
            {form.itens.length > 1 && (
              <button
                type="button"
                onClick={() => onRemoveItem(idx)}
                className="rounded-full p-1 text-red-500 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
          <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Item {idx + 1}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Código" value={item.codigo} onChange={(v) => onItemChange(idx, 'codigo', v)} placeholder="Código do produto" />
            <Input label="NCM" value={item.ncm} onChange={(v) => onItemChange(idx, 'ncm', v.replace(/\D/g, '').slice(0, 8))} placeholder="00000000" hint="8 dígitos" />
            <div className="sm:col-span-2">
              <Input label="Descrição" value={item.descricao} onChange={(v) => onItemChange(idx, 'descricao', v)} placeholder="Descrição do produto" />
            </div>
            <Input label="CFOP" value={item.cfop} onChange={(v) => onItemChange(idx, 'cfop', v.replace(/\D/g, '').slice(0, 4))} placeholder="5102" />
            <Input label="Unidade" value={item.unidade} onChange={(v) => onItemChange(idx, 'unidade', v)} placeholder="UN" />
            <Input label="Quantidade" value={item.quantidade} onChange={(v) => onItemChange(idx, 'quantidade', v)} placeholder="1" />
            <Input label="Valor Unitário (R$)" value={item.valorUnitario} onChange={(v) => onItemChange(idx, 'valorUnitario', maskMoney(v))} placeholder="0,00" />
            <Input label="Desconto (R$)" value={item.desconto} onChange={(v) => onItemChange(idx, 'desconto', maskMoney(v))} placeholder="0,00" />

            {/* Impostos */}
            <div className="sm:col-span-2 rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] p-3">
              <p className="mb-2 text-xs font-semibold text-[var(--text-muted)]">Tributos (simplificado)</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <Input label="CSOSN ICMS" value={item.tributos?.icms?.csosn} onChange={(v) => onItemChange(idx, 'tributos.icms.csosn', v)} placeholder="102" />
                <Input label="CST PIS" value={item.tributos?.pis?.cst} onChange={(v) => onItemChange(idx, 'tributos.pis.cst', v)} placeholder="49" />
                <Input label="CST COFINS" value={item.tributos?.cofins?.cst} onChange={(v) => onItemChange(idx, 'tributos.cofins.cst', v)} placeholder="49" />
              </div>
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={onAddItem}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-[12px] border border-dashed border-[var(--card-border)] text-sm font-medium text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
      >
        <Plus className="h-4 w-4" />
        Adicionar item
      </button>

      <div className="flex items-center justify-between rounded-[16px] bg-[var(--canvas)] p-4">
        <span className="text-sm font-medium text-[var(--text-muted)]">Total</span>
        <span className="text-xl font-bold text-[var(--accent)]">{formatCurrencyBRL(total)}</span>
      </div>

      {/* Opções */}
      <div className="rounded-[16px] border border-[var(--card-border)] p-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.enviarEmail}
            onChange={(e) => setForm((prev) => ({ ...prev, enviarEmail: e.target.checked }))}
            className="h-4 w-4 rounded border-[var(--card-border)] text-[var(--accent)]"
          />
          <span className="text-[var(--text-primary)]">Enviar nota por email ao destinatário</span>
        </label>
        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Informações complementares</label>
          <textarea
            value={form.informacoesComplementares}
            onChange={(e) => setForm((prev) => ({ ...prev, informacoesComplementares: e.target.value }))}
            rows={2}
            placeholder="Observações adicionais..."
            className="w-full rounded-[10px] border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm"
          />
        </div>
      </div>
    </div>
  );
}

function ReviewStep({ documentType, nfseForm, nfeForm }) {
  const form = documentType === 'NFSE' ? nfseForm : nfeForm;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[16px] border border-[var(--card-border)] bg-[var(--canvas)] p-4">
        <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Resumo da emissão</h3>

        {documentType === 'NFSE' ? (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Tipo:</span>
              <span className="font-medium text-[var(--text-primary)]">NFS-e (Nota Fiscal de Serviço)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Prestador:</span>
              <span className="font-medium text-[var(--text-primary)]">{nfseForm.prestadorCpfCnpj} - {nfseForm.prestadorRazaoSocial || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Tomador:</span>
              <span className="font-medium text-[var(--text-primary)]">{nfseForm.tomadorCpfCnpj} - {nfseForm.tomadorRazaoSocial}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Serviço:</span>
              <span className="font-medium text-[var(--text-primary)]">{nfseForm.servico.codigo} - {nfseForm.servico.discriminacao?.slice(0, 40)}...</span>
            </div>
            <div className="flex justify-between border-t border-[var(--card-border)] pt-2">
              <span className="text-[var(--text-muted)]">Valor:</span>
              <span className="font-bold text-[var(--accent)]">{formatCurrencyBRL(parseMoney(nfseForm.servico.valorServico || '0'))}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Tipo:</span>
              <span className="font-medium text-[var(--text-primary)]">
                {documentType === 'NFE' ? 'NF-e (mercadoria)' : 'NFC-e (consumidor)'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Emitente:</span>
              <span className="font-medium text-[var(--text-primary)]">{nfeForm.emitenteCpfCnpj} - {nfeForm.emitenteRazaoSocial || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Destinatário:</span>
              <span className="font-medium text-[var(--text-primary)]">{nfeForm.destinatarioCpfCnpj} - {nfeForm.destinatarioRazaoSocial}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Itens:</span>
              <span className="font-medium text-[var(--text-primary)]">{nfeForm.itens.length} produto(s)</span>
            </div>
            <div className="flex justify-between border-t border-[var(--card-border)] pt-2">
              <span className="text-[var(--text-muted)]">Total:</span>
              <span className="font-bold text-[var(--accent)]">{formatCurrencyBRL(computeNfeItemsTotal(nfeForm.itens))}</span>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-[12px] border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
        <p className="font-medium">Atenção</p>
        <p>Após o envio, a nota será processada. Você receberá uma confirmação quando for autorizada.</p>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, onBlur, placeholder, hint, className = '', maxLength, icon: Icon, iconSpin }) {
  return (
    <div className={className}>
      {label && <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">{label}</label>}
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          maxLength={maxLength}
          className="w-full rounded-[10px] border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 pr-8 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
        />
        {Icon && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
            {iconSpin ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
          </span>
        )}
      </div>
      {hint && <p className="mt-1 text-[10px] text-[var(--text-muted)]">{hint}</p>}
    </div>
  );
}
