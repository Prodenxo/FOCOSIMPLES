import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  TextInput,
  Modal,
  Alert,
  Linking,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  FlatList,
  useWindowDimensions,
} from 'react-native';
import { useAppToastStore } from '../store/appToastStore';
import {
  getMeiCertificateUploadToast,
} from '../lib/meiCertificateUpload'
import { formatApiNetworkError } from '../lib/apiNetworkError';
import { alertDialog } from '../lib/confirmDialog';
import { APP_BRAND_NAME } from '../lib/appBrand';
import { resolveAppOrigin } from '../lib/appOrigin';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CertificateIcon } from '../components/icons/CertificateIcon';
import { presentDownloadedFile } from '../lib/platformDownload';
import { getWebScrollbarStyle } from '../lib/webScrollbar';
import { BlurView } from 'expo-blur';
import { useThemeStore } from '../store/themeStore';
import { getTheme, mfRadius, mfSpacing } from '../lib/theme';
import { useAuthStore } from '../store/authStore';
import { formatCurrencyBR } from '../lib/numberFormat';
import {
  fetchMeiCertificateStatus,
  downloadMeiGuide,
  fetchMeiPeriods,
  fetchMeiPeriodsByCnpj,
  createMeiGuide,
  regenerateMeiGuide,
  saveMeiGuidePdfFromBase64,
  validateMeiGuide,
  uploadMeiCertificate,
  removeMeiCertificate,
  fetchParcelamentos,
  fetchParcelamentoParcelas,
  downloadParcelamentoPdf,
  isMeiPeriodVencida,
  type MeiPeriod,
  type ParcelamentoItem,
  type ParcelamentoParcelaOption,
} from '../services/guidesMeiService';
import {
  fetchSimplesDasPeriods,
  gerarSimplesDas,
  downloadSimplesDas,
  SIMPLES_DAS_PORTAL_FALLBACK,
} from '../services/simplesDasService';
import {
  listarNfse,
  obterNfse,
  baixarNfsePdf,
  baixarNfseXml,
  cancelarNfse,
  arquivarNfse,
  atualizarNfse,
  fetchLimiteFaturamentoMei,
  notaFiscalPodeSincronizarEstadoEmissor,
  emitirNfse,
  emitirNfe,
  emitirNfce,
  listarCatalogoNfseClientes,
  listarCatalogoNfseProdutos,
  cadastrarPlugNotasCertificado,
  cadastrarPlugNotasEmpresa,
  atualizarPlugNotasEmpresa,
  consultarEmpresaFiscal,
  lookupCnpj,
  type EmpresaFiscalData,
  type EmpresaFiscalEndereco,
  type NfseRecord,
  type DocumentType,
  type EmitirNfseInput,
  type NfseCatalogCliente,
  type NfseCatalogProduto,
  type CnpjLookupCnaeItem,
} from '../services/meiNotasService';
import {
  getNfseStatusKey,
  isHiddenNfseE0014RejectedRecord,
  extractNfseFailureMessage,
  notaFiscalStatusPrecisaSyncAutomatico,
  buildClienteCatalogLabel,
  buildProdutoCatalogLabel,
} from '../lib/meiFormatters';
import { confirmDialog } from '../lib/confirmDialog';
import { NotaFiscalRowActions } from '../components/NotaFiscalRowActions';
import { NotaFiscalFailureBanner } from '../components/NotaFiscalFailureBanner';
import { getNotaCardAccentColor, NotaFiscalListRowHeader } from '../components/NotaFiscalListRowHeader';
import {
  clearMeiOverviewCache,
  readMeiOverviewParcelamentos,
  readMeiOverviewPeriods,
  writeMeiOverviewParcelamentos,
  writeMeiOverviewPeriods,
} from '../lib/meiOverviewCache';
import {
  getDefaultPlugNotasCompanyForm,
  getPlugNotasCompanyValidationMessage,
  buildPlugNotasEmpresaPayload,
  empresaFiscalToCompanyForm,
  type PlugNotasCompanyForm,
} from '../lib/plugNotasEmpresaForm';
import {
  getNfseValidationMessage,
  getNfeLikeValidationMessage,
  buildNfeLikePayloadFromForm,
  getDefaultNfeLikeForm,
  getDefaultNfeItem,
  getNfeItemLineTotal,
  mergeNfsePrestadorPrefillIntoForm,
  mergeNfeEmitentePrefillIntoForm,
  isNfsePrestadorPrefillEffectivelyEmpty,
  isPrestadorPrefillStaleForCert,
  DESTINATARIO_IE_OPTIONS,
  DESTINATARIO_IE_SECTION_HINT,
  humanizeFiscalEmitError,
  type DestinatarioIndIeDest,
  type NotaDocumentType,
  type NfeLikeForm,
  type NfeItemForm,
} from '../lib/meiNfseForms';
import {
  applyCatalogClienteToNfeForm,
  applyCatalogClienteToNfseForm,
  catalogClienteHasNfeEndereco,
  catalogClienteHasTomadorEndereco,
  isTomadorEnderecoComplete,
  resolveNfseTomadorByCnpj,
} from '../lib/meiCatalogClienteFiscal';
import { getDefaultNfeDestinatarioEndereco } from '../lib/meiNfeDestinatarioEndereco';
import { fetchNfsePrestadorPrefill } from '../services/meiPrestadorPrefillService';
import { empresaFiscalToPrestadorPrefill } from '../lib/nfsePrestadorPrefillDto';
import * as DocumentPicker from 'expo-document-picker';
import { canAccessMeiArea } from '../lib/meiAccess';
import MeiCatalogoClientesModal from './MeiCatalogoClientesModal';
import MeiCatalogoProdutosModal from './MeiCatalogoProdutosModal';
import MeiImportCnaesModal from './MeiImportCnaesModal';
import { mapCatalogProdutoToNfeItem } from '../lib/mapCatalogProdutoToNfeItem';
import { isCatalogProdutoUsableForNfeLike } from '../lib/nfeCatalogProdutoMetadata';
import {
  resolveMeiDocumentosPermitidos,
  meiDocTypesPermitidos,
  isMeiDocTypePermitido,
  primeiroMeiDocTypePermitido,
  type MeiDocumentosAtivosState,
} from '../lib/meiDocumentosPermitidos';
import {
  MeiFlowModalShell,
  MeiFormField,
  MeiFormBanner,
  MeiLinkButton,
  MeiPrimaryButton,
  MeiCatalogListCard,
  useMeiFlowStyles,
  type MeiDocType,
} from '../components/mei/meiFlowUi';
import { useNavigationDrawer } from '../lib/navigationContext';
import { SHELL_CANVAS_DARK, SHELL_CANVAS_LIGHT } from '../components/shell/shellTokens';
import { MfAppHeader, MfScrollView } from '../components/ui';
import { MeiParcelamentosPanel } from '../components/mei/MeiParcelamentosPanel';
import {
  buildParcelaLedgerRows,
  isParcelamentoEmAberto,
  parcelamentoNumeroKey,
  parcelaRowPermiteDownload,
  type ParcelaLedgerRow,
} from '../lib/meiParcelamentosDisplay';
import { MeiTabBar, type MeiTabKey } from '../components/mei/MeiTabBar';
import { MeiMobileOverview } from '../components/mei/MeiMobileOverview';
import { MeiLimiteFaturamentoCard } from '../components/mei/MeiLimiteFaturamentoCard';
import { computeMeiLimiteProgresso } from '../lib/meiLimiteFaturamento';
import { getVigenciaLabelParaAno } from '../lib/meiLimiteFaturamentoConfig';
import {
  MeiMobileDasPanel,
  formatMeiPeriodLabel,
  shiftMeiPeriod,
} from '../components/mei/MeiMobileDasPanel';
import { withMeiFetchTimeout } from '../lib/meiFetchWithTimeout';
import { getTechTokens } from '../lib/techDesign';
import { toMeiUserErrorMessage } from '../utils/meiUserFacingMessage';

const PGMEI_URL =
  'https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATSPO/pgmei.app/Identificacao';

const isFocoSimplesUi = resolveAppOrigin() === 'focosimples';
const DAS_PORTAL_URL = isFocoSimplesUi ? SIMPLES_DAS_PORTAL_FALLBACK : PGMEI_URL;
const DAS_PORTAL_LABEL = isFocoSimplesUi ? 'PGDAS-D' : 'PGMEI';
const DAS_PAGE_TITLE = isFocoSimplesUi ? 'Guia DAS (Simples Nacional)' : 'Guia DAS';
const DAS_PAGE_DESC = isFocoSimplesUi
  ? 'Competências do PGDAS-D: consulte e baixe o DAS da empresa no Simples Nacional.'
  : 'Dois passos: escolha o mês e baixe o PDF.';
const NOTAS_AREA_TITLE = isFocoSimplesUi ? 'Notas' : 'Meu MEI';
const NOTAS_AREA_SUBTITLE = isFocoSimplesUi
  ? 'Emissão fiscal — Simples Nacional (NFS-e, NF-e e NFC-e).'
  : 'Status rápido das áreas do Meu MEI.';
const NOTAS_ACCESS_DENIED = isFocoSimplesUi
  ? 'A emissão de notas está disponível para administradores e utilizadores do Foco Simples.'
  : 'O Meu MEI está disponível apenas para administradores ou utilizadores com MEI habilitado. Fale com o suporte se precisar de acesso.';
const NOTAS_PAYWALL = isFocoSimplesUi
  ? 'Sua conta está ativa, mas a emissão de notas só libera depois do pagamento do plano.'
  : 'Sua conta está ativa, mas o Meu MEI só libera depois do pagamento do plano.';

const formatDateToBR = (dateString: string): string => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString + 'T00:00:00');
    if (isNaN(date.getTime())) return dateString;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateString;
  }
};

const formatSerproYyyymmdd = (raw?: string): string => {
  if (!raw) return '-';
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 8) {
    return `${digits.slice(6, 8)}/${digits.slice(4, 6)}/${digits.slice(0, 4)}`;
  }
  return formatDateToBR(String(raw)) || String(raw);
};

const parseDateFromBR = (dateString: string): string => {
  if (!dateString) return '';
  const cleaned = dateString.replace(/[^\d/]/g, '');
  const parts = cleaned.split('/');

  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    if (day && month && year && year.length === 4) {
      const dateStr = `${year}-${month}-${day}`;
      const date = new Date(dateStr + 'T00:00:00');
      if (!isNaN(date.getTime())) {
        return dateStr;
      }
    }
  }
  return '';
};

const normalizeDoc = (value: string) => value.replace(/\D/g, '');

const getDocType = (value: string) => {
  const digits = normalizeDoc(value);
  if (digits.length === 11) return 1;
  if (digits.length === 14) return 2;
  return null;
};

const formatDocument = (value: string) => {
  const digits = normalizeDoc(value).slice(0, 14);
  let formatted = '';
  for (let i = 0; i < digits.length; i += 1) {
    formatted += digits[i];
    if (digits.length <= 11) {
      if (i === 2 || i === 5) formatted += '.';
      if (i === 8) formatted += '-';
    } else {
      if (i === 1 || i === 4) formatted += '.';
      if (i === 7) formatted += '/';
      if (i === 11) formatted += '-';
    }
  }
  return formatted;
};

const getDefaultPeriod = () => {
  const now = new Date();
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return {
    year: previous.getFullYear(),
    month: String(previous.getMonth() + 1).padStart(2, '0')
  };
};

type MeiTab = MeiTabKey;

/** Spinner nos overlays de loading dos cards do Início: ~20 px (small) + 15 px. */
const MEI_OVERVIEW_LOADING_SPINNER_SIZE = 35;

const NFSE_PRESTADOR_PREFILL_MSG_EMPTY =
  'Não há cadastro MEI activo para preencher automaticamente. Complete o certificado ou preencha o prestador manualmente.';
const NFSE_PRESTADOR_PREFILL_MSG_ERROR =
  'Não foi possível carregar os dados do cadastro. Preencha o prestador manualmente.';

/** Converte competência da API (YYYY-MM ou YYYYMM) para periodoApuracao usado no download (YYYYMM). */
function meiCompetenciaToPeriodoApuracao(comp: string): string | null {
  const text = String(comp || '').trim();
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(text)) {
    return text.replace(/-/g, '');
  }
  const digits = text.replace(/\D/g, '');
  if (digits.length !== 6) return null;
  const month = digits.slice(4, 6);
  if (!/^(0[1-9]|1[0-2])$/.test(month)) return null;
  return digits;
}

function EmpresaFiscalCard({ empresa, theme, onEdit }: { empresa: EmpresaFiscalData; theme: ReturnType<typeof getTheme>; onEdit?: () => void }) {
  const telefoneStr = (() => {
    const t = empresa.telefone;
    if (!t) return '';
    if (typeof t === 'string') return t;
    const parts = [t.ddd, t.numero].filter(Boolean);
    return parts.length ? `(${t.ddd}) ${t.numero}` : '';
  })();

  const enderecoStr = (() => {
    const e = empresa.endereco;
    if (!e) return '';
    const linha1 = [e.logradouro, e.numero, e.complemento].filter(Boolean).join(', ');
    const linha2 = [e.bairro, e.descricaoCidade, e.estado].filter(Boolean).join(' - ');
    const cep = e.cep ? e.cep.replace(/^(\d{5})(\d{3})$/, '$1-$2') : '';
    return [linha1, linha2, cep ? `CEP ${cep}` : ''].filter(Boolean).join('\n');
  })();

  const nfseAtivo = !!empresa.nfse?.ativo;
  const nfeAtivo = !!empresa.nfe?.ativo;
  const nfceAtivo = !!empresa.nfce?.ativo;
  const temBadge = nfseAtivo || nfeAtivo || nfceAtivo;

  const dividerColor = theme.border ?? '#E5E7EB';
  const iconColor = theme.textSecondary ?? theme.placeholder;
  const rowStyle: any = { flexDirection: 'row', alignItems: 'flex-start', gap: 10 };
  const labelStyle: any = { fontSize: 13, color: theme.text, flex: 1, lineHeight: 20 };

  return (
    <View style={{
      marginTop: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: dividerColor,
      backgroundColor: theme.card ?? theme.surface ?? theme.background,
      overflow: 'hidden',
    }}>
      {/* Cabeçalho */}
      <View style={{ padding: 16, paddingBottom: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text, lineHeight: 22 }}>
            {empresa.razaoSocial || 'Empresa'}
          </Text>
          {empresa.nomeFantasia && empresa.nomeFantasia !== empresa.razaoSocial ? (
            <Text style={{ fontSize: 13, color: iconColor, marginTop: 2 }}>{empresa.nomeFantasia}</Text>
          ) : null}
          <Text style={{ fontSize: 12, color: iconColor, marginTop: 4, letterSpacing: 0.3 }}>
            CNPJ {formatDocument(empresa.cpfCnpj ?? '')}
          </Text>
        </View>
        {onEdit ? (
          <TouchableOpacity
            onPress={onEdit}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 4,
              paddingHorizontal: 10, paddingVertical: 6,
              borderRadius: 6, borderWidth: 1, borderColor: theme.border,
            }}
            accessibilityRole="button"
            accessibilityLabel="Editar empresa"
          >
            <Ionicons name="create-outline" size={14} color={theme.primary} />
            <Text style={{ fontSize: 12, color: theme.primary, fontWeight: '600' }}>Editar</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={{ height: 1, backgroundColor: dividerColor }} />

      {/* Linhas de informação */}
      <View style={{ padding: 16, gap: 12 }}>
        {empresa.email ? (
          <View style={rowStyle}>
            <Ionicons name="mail-outline" size={16} color={iconColor} style={{ marginTop: 2 }} />
            <Text style={labelStyle}>{empresa.email}</Text>
          </View>
        ) : null}
        {telefoneStr ? (
          <View style={rowStyle}>
            <Ionicons name="call-outline" size={16} color={iconColor} style={{ marginTop: 2 }} />
            <Text style={labelStyle}>{telefoneStr}</Text>
          </View>
        ) : null}
        {enderecoStr ? (
          <View style={rowStyle}>
            <Ionicons name="location-outline" size={16} color={iconColor} style={{ marginTop: 2 }} />
            <Text style={labelStyle}>{enderecoStr}</Text>
          </View>
        ) : null}
        {empresa.inscricaoMunicipal ? (
          <View style={rowStyle}>
            <Ionicons name="document-text-outline" size={16} color={iconColor} style={{ marginTop: 2 }} />
            <Text style={labelStyle}>IM {empresa.inscricaoMunicipal}</Text>
          </View>
        ) : null}
        {empresa.inscricaoEstadual && empresa.inscricaoEstadual !== 'ISENTO' ? (
          <View style={rowStyle}>
            <Ionicons name="document-text-outline" size={16} color={iconColor} style={{ marginTop: 2 }} />
            <Text style={labelStyle}>IE {empresa.inscricaoEstadual}</Text>
          </View>
        ) : null}
      </View>

      {temBadge ? (
        <>
          <View style={{ height: 1, backgroundColor: dividerColor }} />
          <View style={{ padding: 12, flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {nfseAtivo && (
              <View style={{ backgroundColor: theme.primary + '20', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 }}>
                <Text style={{ fontSize: 12, color: theme.primary, fontWeight: '600' }}>NFSe</Text>
              </View>
            )}
            {nfeAtivo && (
              <View style={{ backgroundColor: theme.primary + '20', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 }}>
                <Text style={{ fontSize: 12, color: theme.primary, fontWeight: '600' }}>NFe</Text>
              </View>
            )}
            {nfceAtivo && (
              <View style={{ backgroundColor: theme.primary + '20', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 }}>
                <Text style={{ fontSize: 12, color: theme.primary, fontWeight: '600' }}>NFCe</Text>
              </View>
            )}
          </View>
        </>
      ) : null}
    </View>
  );
}

function MeiScreenContent() {
  const { userId, displayName } = useAuthStore();
  const { isDarkMode } = useThemeStore();
  const { openDrawer, hasGlobalNav } = useNavigationDrawer();
  const { width: winWidth } = useWindowDimensions();
  const isDesktop = winWidth >= 900;
  const theme = useMemo(() => getTheme(isDarkMode), [isDarkMode]);
  const styles = useMemo(() => createStyles(theme, isDesktop, isDarkMode), [theme, isDesktop, isDarkMode]);
  const meiFlow = useMeiFlowStyles();
  const webScrollStyle = useMemo(() => getWebScrollbarStyle(theme), [theme]);
  const requiredMark = <Text style={{ color: theme.error }}>*</Text>;

  const [activeTab, setActiveTab] = useState<MeiTab>('overview');
  const [showCertRequiredModal, setShowCertRequiredModal] = useState(false);

  // Abas que precisam de certificado digital configurado
  const requiresCertificate = (tab: MeiTab): boolean =>
    tab === 'das' || tab === 'notas' || tab === 'parcelamentos';

  const handleTabChange = (key: MeiTab) => {
    if (requiresCertificate(key) && !hasCertificate && !meiCertificateLoading) {
      setShowCertRequiredModal(true);
      return;
    }
    setActiveTab(key);
  };
  const [refreshing, setRefreshing] = useState(false);
  const defaultPeriod = useMemo(() => getDefaultPeriod(), []);
  const [selectedYear, setSelectedYear] = useState<number>(defaultPeriod.year);
  const [selectedMonth, setSelectedMonth] = useState<string>(defaultPeriod.month);
  const [cnpj, setCnpj] = useState('');
  const [meiError, setMeiError] = useState<string | null>(null);
  const [meiCertificateLoading, setMeiCertificateLoading] = useState(false);
  const [hasUserCertificate, setHasUserCertificate] = useState(false);
  const [hasCertificate, setHasCertificate] = useState(false);
  const [hasServerCertificate, setHasServerCertificate] = useState(false);
  const [certDocumento, setCertDocumento] = useState<string | null>(null);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [downloadGuiasAbertasLoading, setDownloadGuiasAbertasLoading] = useState(false);

  // Parcelamentos
  const [parcelamentos, setParcelamentos] = useState<ParcelamentoItem[]>([]);
  const [parcelamentosLoading, setParcelamentosLoading] = useState(false);
  const [parcelamentoDownloadRowKey, setParcelamentoDownloadRowKey] = useState<string | null>(null);
  const [parcelamentoBulkLoading, setParcelamentoBulkLoading] = useState(false);
  const [parcelasPorNumero, setParcelasPorNumero] = useState<Record<string, ParcelamentoParcelaOption[]>>({});
  const [parcelasFilterLoading, setParcelasFilterLoading] = useState(false);
  const showToast = useAppToastStore((s) => s.show);

  // Períodos DAS
  const [meiPeriods, setMeiPeriods] = useState<MeiPeriod[]>([]);
  const [meiPeriodsLoading, setMeiPeriodsLoading] = useState(false);
  const [meiPeriodsError, setMeiPeriodsError] = useState<string | null>(null);
  const [createGuideLoading, setCreateGuideLoading] = useState(false);
  const [validateLoading, setValidateLoading] = useState(false);

  // Notas
  const [notas, setNotas] = useState<NfseRecord[]>([]);
  const [notasLoading, setNotasLoading] = useState(false);
  const [emitirNotaPending, setEmitirNotaPending] = useState(false);
  const [meiLimiteServidor, setMeiLimiteServidor] = useState<{
    totalUtilizadoReais: number;
    notasConsideradas: number;
  } | null>(null);
  const [meiLimiteServidorReady, setMeiLimiteServidorReady] = useState(false);
  const [meiLimiteServidorLoading, setMeiLimiteServidorLoading] = useState(false);
  const [notaActionId, setNotaActionId] = useState<string | null>(null);
  const notasSyncInFlightRef = useRef(false);
  const e0014ArchiveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const meiPeriodsInFlightRef = useRef(false);
  const notasRef = useRef<NfseRecord[]>([]);
  notasRef.current = notas;
  const [nfseIncludeArchived, setNfseIncludeArchived] = useState(false);
  const [nfseDocumentTypeFilter, setNfseDocumentTypeFilter] = useState<'all' | DocumentType>('all');
  const [editNotaVisible, setEditNotaVisible] = useState(false);
  const [editingNota, setEditingNota] = useState<NfseRecord | null>(null);
  const [editNotaDescricao, setEditNotaDescricao] = useState('');
  const [editNotaLoading, setEditNotaLoading] = useState(false);

  // Certificado: upload certificate / fiscal integration
  const [certUploadLoading, setCertUploadLoading] = useState(false);
  const [certPassword, setCertPassword] = useState('');
  const [pickedCertFile, setPickedCertFile] = useState<{ uri: string; name: string; type?: string } | null>(null);
  const [certUploadProgress, setCertUploadProgress] = useState<string | null>(null);
  const [certPlugnotasStatus, setCertPlugnotasStatus] = useState<{ status: string; source?: string; reason?: string } | null>(null);
  const [plugNotasCertLoading, setPlugNotasCertLoading] = useState(false);
  const [plugNotasEmpresaLoading, setPlugNotasEmpresaLoading] = useState(false);
  const [plugNotasPfxPassword, setPlugNotasPfxPassword] = useState('');
  const [empresaFiscal, setEmpresaFiscal] = useState<EmpresaFiscalData | null>(null);
  const [empresaFiscalLoading, setEmpresaFiscalLoading] = useState(false);
  const [plugNotasCnpj, setPlugNotasCnpj] = useState('');
  const [plugNotasCompanyForm, setPlugNotasCompanyForm] = useState<PlugNotasCompanyForm>(() => getDefaultPlugNotasCompanyForm());
  const [cnpjLookupLoading, setCnpjLookupLoading] = useState(false);
  const [cnpjLookupError, setCnpjLookupError] = useState<string | null>(null);
  const [showPlugNotasEmpresaForm, setShowPlugNotasEmpresaForm] = useState(false);
  const [importCnaesVisible, setImportCnaesVisible] = useState(false);
  const [pendingImportCnaes, setPendingImportCnaes] = useState<CnpjLookupCnaeItem[]>([]);
  const offerCnaeImportRef = useRef(false);
  const [isEditingEmpresa, setIsEditingEmpresa] = useState(false);

  // Emitir nota
  const [emitirNotaVisible, setEmitirNotaVisible] = useState(false);
  const [emitirNotaType, setEmitirNotaType] = useState<NotaDocumentType>('NFSE');

  const notasParaExibir = useMemo(() => {
    if (!emitirNotaPending) return notas;
    const pendente: NfseRecord = {
      id: '__emit_pending__',
      user_id: userId ?? '',
      status: 'aguardando',
      document_type: emitirNotaType,
      created_at: new Date().toISOString(),
    };
    return [pendente, ...notas];
  }, [emitirNotaPending, emitirNotaType, notas, userId]);
  const [documentosAtivosMirror, setDocumentosAtivosMirror] = useState<MeiDocumentosAtivosState | null>(null);
  const documentosPermitidos = useMemo(
    () => resolveMeiDocumentosPermitidos(documentosAtivosMirror, empresaFiscal),
    [documentosAtivosMirror, empresaFiscal],
  );
  const emitDocTypesAllowed = useMemo(
    () => meiDocTypesPermitidos(documentosPermitidos),
    [documentosPermitidos],
  );
  const notasTypeFilterOptions = useMemo(() => {
    const opts: Array<'all' | DocumentType> = ['all'];
    if (documentosPermitidos.nfse) opts.push('NFSE');
    if (documentosPermitidos.nfe) opts.push('NFE');
    if (documentosPermitidos.nfce) opts.push('NFCE');
    return opts;
  }, [documentosPermitidos]);
  const emitDocTypesLabel = useMemo(
    () =>
      emitDocTypesAllowed
        .map((t) => (t === 'NFSE' ? 'NFSe' : t === 'NFE' ? 'NFe' : 'NFC-e'))
        .join(', '),
    [emitDocTypesAllowed],
  );
  const [nfseForm, setNfseForm] = useState<EmitirNfseInput>(() => ({
    prestadorCpfCnpj: '',
    prestadorEndereco: { logradouro: '', numero: '', codigoCidade: '', cep: '', complemento: '', bairro: '', estado: '', descricaoCidade: '' },
    tomadorCpfCnpj: '',
    tomadorRazaoSocial: '',
    tomadorEmail: '',
    tomadorEndereco: getDefaultNfeDestinatarioEndereco(),
    servico: { codigo: '', discriminacao: '', cnae: '', aliquota: '', valorServico: '' },
  }));
  const [nfeLikeForm, setNfeLikeForm] = useState<NfeLikeForm>(() => getDefaultNfeLikeForm());
  const [emitirNotaLoading, setEmitirNotaLoading] = useState(false);
  const [emitirNotaError, setEmitirNotaError] = useState<string | null>(null);
  /** Barreira síncrona contra duplo toque antes do re-render de `emitirNotaLoading`. */
  const emitirNotaInFlightRef = useRef(false);
  const [catalogClientes, setCatalogClientes] = useState<NfseCatalogCliente[]>([]);
  const [catalogProdutos, setCatalogProdutos] = useState<NfseCatalogProduto[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogClienteVisible, setCatalogClienteVisible] = useState(false);
  const [catalogProdutoVisible, setCatalogProdutoVisible] = useState(false);
  const [catalogClientesManageVisible, setCatalogClientesManageVisible] = useState(false);
  const [catalogProdutosManageVisible, setCatalogProdutosManageVisible] = useState(false);
  const [tomadorCnpjLookupLoading, setTomadorCnpjLookupLoading] = useState(false);
  const lastTomadorLookupDocRef = useRef('');

  /** FR-P04: auto-fill só na 1.ª abertura do modal NFSe na sessão; não sobrescrever após edição do utilizador. */
  const nfsePrestadorPrefillAppliedRef = useRef(false);
  const nfsePrestadorUserEditedRef = useRef(false);
  /**
   * FR-P05 / QA: outcome do 1.º fetch — ao reabrir o modal NFSe, voltar a mostrar banner se cadastro vazio ou erro,
   * mesmo que o estado React tenha sido limpo; `ok` = prefill útil ou utilizador dispensou o aviso ao editar prestador.
   */
  const nfsePrestadorPrefillBannerOutcomeRef = useRef<'unset' | 'empty' | 'error' | 'ok'>('unset');
  const [nfsePrestadorPrefillLoading, setNfsePrestadorPrefillLoading] = useState(false);
  const [nfsePrestadorPrefillBanner, setNfsePrestadorPrefillBanner] = useState<string | null>(null);

  const nfeEmitenteUserEditedRef = useRef(false);
  const nfeEmitentePrefillBannerOutcomeRef = useRef<'unset' | 'empty' | 'error' | 'ok'>('unset');
  const [nfeEmitentePrefillLoading, setNfeEmitentePrefillLoading] = useState(false);
  const [nfeEmitentePrefillBanner, setNfeEmitentePrefillBanner] = useState<string | null>(null);

  const touchNfsePrestadorFields = useCallback(() => {
    nfsePrestadorUserEditedRef.current = true;
    if (nfsePrestadorPrefillBannerOutcomeRef.current === 'empty' || nfsePrestadorPrefillBannerOutcomeRef.current === 'error') {
      nfsePrestadorPrefillBannerOutcomeRef.current = 'ok';
      setNfsePrestadorPrefillBanner(null);
    }
  }, []);

  useEffect(() => {
    if (!emitirNotaVisible || emitirNotaType !== 'NFSE') return;
    const o = nfsePrestadorPrefillBannerOutcomeRef.current;
    if (o === 'empty') setNfsePrestadorPrefillBanner(NFSE_PRESTADOR_PREFILL_MSG_EMPTY);
    else if (o === 'error') setNfsePrestadorPrefillBanner(NFSE_PRESTADOR_PREFILL_MSG_ERROR);
  }, [emitirNotaVisible, emitirNotaType]);

  useEffect(() => {
    if (!emitirNotaVisible || emitirNotaType !== 'NFSE') return;
    if (nfsePrestadorUserEditedRef.current) return;
    // Permite re-run quando empresaFiscal carregar (não bloqueia mais por
    // nfsePrestadorPrefillAppliedRef). onlyFillEmpty=true preserva edições.

    let cancelled = false;
    (async () => {
      setNfsePrestadorPrefillLoading(true);
      setNfsePrestadorPrefillBanner(null);
      nfsePrestadorPrefillBannerOutcomeRef.current = 'unset';
      try {
        // Fonte 1 (rápida): user_mei_certificates via Edge Function
        const localPrefill = await fetchNfsePrestadorPrefill();
        if (cancelled) return;
        if (nfsePrestadorUserEditedRef.current) return;
        nfsePrestadorPrefillAppliedRef.current = true;

        // Fonte 2 (fallback completo): EmpresaFiscal (live PlugNotas).
        // Aplica em onlyFillEmpty=true para complementar campos vazios
        // que o user_mei_certificates não tem (caso comum: usuário enviou
        // cert via fluxo MEI/DAS mas só preencheu razão social, endereço,
        // etc. ao cadastrar a empresa no PlugNotas).
        const empresaPrefill = empresaFiscalToPrestadorPrefill(empresaFiscal);
        const localStale = isPrestadorPrefillStaleForCert(certDocumento, localPrefill);

        setNfseForm((f) => {
          let next = f;
          if (!localStale) {
            next = mergeNfsePrestadorPrefillIntoForm(f, localPrefill, { onlyFillEmpty: true });
          }
          next = mergeNfsePrestadorPrefillIntoForm(next, empresaPrefill, {
            onlyFillEmpty: !localStale,
          });
          return next;
        });

        const localEmpty = localStale || isNfsePrestadorPrefillEffectivelyEmpty(localPrefill);
        const empresaEmpty = isNfsePrestadorPrefillEffectivelyEmpty(empresaPrefill);
        if (localEmpty && empresaEmpty) {
          nfsePrestadorPrefillBannerOutcomeRef.current = 'empty';
          setNfsePrestadorPrefillBanner(NFSE_PRESTADOR_PREFILL_MSG_EMPTY);
        } else {
          nfsePrestadorPrefillBannerOutcomeRef.current = 'ok';
          setNfsePrestadorPrefillBanner(null);
        }
      } catch {
        if (cancelled) return;
        nfsePrestadorPrefillAppliedRef.current = true;

        // Mesmo se Edge Function falhar, ainda tenta usar empresaFiscal
        try {
          const empresaPrefill = empresaFiscalToPrestadorPrefill(empresaFiscal);
          if (!isNfsePrestadorPrefillEffectivelyEmpty(empresaPrefill)) {
            setNfseForm((f) => mergeNfsePrestadorPrefillIntoForm(f, empresaPrefill, { onlyFillEmpty: true }));
            nfsePrestadorPrefillBannerOutcomeRef.current = 'ok';
            setNfsePrestadorPrefillBanner(null);
            return;
          }
        } catch { /* segue o caminho normal de erro */ }

        nfsePrestadorPrefillBannerOutcomeRef.current = 'error';
        setNfsePrestadorPrefillBanner(NFSE_PRESTADOR_PREFILL_MSG_ERROR);
      } finally {
        if (!cancelled) setNfsePrestadorPrefillLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [emitirNotaVisible, emitirNotaType, empresaFiscal, certDocumento]);

  const resetFiscalEmitentePrefillState = useCallback(() => {
    nfsePrestadorUserEditedRef.current = false;
    nfsePrestadorPrefillAppliedRef.current = false;
    nfeEmitenteUserEditedRef.current = false;
    nfsePrestadorPrefillBannerOutcomeRef.current = 'unset';
    nfeEmitentePrefillBannerOutcomeRef.current = 'unset';
    setNfsePrestadorPrefillBanner(null);
    setNfeEmitentePrefillBanner(null);
  }, []);

  const touchNfeEmitenteFields = useCallback(() => {
    nfeEmitenteUserEditedRef.current = true;
    if (
      nfeEmitentePrefillBannerOutcomeRef.current === 'empty'
      || nfeEmitentePrefillBannerOutcomeRef.current === 'error'
    ) {
      nfeEmitentePrefillBannerOutcomeRef.current = 'ok';
      setNfeEmitentePrefillBanner(null);
    }
  }, []);

  useEffect(() => {
    if (!emitirNotaVisible || (emitirNotaType !== 'NFE' && emitirNotaType !== 'NFCE')) return;
    const o = nfeEmitentePrefillBannerOutcomeRef.current;
    if (o === 'empty') setNfeEmitentePrefillBanner(NFSE_PRESTADOR_PREFILL_MSG_EMPTY);
    else if (o === 'error') setNfeEmitentePrefillBanner(NFSE_PRESTADOR_PREFILL_MSG_ERROR);
  }, [emitirNotaVisible, emitirNotaType]);

  useEffect(() => {
    if (!emitirNotaVisible || (emitirNotaType !== 'NFE' && emitirNotaType !== 'NFCE')) return;
    if (nfeEmitenteUserEditedRef.current) return;

    let cancelled = false;
    (async () => {
      setNfeEmitentePrefillLoading(true);
      setNfeEmitentePrefillBanner(null);
      nfeEmitentePrefillBannerOutcomeRef.current = 'unset';
      const ieExtra = { inscricaoEstadual: empresaFiscal?.inscricaoEstadual ?? null };
      try {
        const localPrefill = await fetchNfsePrestadorPrefill();
        if (cancelled || nfeEmitenteUserEditedRef.current) return;

        const empresaPrefill = empresaFiscalToPrestadorPrefill(empresaFiscal);
        setNfeLikeForm((f) => {
          let next = mergeNfeEmitentePrefillIntoForm(f, localPrefill, ieExtra, { onlyFillEmpty: true });
          next = mergeNfeEmitentePrefillIntoForm(next, empresaPrefill, ieExtra, { onlyFillEmpty: true });
          return next;
        });

        const localEmpty = isNfsePrestadorPrefillEffectivelyEmpty(localPrefill);
        const empresaEmpty = isNfsePrestadorPrefillEffectivelyEmpty(empresaPrefill);
        const hasIe = Boolean(String(empresaFiscal?.inscricaoEstadual ?? '').trim());
        if (localEmpty && empresaEmpty && !hasIe) {
          nfeEmitentePrefillBannerOutcomeRef.current = 'empty';
          setNfeEmitentePrefillBanner(NFSE_PRESTADOR_PREFILL_MSG_EMPTY);
        } else {
          nfeEmitentePrefillBannerOutcomeRef.current = 'ok';
          setNfeEmitentePrefillBanner(null);
        }
      } catch {
        if (cancelled) return;
        try {
          const empresaPrefill = empresaFiscalToPrestadorPrefill(empresaFiscal);
          if (!isNfsePrestadorPrefillEffectivelyEmpty(empresaPrefill) || ieExtra.inscricaoEstadual) {
            setNfeLikeForm((f) =>
              mergeNfeEmitentePrefillIntoForm(f, empresaPrefill, ieExtra, { onlyFillEmpty: true })
            );
            nfeEmitentePrefillBannerOutcomeRef.current = 'ok';
            setNfeEmitentePrefillBanner(null);
            return;
          }
        } catch { /* segue erro */ }

        nfeEmitentePrefillBannerOutcomeRef.current = 'error';
        setNfeEmitentePrefillBanner(NFSE_PRESTADOR_PREFILL_MSG_ERROR);
      } finally {
        if (!cancelled) setNfeEmitentePrefillLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [emitirNotaVisible, emitirNotaType, empresaFiscal]);

  const normalizedCnpj = useMemo(() => normalizeDoc(cnpj), [cnpj]);
  const contribuinteTipo = useMemo(() => getDocType(normalizedCnpj), [normalizedCnpj]);

  const meiPeriodsEmAberto = useMemo(
    () => (meiPeriods || []).filter((p) => p.status === 'a_pagar'),
    [meiPeriods]
  );

  const parcelasEmAbertoCount = useMemo(() => {
    const rows = buildParcelaLedgerRows(parcelamentos, parcelasPorNumero);
    const abertas = rows.filter(
      (row) => row.status === 'a_pagar' || row.status === 'liberada',
    ).length;
    if (abertas > 0) return abertas;
    return parcelamentos.filter((p) => isParcelamentoEmAberto(p.situacao)).length;
  }, [parcelamentos, parcelasPorNumero]);
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 10 }, (_, index) => currentYear - index);
  }, []);
  const availableMonths = useMemo(
    () => Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0')),
    []
  );
  const canDownloadGuide = normalizedCnpj.length === 14
    && hasCertificate
    && !downloadLoading;

  useEffect(() => {
    if (!userId) return;
    let isMounted = true;

    setHasUserCertificate(false);
    setHasServerCertificate(false);
    setHasCertificate(false);
    setCertDocumento(null);
    setMeiPeriods([]);
    setParcelamentos([]);
    setNotas([]);
    setParcelasPorNumero({});
    clearMeiOverviewCache();

    const loadCertificateStatus = async () => {
      setMeiCertificateLoading(true);
      try {
        const status = await fetchMeiCertificateStatus();
        if (!isMounted) return;
        setHasUserCertificate(Boolean(status.hasUserCertificate));
        setHasServerCertificate(Boolean(status.hasEnvCertificate));
        setHasCertificate(Boolean(status.hasUserCertificate || status.hasEnvCertificate));
        setCertDocumento(status.documento || null);
        setDocumentosAtivosMirror(status.documentosAtivos ?? null);
        setMeiError(null);
      } catch (error: any) {
        if (!isMounted) return;
        setHasUserCertificate(false);
        setHasCertificate(false);
        setHasServerCertificate(false);
        setCertDocumento(null);
        setMeiError(error?.message || 'Nao foi possivel verificar o certificado');
      } finally {
        if (isMounted) {
          setMeiCertificateLoading(false);
        }
      }
    };
    loadCertificateStatus();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!hasUserCertificate) {
      setEmpresaFiscal(null);
      return;
    }
    const cnpjParaConsulta = certDocumento || (normalizedCnpj.length === 14 ? normalizedCnpj : null);
    if (!cnpjParaConsulta) return;
    let isMounted = true;
    setEmpresaFiscalLoading(true);
    consultarEmpresaFiscal(cnpjParaConsulta)
      .then((data) => { if (isMounted) setEmpresaFiscal(data); })
      .catch(() => { if (isMounted) setEmpresaFiscal(null); })
      .finally(() => { if (isMounted) setEmpresaFiscalLoading(false); });
    return () => { isMounted = false; };
  }, [certDocumento, normalizedCnpj, hasUserCertificate]);

  useEffect(() => {
    if (!isMeiDocTypePermitido(emitirNotaType, documentosPermitidos)) {
      setEmitirNotaType(primeiroMeiDocTypePermitido(documentosPermitidos) as NotaDocumentType);
    }
  }, [documentosPermitidos, emitirNotaType]);

  useEffect(() => {
    if (
      nfseDocumentTypeFilter !== 'all' &&
      !isMeiDocTypePermitido(nfseDocumentTypeFilter as MeiDocType, documentosPermitidos)
    ) {
      setNfseDocumentTypeFilter('all');
    }
  }, [documentosPermitidos, nfseDocumentTypeFilter]);

  useEffect(() => {
    setPlugNotasCompanyForm((prev) => {
      const next = { ...prev };
      let changed = false;
      if (!documentosPermitidos.nfe && prev.nfeAtivo) {
        next.nfeAtivo = false;
        changed = true;
      }
      if (!documentosPermitidos.nfce && prev.nfceAtivo) {
        next.nfceAtivo = false;
        changed = true;
      }
      if (!documentosPermitidos.nfse && prev.nfseAtivo) {
        next.nfseAtivo = false;
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [documentosPermitidos]);

  // Pré-preenche o CNPJ do "DAS" usando o CNPJ extraído do certificado.
  // Roda quando o certDocumento muda OU quando o usuário entra na aba DAS.
  // Só preenche se o campo estiver vazio (não sobrescreve digitação manual).
  useEffect(() => {
    if (!certDocumento) return;
    if (cnpj.trim()) return;
    const digits = String(certDocumento).replace(/\D/g, '');
    if (digits.length !== 14) return;
    setCnpj(formatDocument(digits));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [certDocumento, activeTab]);

  // Pré-preenche o CNPJ do formulário "Cadastrar empresa" usando o CNPJ
  // já extraído do certificado (.pfx) e dispara o lookup BrasilAPI uma vez.
  // Também dispara quando o form abre OU quando certDocumento muda.
  useEffect(() => {
    if (!showPlugNotasEmpresaForm) return;
    if (!certDocumento) {
      // Fallback: se ainda não temos certDocumento mas há cert ativo,
      // refetch para tentar pegar o cert_document do banco.
      if (hasCertificate) {
        fetchMeiCertificateStatus()
          .then((status) => {
            if (status?.documento) setCertDocumento(status.documento);
          })
          .catch(() => {});
      }
      return;
    }
    const digits = String(certDocumento).replace(/\D/g, '');
    if (digits.length !== 14) return;
    const masked = formatDocument(digits);
    if (!plugNotasCnpj) {
      setPlugNotasCnpj(masked);
      handleCnpjLookup(masked);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPlugNotasEmpresaForm, certDocumento, hasCertificate]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (normalizedCnpj.length === 14) {
        await loadMeiPeriods({ refresh: true, silent: true });
      }
      if (normalizedCnpj.length === 14 && (activeTab === 'parcelamentos' || activeTab === 'overview')) {
        await loadParcelamentos({ silent: true });
      }
    } finally {
      setRefreshing(false);
    }
  };

  const handleOpenPgmei = async () => {
    try {
      await Linking.openURL(DAS_PORTAL_URL);
    } catch {
      Alert.alert('Erro', `Não foi possível abrir o ${DAS_PORTAL_LABEL}`);
    }
  };

  const handleDownloadGuide = async (period?: MeiPeriod) => {
    if (normalizedCnpj.length !== 14) {
      Alert.alert('Erro', 'Informe um CNPJ válido do contribuinte');
      return;
    }
    if (!isFocoSimplesUi && !contribuinteTipo) {
      Alert.alert('Erro', 'Documento do contribuinte inválido');
      return;
    }
    if (!hasCertificate) {
      Alert.alert(
        'Erro',
        isFocoSimplesUi
          ? 'Envie o certificado A1 (e-CNPJ) da própria empresa na aba Certificado. Ele assina o termo Autentica Procurador na SERPRO.'
          : 'Certificado não configurado no servidor',
      );
      return;
    }
    if (period?.status === 'indisponivel') {
      Alert.alert(
        'DAS indisponível',
        period.errorMessage
          || 'A Receita não emite DAS para esta competência (período inválido, futuro, decadente ou antes de ser MEI).'
      );
      return;
    }

    const periodoApuracao = period
      ? meiCompetenciaToPeriodoApuracao(period.competencia)
      : `${selectedYear}${selectedMonth}`;
    if (!periodoApuracao) {
      Alert.alert('Erro', 'Competência inválida para download');
      return;
    }

    const contrib = { numero: normalizedCnpj, tipo: contribuinteTipo };
    const vencida = period ? isMeiPeriodVencida(period) : false;
    setDownloadLoading(true);
    try {
      if (isFocoSimplesUi) {
        // Sempre período AAAAMM — guideId UUID do cache local quebrava o download.
        const downloadKey = `pgdasd-${periodoApuracao}`;
        const preferExistingPdf = period?.status === 'pago';
        let guide = await downloadSimplesDas(downloadKey, {
          regenerate: Boolean(vencida && period?.status === 'a_pagar'),
          preferExistingPdf,
        });
        if (!guide?.pdfBase64) {
          guide = await gerarSimplesDas({
            cnpj: normalizedCnpj,
            periodoApuracao,
            preferExistingPdf,
          });
        }
        if (!guide?.pdfBase64) {
          Alert.alert(
            'Sem PDF',
            'A Receita não devolveu o arquivo. Confirme se a declaração do período já foi transmitida no PGDAS-D.',
            [{ text: `Abrir ${DAS_PORTAL_LABEL}`, onPress: () => void handleOpenPgmei() }, { text: 'OK' }],
          );
          return;
        }
        const saved = await saveMeiGuidePdfFromBase64(
          guide.pdfBase64,
          guide.filename || `DAS-SN-${periodoApuracao}.pdf`,
        );
        if (guide.valorTotal != null && Number.isFinite(Number(guide.valorTotal)) && period?.competencia) {
          const valor = Number(guide.valorTotal);
          setMeiPeriods((prev) => prev.map((row) => (
            row.competencia === period.competencia
              ? { ...row, valorTotal: valor }
              : row
          )));
        }
        await presentDownloadedFile(saved, {
          mimeType: 'application/pdf',
          dialogTitle: 'DAS Simples Nacional',
          successMessage: saved.localUri ? `Guia salva em: ${saved.localUri}` : undefined,
        });
        if (guide.valorTotal != null && Number.isFinite(Number(guide.valorTotal))) {
          showToast(`DAS ${period?.competencia || ''}: ${formatCurrencyBR(Number(guide.valorTotal))}`, 'success');
        }
        void loadMeiPeriods({ silent: true, refresh: true });
        return;
      }

      if (vencida) {
        const guide = await regenerateMeiGuide(periodoApuracao, {
          cnpj: normalizedCnpj,
          periodoApuracao,
          contribuinte: contrib,
        });
        if (guide?.pdfBase64) {
          const saved = await saveMeiGuidePdfFromBase64(
            guide.pdfBase64,
            guide.filename || `guia-mei-${periodoApuracao}.pdf`,
          );
          await presentDownloadedFile(
            { localUri: saved.localUri, filename: saved.filename },
            {
              mimeType: 'application/pdf',
              dialogTitle: 'Guia MEI atualizada',
              successMessage: saved.localUri
                ? `Guia com valor atualizado salva em: ${saved.localUri}`
                : 'Guia regenerada na Receita com valor atualizado.',
            },
          );
        } else {
          const result = await downloadMeiGuide(normalizedCnpj, periodoApuracao, contrib, {
            forceRefresh: true,
          });
          await presentDownloadedFile(result, {
            mimeType: 'application/pdf',
            dialogTitle: 'Guia MEI atualizada',
            successMessage: result.localUri
              ? `Guia com valor atualizado salva em: ${result.localUri}`
              : undefined,
          });
        }
        showToast('Guia vencida regenerada na Receita com o valor atualizado.', 'success');
      } else {
        const result = await downloadMeiGuide(normalizedCnpj, periodoApuracao, contrib);
        await presentDownloadedFile(result, {
          mimeType: 'application/pdf',
          dialogTitle: 'Guia MEI',
          successMessage: result.localUri ? `Guia salva em: ${result.localUri}` : undefined,
        });
      }
      void loadMeiPeriods({ silent: true, refresh: true });
    } catch (error: any) {
      const code = String(error?.code || '');
      const rawMsg = String(error?.message || '');
      const friendly = toMeiUserErrorMessage(rawMsg);
      const isSemDebito = code === 'PGDASD_SEM_DEBITO'
        || /MSG_E0139|sem valor devido|não foi gerado das/i.test(rawMsg);

      if (code === 'MEI_DAS_PAID_NO_PDF') {
        void loadMeiPeriods({ refresh: true });
        alertDialog('DAS já pago', error?.message || 'A Receita não devolveu PDF deste mês por aqui.');
        showToast('DAS já pago neste período.', 'info');
      } else if (code === 'MEI_DAS_PERIODO_INDISPONIVEL') {
        alertDialog('DAS indisponível', error?.message || 'Competência indisponível na Receita.');
        showToast(friendly, 'info');
      } else if (isSemDebito) {
        if (period?.competencia) {
          setMeiPeriods((prev) => prev.map((row) => (
            row.competencia === period.competencia
              ? { ...row, status: 'pago' as const, errorMessage: friendly }
              : row
          )));
        }
        void loadMeiPeriods({ silent: true, refresh: true });
        alertDialog(
          'PDF não disponível neste período',
          'A Receita não devolveu guia nem extrato/recibo para esta competência. Confira no PGDAS-D se há DAS gerado ou declaração transmitida.',
        );
        showToast('Sem PDF na Receita para este período.', 'info');
      } else if (code === 'PGDASD_DAS_NO_PDF') {
        alertDialog(
          'PDF não disponível',
          friendly || 'A Receita não devolveu o PDF. Confirme se a declaração do período já foi transmitida.',
        );
        showToast(friendly, 'error');
      } else {
        const hint =
          period?.status === 'erro' && period.errorMessage
            ? period.errorMessage
            : friendly || 'Não foi possível baixar a guia';
        alertDialog(vencida ? 'Erro ao atualizar guia vencida' : 'Erro ao baixar DAS', hint);
        showToast(hint, 'error');
      }
    } finally {
      setDownloadLoading(false);
    }
  };

  const handleDownloadGuiasEmAberto = async () => {
    if (normalizedCnpj.length !== 14) {
      Alert.alert('Erro', 'Informe um CNPJ válido do contribuinte');
      return;
    }
    if (!contribuinteTipo) {
      Alert.alert('Erro', 'Documento do contribuinte inválido');
      return;
    }
    if (!hasCertificate) {
      Alert.alert('Erro', 'Certificado não configurado no servidor');
      return;
    }

    const abertas = meiPeriods.filter((p) => p.status === 'a_pagar');
    if (abertas.length === 0) {
      Alert.alert('Guias em aberto', 'Não há guias em aberto para baixar.');
      return;
    }

    const contrib = { numero: normalizedCnpj, tipo: contribuinteTipo };
    setDownloadGuiasAbertasLoading(true);
    const falhas: string[] = [];
    let sucesso = 0;

    try {
      for (const p of abertas) {
        const periodoApuracao = meiCompetenciaToPeriodoApuracao(p.competencia);
        if (!periodoApuracao) {
          falhas.push(String(p.competencia));
          continue;
        }
        try {
          const vencida = isMeiPeriodVencida(p);
          if (vencida) {
            const guide = await regenerateMeiGuide(periodoApuracao, {
              cnpj: normalizedCnpj,
              periodoApuracao,
              contribuinte: contrib,
            });
            if (guide?.pdfBase64) {
              const saved = await saveMeiGuidePdfFromBase64(
                guide.pdfBase64,
                guide.filename || `guia-mei-${periodoApuracao}.pdf`,
              );
              await presentDownloadedFile(
                { localUri: saved.localUri, filename: saved.filename },
                {
                  mimeType: 'application/pdf',
                  dialogTitle: `Guia MEI ${periodoApuracao}`,
                  successMessage: saved.localUri
                    ? `Período ${p.competencia} (valor atualizado): ${saved.localUri}`
                    : undefined,
                },
              );
            } else {
              const result = await downloadMeiGuide(normalizedCnpj, periodoApuracao, contrib, {
                forceRefresh: true,
              });
              await presentDownloadedFile(result, {
                mimeType: 'application/pdf',
                dialogTitle: `Guia MEI ${periodoApuracao}`,
                successMessage: result.localUri
                  ? `Período ${p.competencia}: ${result.localUri}`
                  : undefined,
              });
            }
          } else {
            const result = await downloadMeiGuide(normalizedCnpj, periodoApuracao, contrib);
            await presentDownloadedFile(result, {
              mimeType: 'application/pdf',
              dialogTitle: `Guia MEI ${periodoApuracao}`,
              successMessage: result.localUri
                ? `Período ${p.competencia}: ${result.localUri}`
                : undefined,
            });
          }
          sucesso += 1;
        } catch {
          falhas.push(p.competencia);
        }
      }

      if (falhas.length > 0 && sucesso === 0) {
        Alert.alert('Erro', `Não foi possível baixar as guias em aberto: ${falhas.join(', ')}.`);
      } else if (falhas.length > 0) {
        Alert.alert(
          'Concluído parcialmente',
          `${sucesso} guia(s) baixada(s). Falhou: ${falhas.join(', ')}.`
        );
      }
    } finally {
      setDownloadGuiasAbertasLoading(false);
    }
  };

  const handleOverviewDasCardPress = () => {
    handleTabChange('das');
  };

  const loadParcelamentos = useCallback(async (options?: { scope?: 'mei' | 'all'; silent?: boolean }) => {
    const scope = options?.scope ?? 'all';
    const silent = Boolean(options?.silent);
    const cached =
      normalizedCnpj.length === 14 ? readMeiOverviewParcelamentos(normalizedCnpj) : null;
    if (cached?.length) setParcelamentos(cached);
    const showLoading = !silent || !cached?.length;
    if (showLoading) setParcelamentosLoading(true);
    let listaRetorno: ParcelamentoItem[] = cached?.length ? cached : [];
    try {
      const contrib =
        normalizedCnpj.length === 14 && contribuinteTipo
          ? { numero: normalizedCnpj, tipo: contribuinteTipo }
          : undefined;
      const res = await fetchParcelamentos(normalizedCnpj || undefined, contrib, { scope });
      const lista = res?.parcelamentos || [];
      listaRetorno = lista;
      setParcelamentos(lista);
      if (normalizedCnpj.length === 14) writeMeiOverviewParcelamentos(normalizedCnpj, lista);
      if ((res?.parcelamentos?.length ?? 0) === 0) {
        if (__DEV__) {
          const status = res?.modalidadesStatus ?? [];
          const erros = status.filter((s) => s.status === 'error');
          if (erros.length > 0 || res?.termoAutorizacaoErro) {
            console.warn('[mei/parcelamentos]', erros[0]?.erro ?? res?.termoAutorizacaoErro);
          }
        }
      }
    } catch (err) {
      listaRetorno = [];
      setParcelamentos([]);
      if (__DEV__) console.warn('[mei/parcelamentos]', err);
    } finally {
      if (showLoading) setParcelamentosLoading(false);
    }
    return listaRetorno;
  }, [normalizedCnpj, contribuinteTipo]);

  const loadMeiPeriods = useCallback(async (options?: { silent?: boolean; refresh?: boolean }) => {
    if (!normalizedCnpj || normalizedCnpj.length !== 14) {
      setMeiPeriods([]);
      setMeiPeriodsError(null);
      setMeiPeriodsLoading(false);
      return;
    }
    const silent = Boolean(options?.silent);
    const refresh = Boolean(options?.refresh);
    if (meiPeriodsInFlightRef.current && !refresh) return;

    const cachedBefore = readMeiOverviewPeriods(normalizedCnpj);
    if (refresh) {
      clearMeiOverviewCache(normalizedCnpj);
    } else if (cachedBefore?.length) {
      setMeiPeriods(cachedBefore);
    }
    const showLoading = !silent || refresh || !cachedBefore?.length;
    if (showLoading) setMeiPeriodsLoading(true);
    setMeiPeriodsError(null);
    meiPeriodsInFlightRef.current = true;
    try {
      if (isFocoSimplesUi) {
        const data = await withMeiFetchTimeout(
          fetchSimplesDasPeriods({
            cnpj: normalizedCnpj,
            refresh,
          }),
        );
        const rows = Array.isArray(data?.periods) ? data.periods : [];
        setMeiPeriods(rows);
        writeMeiOverviewPeriods(normalizedCnpj, rows);
        if (!data?.integration?.configured) {
          setMeiPeriodsError(
            data?.integration?.message
              || 'Integração Simples Nacional (PGDAS-D) não configurada no servidor.',
          );
        } else if (data?.remoteError) {
          setMeiPeriodsError(toMeiUserErrorMessage(data.remoteError));
        } else if (rows.length === 0) {
          setMeiPeriodsError(
            'Nenhuma declaração PGDAS-D encontrada para este CNPJ no ano. Transmita a declaração no portal ou confira a procuração e-CAC.',
          );
        } else {
          setMeiPeriodsError(null);
        }
        return;
      }

      const contrib = contribuinteTipo ? { numero: normalizedCnpj, tipo: contribuinteTipo } : undefined;
      const fetchOpts = refresh ? { refresh: true } : undefined;
      const fetchPromise = hasUserCertificate && contrib
        ? fetchMeiPeriods(normalizedCnpj, contrib, fetchOpts)
        : fetchMeiPeriodsByCnpj(normalizedCnpj, fetchOpts);
      const list = await withMeiFetchTimeout(fetchPromise);
      const rows = Array.isArray(list) ? list : [];
      setMeiPeriods(rows);
      writeMeiOverviewPeriods(normalizedCnpj, rows);
      if (rows.length === 0) {
        setMeiPeriodsError(null);
      }
    } catch (err) {
      if (refresh) clearMeiOverviewCache(normalizedCnpj);
      const cached = readMeiOverviewPeriods(normalizedCnpj);
      if (cached?.length) {
        setMeiPeriods(cached);
        setMeiPeriodsError(null);
      } else {
        setMeiPeriods([]);
        const isTimeout = err instanceof Error && err.message === 'MEI_FETCH_TIMEOUT';
        const rawMessage = err instanceof Error ? err.message : '';
        setMeiPeriodsError(
          isTimeout
            ? 'A consulta demorou demais. Você ainda pode baixar o PDF do mês.'
            : toMeiUserErrorMessage(rawMessage || 'Não foi possível consultar os meses. Tente de novo.'),
        );
      }
      if (__DEV__) console.warn('[mei/periods]', err);
    } finally {
      meiPeriodsInFlightRef.current = false;
      if (showLoading) setMeiPeriodsLoading(false);
    }
  }, [normalizedCnpj, contribuinteTipo, hasUserCertificate]);

  const syncNotasEmProcessamento = useCallback(async (lista: NfseRecord[]): Promise<NfseRecord[]> => {
    const candidates = lista.filter(
      (n) =>
        notaFiscalStatusPrecisaSyncAutomatico(n.status) && notaFiscalPodeSincronizarEstadoEmissor(n)
    );
    if (candidates.length === 0) return lista;

    const results = await Promise.allSettled(candidates.map((n) => obterNfse(n.id, true)));
    const byId = new Map<string, NfseRecord>();
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        byId.set(candidates[index].id, result.value);
      }
    });
    if (byId.size === 0) return lista;
    return lista.map((n) => byId.get(n.id) ?? n);
  }, []);

  const refreshPendingNotasStatus = useCallback(async () => {
    if (notasSyncInFlightRef.current) return;
    const current = notasRef.current;
    const hasPending = current.some(
      (n) =>
        notaFiscalStatusPrecisaSyncAutomatico(n.status) && notaFiscalPodeSincronizarEstadoEmissor(n)
    );
    if (!hasPending) return;

    notasSyncInFlightRef.current = true;
    try {
      const updated = await syncNotasEmProcessamento(current);
      setNotas(updated);
    } finally {
      notasSyncInFlightRef.current = false;
    }
  }, [syncNotasEmProcessamento]);

  const loadNotas = useCallback(
    async (options?: { syncPending?: boolean; silent?: boolean }) => {
      const syncPending = options?.syncPending !== false;
      if (!options?.silent) setNotasLoading(true);
      try {
        const list = await listarNfse({
          includeArchived: nfseIncludeArchived,
          ...(nfseDocumentTypeFilter !== 'all' ? { documentType: nfseDocumentTypeFilter } : {}),
        });
        const arr = Array.isArray(list) ? list : [];
        const next = syncPending ? await syncNotasEmProcessamento(arr) : arr;
        setNotas(next);
        for (const nota of next) {
          if (nota.archived_at || !isHiddenNfseE0014RejectedRecord(nota)) continue;
          if (e0014ArchiveTimersRef.current.has(nota.id)) continue;
          const timer = setTimeout(() => {
            e0014ArchiveTimersRef.current.delete(nota.id);
            void arquivarNfse(nota.id)
              .then(() => loadNotas({ syncPending: false, silent: true }))
              .catch(() => {});
          }, 20000);
          e0014ArchiveTimersRef.current.set(nota.id, timer);
        }
        return next;
      } catch {
        setNotas([]);
        return [] as NfseRecord[];
      } finally {
        if (!options?.silent) setNotasLoading(false);
      }
    },
    [nfseIncludeArchived, nfseDocumentTypeFilter, syncNotasEmProcessamento]
  );

  const loadMeiLimiteServidor = useCallback(async () => {
    if (!hasCertificate) {
      setMeiLimiteServidor(null);
      setMeiLimiteServidorReady(true);
      setMeiLimiteServidorLoading(false);
      return;
    }
    setMeiLimiteServidorLoading(true);
    try {
      const ano = new Date().getFullYear();
      const data = await fetchLimiteFaturamentoMei({ year: ano });
      setMeiLimiteServidor({
        totalUtilizadoReais: data.totalUtilizadoReais,
        notasConsideradas: data.notasConsideradas,
      });
    } catch {
      setMeiLimiteServidor(null);
    } finally {
      setMeiLimiteServidorReady(true);
      setMeiLimiteServidorLoading(false);
    }
  }, [hasCertificate]);

  const handleAtualizarNotasToolbar = useCallback(async () => {
    try {
      const synced = await loadNotas({ syncPending: true });
      void loadMeiLimiteServidor();
      const pending = synced.filter((n) => {
        const key = getNfseStatusKey(n.status);
        return key === 'processando' || key === 'aguardando';
      }).length;
      showToast(
        pending > 0
          ? `Lista atualizada. ${pending} nota(s) ainda em processamento no emissor.`
          : 'Lista e status das notas atualizados.',
        pending > 0 ? 'info' : 'success'
      );
    } catch {
      showToast('Não foi possível atualizar as notas.', 'error');
    }
  }, [loadNotas, loadMeiLimiteServidor, showToast]);

  const atualizarParcelasPorCompetencia = useCallback(async (listaBase?: ParcelamentoItem[]) => {
    const base = listaBase ?? parcelamentos;
    if (normalizedCnpj.length !== 14 || base.length === 0) {
      setParcelasPorNumero({});
      return;
    }
    const contrib =
      contribuinteTipo ? { numero: normalizedCnpj, tipo: contribuinteTipo } : undefined;
    setParcelasFilterLoading(true);
    try {
      const entries = await Promise.all(
        base
          .filter((p) => p.numero && p.modalidade && isParcelamentoEmAberto(p.situacao))
          .map(async (p) => {
            const numero = parcelamentoNumeroKey(p.numero);
            try {
              const res = await fetchParcelamentoParcelas(
                numero,
                normalizedCnpj,
                p.modalidade,
                contrib
              );
              return [numero, Array.isArray(res?.parcelas) ? res.parcelas : []] as const;
            } catch {
              return [numero, []] as const;
            }
          })
      );
      const map: Record<string, ParcelamentoParcelaOption[]> = {};
      for (const [numero, parcelas] of entries) {
        map[numero] = parcelas;
      }
      setParcelasPorNumero(map);
    } finally {
      setParcelasFilterLoading(false);
    }
  }, [normalizedCnpj, contribuinteTipo, parcelamentos]);

  const handleAtualizarParcelamentos = useCallback(async () => {
    const lista = await loadParcelamentos({ scope: 'all' });
    await atualizarParcelasPorCompetencia(lista);
  }, [loadParcelamentos, atualizarParcelasPorCompetencia]);

  const handleAtualizarPeriodosDas = useCallback(async () => {
    await loadMeiPeriods({ refresh: true });
  }, [loadMeiPeriods]);

  useEffect(() => {
    if (activeTab === 'parcelamentos') void loadParcelamentos({ scope: 'all' });
  }, [activeTab, loadParcelamentos]);

  useEffect(() => {
    if (parcelamentos.length === 0) return;
    void atualizarParcelasPorCompetencia();
  }, [parcelamentos, atualizarParcelasPorCompetencia]);

  useEffect(() => {
    if (activeTab !== 'das') return;
    if (meiCertificateLoading) return;
    if (normalizedCnpj.length !== 14) return;
    void loadMeiPeriods({ silent: true });
  }, [activeTab, normalizedCnpj, hasCertificate, meiCertificateLoading, loadMeiPeriods]);

  useEffect(() => {
    if (activeTab === 'notas') void loadNotas({ syncPending: true });
  }, [activeTab, loadNotas]);

  useEffect(() => {
    if (activeTab !== 'notas') return undefined;
    const hasPending = notas.some(
      (n) =>
        notaFiscalStatusPrecisaSyncAutomatico(n.status) && notaFiscalPodeSincronizarEstadoEmissor(n)
    );
    if (!hasPending) return undefined;

    const timer = setInterval(() => {
      void refreshPendingNotasStatus();
    }, 20_000);

    return () => clearInterval(timer);
  }, [activeTab, notas, refreshPendingNotasStatus]);

  useEffect(() => {
    if (activeTab !== 'notas') return;
    const hasPending = notas.some(
      (n) =>
        notaFiscalStatusPrecisaSyncAutomatico(n.status) && notaFiscalPodeSincronizarEstadoEmissor(n)
    );
    if (!hasPending) return;
    const quick = setTimeout(() => {
      void refreshPendingNotasStatus();
    }, 4_000);
    return () => clearTimeout(quick);
  }, [activeTab, nfseDocumentTypeFilter, nfseIncludeArchived, refreshPendingNotasStatus]);

  // Pré-carrega no Início (overview): useLayoutEffect para marcar loading antes do paint e o card mostrar overlay imediato.
  useLayoutEffect(() => {
    if (meiCertificateLoading) return;
    if (!hasCertificate) return;
    void loadNotas();
  }, [meiCertificateLoading, hasCertificate, loadNotas]);

  useLayoutEffect(() => {
    if (meiCertificateLoading) return;
    if (!hasCertificate) return;
    void loadMeiLimiteServidor();
  }, [meiCertificateLoading, hasCertificate, loadMeiLimiteServidor]);

  useLayoutEffect(() => {
    if (meiCertificateLoading) return;
    if (!hasCertificate) return;
    if (normalizedCnpj.length !== 14) return;
    void loadMeiPeriods({ silent: true });
    // Foco Simples: scope all (PARCSN). MEI: só modalidades MEI (mais leve).
    void loadParcelamentos({
      scope: isFocoSimplesUi ? 'all' : 'mei',
      silent: true,
    });
  }, [
    meiCertificateLoading,
    hasCertificate,
    normalizedCnpj,
    loadMeiPeriods,
    loadParcelamentos,
  ]);

  const certDocDigitsLen = useMemo(
    () => (certDocumento ? String(certDocumento).replace(/\D/g, '').length : 0),
    [certDocumento]
  );
  const overviewCnpjPendingFromCert = useMemo(
    () =>
      hasCertificate &&
      !meiCertificateLoading &&
      certDocDigitsLen === 14 &&
      normalizedCnpj.length !== 14,
    [hasCertificate, meiCertificateLoading, certDocDigitsLen, normalizedCnpj.length]
  );

  const overviewCertCardLoading = meiCertificateLoading;
  /** Na visão geral não bloqueia cards com overlay — métricas atualizam em background. */
  const overviewDasCardLoading = useMemo(
    () => meiCertificateLoading || (hasCertificate && overviewCnpjPendingFromCert),
    [hasCertificate, meiCertificateLoading, overviewCnpjPendingFromCert]
  );

  const overviewDasGuiasMetric = useMemo(() => {
    const aguardandoDados =
      hasCertificate && normalizedCnpj.length === 14 && meiPeriods.length === 0 && meiPeriodsLoading;
    const tudoEmDia =
      meiPeriodsEmAberto.length === 0 &&
      hasCertificate &&
      normalizedCnpj.length === 14 &&
      !aguardandoDados &&
      meiPeriods.length > 0;
    return {
      tudoEmDia,
      texto: aguardandoDados
        ? '…'
        : tudoEmDia
          ? 'Tudo em dia'
          : String(meiPeriodsEmAberto.length),
    };
  }, [
    meiPeriodsEmAberto.length,
    hasCertificate,
    normalizedCnpj.length,
    meiPeriodsLoading,
    meiPeriods.length,
  ]);

  const overviewNotasCardLoading = useMemo(
    () =>
      meiCertificateLoading || (hasCertificate && notasLoading && (notas?.length ?? 0) === 0),
    [hasCertificate, meiCertificateLoading, notasLoading, notas?.length]
  );
  const overviewParcCardLoading = useMemo(
    () => meiCertificateLoading || (hasCertificate && overviewCnpjPendingFromCert),
    [hasCertificate, meiCertificateLoading, overviewCnpjPendingFromCert]
  );

  const overviewParcMetric = useMemo(() => {
    const aguardandoDados =
      hasCertificate && normalizedCnpj.length === 14 && parcelamentos.length === 0 && parcelamentosLoading;
    const tudoEmDia =
      parcelasEmAbertoCount === 0 &&
      hasCertificate &&
      normalizedCnpj.length === 14 &&
      !aguardandoDados &&
      !parcelamentosLoading;
    return {
      tudoEmDia,
      texto: aguardandoDados ? '…' : tudoEmDia ? 'Tudo em dia' : String(parcelasEmAbertoCount || parcelamentos.length),
    };
  }, [
    parcelasEmAbertoCount,
    parcelamentos.length,
    hasCertificate,
    normalizedCnpj.length,
    parcelamentosLoading,
  ]);

  const meiLimiteBundle = useMemo(() => {
    const anoCivil = new Date().getFullYear();
    const regime = isFocoSimplesUi ? 'simples' : 'mei';
    const agregadoServidor =
      meiLimiteServidorReady && meiLimiteServidor !== null ? meiLimiteServidor : undefined;
    return {
      anoCivil,
      regime,
      vigenciaLabel: getVigenciaLabelParaAno(anoCivil, regime),
      progresso: computeMeiLimiteProgresso(notas, {
        anoCivil,
        regime,
        agregadoServidor,
      }),
    };
  }, [notas, meiLimiteServidor, meiLimiteServidorReady]);

  const overviewLimiteCardLoading = useMemo(
    () =>
      meiCertificateLoading
      || (hasCertificate && (meiLimiteServidorLoading || (notasLoading && (notas?.length ?? 0) === 0))),
    [hasCertificate, meiCertificateLoading, meiLimiteServidorLoading, notasLoading, notas?.length],
  );

  const meiOverviewLoadingBackdrop = useMemo(
    () => (
      <>
        <BlurView
          intensity={Platform.OS === 'ios' ? 48 : Platform.OS === 'android' ? 40 : 32}
          tint={isDarkMode ? 'dark' : 'light'}
          {...(Platform.OS === 'android'
            ? { blurMethod: 'dimezisBlurViewSdk31Plus' as const }
            : {})}
          style={styles.overviewLoadingBlur}
        />
        <View style={styles.overviewLoadingVeil} pointerEvents="none" />
      </>
    ),
    [styles, isDarkMode]
  );

  const handleCreateGuide = async () => {
    if (normalizedCnpj.length !== 14 || (!isFocoSimplesUi && !contribuinteTipo)) {
      Alert.alert('Erro', 'Informe um CNPJ válido');
      return;
    }
    setCreateGuideLoading(true);
    try {
      const periodoApuracao = `${selectedYear}${selectedMonth}`;

      if (isFocoSimplesUi) {
        const guide = await gerarSimplesDas({ cnpj: normalizedCnpj, periodoApuracao });
        if (!guide?.pdfBase64) {
          Alert.alert(
            'Sem PDF',
            'A Receita não devolveu o arquivo. Confirme a declaração no PGDAS-D.',
            [{ text: `Abrir ${DAS_PORTAL_LABEL}`, onPress: () => void handleOpenPgmei() }, { text: 'OK' }],
          );
          return;
        }
        const saved = await saveMeiGuidePdfFromBase64(
          guide.pdfBase64,
          guide.filename || `DAS-SN-${periodoApuracao}.pdf`,
        );
        await presentDownloadedFile(saved, {
          mimeType: 'application/pdf',
          dialogTitle: 'DAS Simples Nacional',
        });
        Alert.alert('Sucesso', 'PDF do DAS Simples gerado.');
        loadMeiPeriods({ refresh: true });
        return;
      }

      const input = {
        cnpj: normalizedCnpj,
        periodoApuracao,
        contribuinte: { numero: normalizedCnpj, tipo: contribuinteTipo! },
      };
      const guide = await createMeiGuide(input);

      if (!guide?.pdfBase64) {
        Alert.alert(
          'Sem PDF',
          'A Receita não devolveu o arquivo. Para mês já pago, baixe o comprovante no PGMEI.',
          [{ text: 'Abrir PGMEI', onPress: () => void handleOpenPgmei() }, { text: 'OK' }]
        );
        return;
      }

      const saved = await saveMeiGuidePdfFromBase64(
        guide.pdfBase64,
        guide.filename || `das-mei-${periodoApuracao}.pdf`
      );
      await presentDownloadedFile(saved, {
        mimeType: 'application/pdf',
        dialogTitle: 'Guia MEI',
      });
      Alert.alert('Sucesso', 'PDF gerado. Abra o arquivo e confira se o nome é o seu (Fernando).');
      loadMeiPeriods({ refresh: true });
    } catch (e: any) {
      const msg = String(e?.message || 'Não foi possível criar a guia');
      const isIndisponivel = String(e?.code || '') === 'MEI_DAS_PERIODO_INDISPONIVEL'
        || /indispon[ií]vel|n[aã]o era optante/i.test(msg);
      if (isIndisponivel) {
        Alert.alert('Período indisponível', msg);
      } else if (
        String(e?.code || '') === 'MEI_DAS_PAID_NO_PDF' || /j[aá]\s*pago|n[aã]o devolveu/i.test(msg)
      ) {
        Alert.alert(
          'Mês já pago',
          `${msg}\n\nBaixe o comprovante no site da Receita (${DAS_PORTAL_LABEL}).`,
          [
            { text: `Abrir ${DAS_PORTAL_LABEL}`, onPress: () => void handleOpenPgmei() },
            { text: 'OK' },
          ]
        );
      } else {
        Alert.alert('Erro ao criar guia', msg);
      }
    } finally {
      setCreateGuideLoading(false);
    }
  };

  const handleValidateGuide = async () => {
    if (normalizedCnpj.length !== 14) {
      Alert.alert('Erro', 'Informe um CNPJ válido');
      return;
    }
    setValidateLoading(true);
    try {
      const periodoApuracao = `${selectedYear}${selectedMonth}`;
      const res = await validateMeiGuide(normalizedCnpj, periodoApuracao);
      Alert.alert(res.valid ? 'Válido' : 'Atenção', res.message || (res.valid ? 'Período válido.' : 'Verifique o período.'));
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Não foi possível validar');
    } finally {
      setValidateLoading(false);
    }
  };

  const handlePickCertFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: Platform.OS === 'web' ? '.pfx,.cer' : ['application/x-pkcs12', 'application/pkcs12', 'application/pfx', 'application/x-x509-ca-cert'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      setPickedCertFile({
        uri: file.uri,
        name: file.name || 'certificate.pfx',
        type: file.mimeType || 'application/x-pkcs12',
      });
      setCertPlugnotasStatus(null);
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Falha ao selecionar arquivo');
    }
  };

  const handleUploadCertificate = async () => {
    if (!pickedCertFile) {
      Alert.alert('Erro', 'Selecione o arquivo .pfx primeiro');
      return;
    }
    if (!certPassword.trim()) {
      Alert.alert('Erro', 'Informe a senha do certificado');
      return;
    }
    setCertUploadLoading(true);
    setCertPlugnotasStatus(null);
    try {
      setCertUploadProgress('Validando senha e salvando...');
      const response: any = await uploadMeiCertificate(pickedCertFile, certPassword);

      setCertUploadProgress('Configurando emissão fiscal...');
      const integration = response?.plugnotasIntegration ?? null;
      setCertPlugnotasStatus(null);

      const status = await fetchMeiCertificateStatus();
      setHasUserCertificate(Boolean(status.hasUserCertificate));
      setHasCertificate(Boolean(status.hasUserCertificate || status.hasEnvCertificate));
      setHasServerCertificate(Boolean(status.hasEnvCertificate));
      setCertDocumento(status.documento || null);

      setCertPassword('');
      setPickedCertFile(null);

      resetFiscalEmitentePrefillState();
      setNfeLikeForm((f) => ({
        ...f,
        emitenteCpfCnpj: '',
        emitenteRazaoSocial: '',
        emitenteInscricaoEstadual: '',
      }));
      setNfseForm((f) => ({
        ...f,
        prestadorCpfCnpj: '',
        prestadorRazaoSocial: '',
        prestadorEmail: '',
        prestadorInscricaoMunicipal: '',
        prestadorEndereco: {
          logradouro: '',
          numero: '',
          codigoCidade: '',
          cep: '',
          complemento: '',
          bairro: '',
          estado: '',
          descricaoCidade: '',
        },
      }));

      try {
        const prefill = await fetchNfsePrestadorPrefill();
        const empresaPrefill = empresaFiscalToPrestadorPrefill(
          status.documento ? await consultarEmpresaFiscal(normalizeDoc(status.documento)).catch(() => null) : null,
        );
        setNfseForm((f) => {
          let next = mergeNfsePrestadorPrefillIntoForm(f, prefill, { onlyFillEmpty: false });
          next = mergeNfsePrestadorPrefillIntoForm(next, empresaPrefill, { onlyFillEmpty: true });
          return next;
        });
      } catch {
        /* prefill após upload é best-effort */
      }

      if (status.documento) {
        const certCnpjMasked = formatDocument(normalizeDoc(status.documento));
        setShowPlugNotasEmpresaForm(true);
        setPlugNotasCnpj(certCnpjMasked);
        lastLookupCnpjRef.current = '';
        offerCnaeImportRef.current = true;
        handleCnpjLookup(certCnpjMasked);
      }

      if (integration?.status === 'failed') {
        Alert.alert(
          'Atenção',
          `Certificado salvo, mas a configuração da empresa emissora falhou: ${integration.reason || 'erro desconhecido'}.\n\nVocê pode tentar novamente enviando o certificado outra vez.`
        );
      } else {
        Alert.alert('Sucesso', 'Certificado salvo com sucesso.');
      }
    } catch (e: unknown) {
      const certToast = getMeiCertificateUploadToast(e, {
        product: isFocoSimplesUi ? 'focosimples' : 'focomei',
      });
      if (certToast) {
        // Preferir mensagem do backend quando existir (mais específica que o toast genérico)
        const backendMsg = e instanceof Error ? e.message.trim() : '';
        showToast(backendMsg || certToast, 'error');
      } else {
        const message =
          e instanceof Error ? e.message : 'Falha ao enviar certificado';
        const isAuthError = /não autenticado|not authenticated|autenticação/i.test(message);
        showToast(
          isAuthError
            ? 'Sessão inválida ou servidor sem conexão com o login. Saia e entre novamente, ou aguarde e tente de novo.'
            : formatApiNetworkError(message),
          'error',
        );
      }
    } finally {
      setCertUploadLoading(false);
      setCertUploadProgress(null);
    }
  };

  const handleRemoveCertificate = async () => {
    try {
      setCertUploadLoading(true);
      await removeMeiCertificate();
      const status = await fetchMeiCertificateStatus();
      setHasUserCertificate(Boolean(status.hasUserCertificate));
      setHasServerCertificate(Boolean(status.hasEnvCertificate));
      setHasCertificate(Boolean(status.hasUserCertificate || status.hasEnvCertificate));
      // Limpa empresa, CNPJ e documento da UI — dados ficam no banco para quando enviar novo cert
      setCertDocumento(null);
      setCnpj('');
      setEmpresaFiscal(null);
      setIsEditingEmpresa(false);
      setShowPlugNotasEmpresaForm(false);
      resetFiscalEmitentePrefillState();
      setNfeLikeForm(getDefaultNfeLikeForm());
      Alert.alert('Sucesso', 'Certificado removido.');
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Falha ao remover certificado');
    } finally {
      setCertUploadLoading(false);
    }
  };

  const handleDownloadParcelaRow = async (row: ParcelaLedgerRow) => {
    if (!parcelaRowPermiteDownload(row)) {
      showToast(`Não há DAS para baixar em ${row.label}.`, 'info');
      return;
    }
    setParcelamentoDownloadRowKey(row.id);
    try {
      const contrib =
        normalizedCnpj.length === 14 && contribuinteTipo
          ? { numero: normalizedCnpj, tipo: contribuinteTipo }
          : undefined;
      const result = await downloadParcelamentoPdf(
        row.pedidoNumero,
        normalizedCnpj || undefined,
        row.modalidade,
        contrib,
        row.periodoApuracao
      );
      await presentDownloadedFile(result, {
        mimeType: 'application/pdf',
        dialogTitle: `DAS parcelamento ${row.label}`,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Falha ao baixar PDF';
      showToast(msg || 'Não foi possível baixar o DAS deste parcelamento.');
    } finally {
      setParcelamentoDownloadRowKey(null);
    }
  };

  const handleDownloadTodasParcelas = async () => {
    const rows = buildParcelaLedgerRows(parcelamentos, parcelasPorNumero).filter(
      parcelaRowPermiteDownload
    );
    if (rows.length === 0) {
      showToast('Nenhuma parcela disponível para baixar.', 'info');
      return;
    }
    setParcelamentoBulkLoading(true);
    let ok = 0;
    const falhas: string[] = [];
    const contrib =
      normalizedCnpj.length === 14 && contribuinteTipo
        ? { numero: normalizedCnpj, tipo: contribuinteTipo }
        : undefined;
    for (const row of rows) {
      try {
        const result = await downloadParcelamentoPdf(
          row.pedidoNumero,
          normalizedCnpj || undefined,
          row.modalidade,
          contrib,
          row.periodoApuracao
        );
        await presentDownloadedFile(result, {
          mimeType: 'application/pdf',
          dialogTitle: `DAS ${row.label}`,
        });
        ok += 1;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Falha ao baixar';
        falhas.push(`${row.label}: ${msg}`);
      }
    }
    setParcelamentoBulkLoading(false);
    if (falhas.length === 0) {
      showToast(`${ok} guia(s) baixada(s).`, 'success');
    } else if (ok === 0) {
      showToast(falhas[0] || 'Nenhuma guia baixada.', 'error');
    } else {
      showToast(`${ok} de ${rows.length} baixadas. ${falhas[0]}`, 'error');
    }
  };

  const handleNotaPdf = async (id: string) => {
    setNotaActionId(id);
    try {
      const result = await baixarNfsePdf(id);
      await presentDownloadedFile(result, {
        mimeType: 'application/pdf',
        dialogTitle: 'Nota fiscal',
      });
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Falha ao baixar PDF');
    } finally {
      setNotaActionId(null);
    }
  };

  const handleNotaXml = async (id: string) => {
    setNotaActionId(id);
    try {
      const result = await baixarNfseXml(id);
      await presentDownloadedFile(result, {
        mimeType: 'application/xml',
        dialogTitle: 'XML da nota',
      });
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Falha ao baixar XML');
    } finally {
      setNotaActionId(null);
    }
  };

  const handleSyncNotaEstado = async (id: string) => {
    setNotaActionId(id);
    try {
      const updated = await obterNfse(id, true);
      setNotas((current) => current.map((item) => (item.id === id ? updated : item)));
      showToast('Status da nota atualizado.', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Falha ao atualizar o status da nota.', 'error');
    } finally {
      setNotaActionId(null);
    }
  };

  const handleCancelarNota = async (id: string) => {
    const confirmed = await confirmDialog({
      title: 'Cancelar nota',
      message: 'Tem certeza que deseja cancelar esta nota no emissor fiscal?',
      confirmLabel: 'Sim, cancelar',
      destructive: true,
    });
    if (!confirmed) return;

    setNotaActionId(id);
    try {
      const updated = await cancelarNfse(id);
      const statusKey = getNfseStatusKey(updated.status);
      const cancelMeta = (updated.metadata_json as { cancelamento?: { providerError?: string } } | null)
        ?.cancelamento;
      setNotas((current) => {
        const next = current.map((item) => (item.id === id ? updated : item));
        if (statusKey === 'cancelamento_pendente' || statusKey === 'cancelado') {
          queueMicrotask(() => {
            void syncNotasEmProcessamento(next).then((synced) => setNotas(synced));
          });
        }
        return next;
      });
      if (statusKey === 'cancelado') {
        showToast('Nota cancelada no emissor.', 'success');
        void loadMeiLimiteServidor();
      } else if (cancelMeta?.providerError) {
        showToast(
          `Cancelamento registrado (pendente no emissor). Detalhe: ${cancelMeta.providerError}`,
          'info',
        );
      } else {
        showToast(
          'Cancelamento registrado. O status será atualizado quando o emissor confirmar.',
          'info',
        );
      }
    } catch (e: any) {
      showToast(e?.message || 'Falha ao cancelar nota', 'error');
    } finally {
      setNotaActionId(null);
    }
  };

  const handleArquivarNota = async (id: string) => {
    setNotaActionId(id);
    try {
      await arquivarNfse(id);
      showToast('Nota arquivada.', 'success');
      void loadNotas({ syncPending: false, silent: true });
    } catch (e: any) {
      showToast(e?.message || 'Falha ao arquivar', 'error');
    } finally {
      setNotaActionId(null);
    }
  };

  const handleOpenEditNota = (n: NfseRecord) => {
    setEditingNota(n);
    setEditNotaDescricao((n as any).descricao_interna ?? (n.metadata_json as any)?.descricaoInterna ?? '');
    setEditNotaVisible(true);
  };

  const handleSaveEditNota = async () => {
    if (!editingNota?.id) return;
    setEditNotaLoading(true);
    try {
      await atualizarNfse(editingNota.id, { descricaoInterna: editNotaDescricao.trim() || undefined });
      Alert.alert('Sucesso', 'Nota atualizada.');
      setEditNotaVisible(false);
      setEditingNota(null);
      setEditNotaDescricao('');
      loadNotas();
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Falha ao atualizar nota');
    } finally {
      setEditNotaLoading(false);
    }
  };

  const updatePlugNotasCompanyForm = (updates: Partial<PlugNotasCompanyForm>) => {
    setPlugNotasCompanyForm((prev) => ({ ...prev, ...updates }));
  };

  // Auto-fill via BrasilAPI quando o CNPJ atinge 14 dígitos
  const cnpjLookupAbortRef = useRef<AbortController | null>(null);
  const lastLookupCnpjRef = useRef<string>('');

  const buildCnaesFromLookup = useCallback((data: {
    cnaes?: CnpjLookupCnaeItem[]
    cnaePrincipal?: { codigo: string; descricao: string | null } | null
    cnaesSecundarios?: Array<{ codigo: string; descricao: string | null }>
  }): CnpjLookupCnaeItem[] => {
    if (Array.isArray(data.cnaes) && data.cnaes.length > 0) return data.cnaes
    return [
      ...(data.cnaePrincipal?.codigo
        ? [{ ...data.cnaePrincipal, principal: true as const }]
        : []),
      ...((data.cnaesSecundarios || []).map((c) => ({ ...c, principal: false as const }))),
    ].filter((c) => c.codigo)
  }, [])

  const openImportCnaesFromEmpresa = useCallback(async () => {
    const digits = normalizeDoc(certDocumento || plugNotasCnpj || '')
    if (digits.length !== 14) {
      showToast('CNPJ do certificado não encontrado. Confirme o cadastro da empresa.', 'error')
      return
    }
    setCnpjLookupLoading(true)
    try {
      const data = await lookupCnpj(digits)
      const unified = buildCnaesFromLookup(data)
      if (unified.length === 0) {
        showToast('Nenhum CNAE encontrado para este CNPJ na Receita.', 'info')
        return
      }
      setPendingImportCnaes(unified)
      setImportCnaesVisible(true)
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Falha ao consultar CNAEs do CNPJ.', 'error')
    } finally {
      setCnpjLookupLoading(false)
    }
  }, [buildCnaesFromLookup, certDocumento, plugNotasCnpj, showToast])

  const handleCnpjLookup = useCallback(async (cnpjMasked: string) => {
    const digits = normalizeDoc(cnpjMasked);
    if (digits.length !== 14 || lastLookupCnpjRef.current === digits) return;
    lastLookupCnpjRef.current = digits;

    cnpjLookupAbortRef.current?.abort();
    const controller = new AbortController();
    cnpjLookupAbortRef.current = controller;

    setCnpjLookupLoading(true);
    setCnpjLookupError(null);
    try {
      const data = await lookupCnpj(digits);
      if (controller.signal.aborted) return;
      setPlugNotasCompanyForm((prev) => ({
        ...prev,
        razaoSocial: data.razaoSocial || prev.razaoSocial,
        nomeFantasia: data.nomeFantasia || prev.nomeFantasia,
        email: data.email || prev.email,
        cep: data.endereco?.cep || prev.cep,
        logradouro: data.endereco?.logradouro || prev.logradouro,
        numero: (data.endereco?.numero && String(data.endereco.numero).trim())
          ? String(data.endereco.numero).trim()
          : (prev.numero || 'S/N'),
        complemento: data.endereco?.complemento || prev.complemento,
        bairro: data.endereco?.bairro || prev.bairro,
        codigoCidade: data.endereco?.codigoCidade || prev.codigoCidade,
        descricaoCidade: data.endereco?.descricaoCidade || prev.descricaoCidade,
        estado: data.endereco?.estado || prev.estado,
      }));

      if (offerCnaeImportRef.current) {
        offerCnaeImportRef.current = false;
        const unified = buildCnaesFromLookup(data)
        if (unified.length > 0) {
          setPendingImportCnaes(unified);
          setImportCnaesVisible(true);
        } else {
          showToast('Certificado ok, mas a Receita não retornou CNAEs agora. Use “Importar CNAEs / serviços”.', 'info')
        }
      }
    } catch (err: any) {
      if (controller.signal.aborted) return;
      setCnpjLookupError(err?.message || 'Falha ao consultar CNPJ');
      if (offerCnaeImportRef.current) {
        offerCnaeImportRef.current = false;
      }
    } finally {
      if (!controller.signal.aborted) setCnpjLookupLoading(false);
    }
  }, [buildCnaesFromLookup, showToast]);

  const loadCatalogClientes = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const list = await listarCatalogoNfseClientes({ limit: 50, documentType: emitirNotaType });
      setCatalogClientes(Array.isArray(list) ? list : []);
    } catch {
      setCatalogClientes([]);
    } finally {
      setCatalogLoading(false);
    }
  }, [emitirNotaType]);

  const loadCatalogProdutos = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const docType =
        emitirNotaType === 'NFE' || emitirNotaType === 'NFCE' ? emitirNotaType : 'NFSE';
      const list = await listarCatalogoNfseProdutos({ limit: 50, documentType: docType });
      setCatalogProdutos(Array.isArray(list) ? list : []);
    } catch {
      setCatalogProdutos([]);
    } finally {
      setCatalogLoading(false);
    }
  }, [emitirNotaType]);

  const lookupTomadorByCnpj = useCallback(async (cnpjMasked: string) => {
    const digits = normalizeDoc(cnpjMasked);
    if (digits.length !== 14) return;
    if (lastTomadorLookupDocRef.current === digits) return;

    const fromCatalog = catalogClientes.find(
      (item) => normalizeDoc(item.documento || '') === digits,
    );
    if (fromCatalog && catalogClienteHasTomadorEndereco(fromCatalog)) {
      const prefill = applyCatalogClienteToNfseForm(fromCatalog);
      setNfseForm((f) => ({
        ...f,
        tomadorCpfCnpj: formatDocument(digits),
        tomadorRazaoSocial: f.tomadorRazaoSocial?.trim() || prefill.tomadorRazaoSocial,
        tomadorEmail: f.tomadorEmail?.trim() || prefill.tomadorEmail,
        tomadorEndereco: prefill.tomadorEndereco,
      }));
      lastTomadorLookupDocRef.current = digits;
      return;
    }

    setTomadorCnpjLookupLoading(true);
    try {
      const prefill = await resolveNfseTomadorByCnpj(cnpjMasked, catalogClientes, lookupCnpj);
      if (!prefill) return;
      setNfseForm((f) => ({
        ...f,
        tomadorCpfCnpj: formatDocument(digits),
        tomadorRazaoSocial: f.tomadorRazaoSocial?.trim() || prefill.tomadorRazaoSocial,
        tomadorEmail: f.tomadorEmail?.trim() || prefill.tomadorEmail,
        tomadorEndereco: prefill.tomadorEndereco,
      }));
      lastTomadorLookupDocRef.current = digits;
      if (isTomadorEnderecoComplete(prefill.tomadorEndereco)) {
        showToast('Tomador preenchido pela Receita Federal.', 'success');
      }
    } catch (e: unknown) {
      showToast(
        e instanceof Error ? e.message : 'Não foi possível consultar o CNPJ do tomador.',
        'error',
      );
    } finally {
      setTomadorCnpjLookupLoading(false);
    }
  }, [catalogClientes, showToast]);

  const handleSelectCatalogCliente = (item: NfseCatalogCliente) => {
    if (emitirNotaType === 'NFSE') {
      const prefill = applyCatalogClienteToNfseForm(item);
      setNfseForm((f) => ({
        ...f,
        tomadorCpfCnpj: prefill.tomadorCpfCnpj
          ? formatDocument(normalizeDoc(prefill.tomadorCpfCnpj))
          : '',
        tomadorRazaoSocial: prefill.tomadorRazaoSocial,
        tomadorEmail: prefill.tomadorEmail,
        tomadorEndereco: prefill.tomadorEndereco,
      }));
      lastTomadorLookupDocRef.current = normalizeDoc(prefill.tomadorCpfCnpj);
      if (
        normalizeDoc(prefill.tomadorCpfCnpj).length === 14
        && !catalogClienteHasTomadorEndereco(item)
      ) {
        void lookupTomadorByCnpj(prefill.tomadorCpfCnpj);
      }
    } else {
      const prefill = applyCatalogClienteToNfeForm(item);
      setNfeLikeForm((f) => ({
        ...f,
        destinatarioCpfCnpj: prefill.destinatarioCpfCnpj
          ? formatDocument(normalizeDoc(prefill.destinatarioCpfCnpj))
          : '',
        destinatarioRazaoSocial: prefill.destinatarioRazaoSocial,
        destinatarioEmail: prefill.destinatarioEmail,
        destinatarioIndIEDest: prefill.destinatarioIndIEDest,
        destinatarioEndereco: prefill.destinatarioEndereco,
      }));
      if (emitirNotaType === 'NFE' && !catalogClienteHasNfeEndereco(item)) {
        showToast(
          'Cliente sem endereço no catálogo. Edite o cadastro (ícone lápis) e salve com CNPJ para buscar endereço.',
          'error',
        );
      }
    }
    setCatalogClienteVisible(false);
  };

  const handleSelectCatalogProduto = (item: NfseCatalogProduto) => {
    if (emitirNotaType === 'NFSE') {
      const codigoCatalogo = String(item.codigo ?? '').trim();
      setNfseForm((f) => ({
        ...f,
        servico: {
          ...f.servico,
          codigo: codigoCatalogo,
          cnae: item.cnae ?? '',
          discriminacao: item.discriminacao ?? '',
          aliquota: item.aliquota != null ? String(item.aliquota) : '',
          valorServico: item.valor_sugerido != null ? String(item.valor_sugerido) : '',
        },
      }));
      if (!codigoCatalogo || codigoCatalogo.replace(/[^0-9A-Za-z]/g, '').length < 6) {
        showToast(
          'Este serviço ainda não tem código LC 116 completo (mín. 6 caracteres, ex.: 17.19.01). Complete o campo Código serviço.',
          'error',
        );
      }
    } else {
      if (!isCatalogProdutoUsableForNfeLike(item, emitirNotaType)) {
        showToast(
          'Produto sem dados NF-e completos. Edite no catálogo (NCM, CFOP e tributos).',
          'error',
        );
        return;
      }
      const row = mapCatalogProdutoToNfeItem(item);
      setNfeLikeForm((f) => ({
        ...f,
        itens: f.itens.length > 0
          ? f.itens.map((it, i) => (i === 0 ? row : it))
          : [row],
      }));
    }
    setCatalogProdutoVisible(false);
  };

  const handleEmitirNotaSubmit = async () => {
    if (emitirNotaInFlightRef.current || emitirNotaLoading) return;

    const reportEmitError = (message: string) => {
      setEmitirNotaError(message);
      showToast(message, 'error');
    };

    if (emitirNotaType === 'NFSE') {
      if (tomadorCnpjLookupLoading) {
        reportEmitError('Aguarde a busca do endereço do tomador…');
        return;
      }

      let formToEmit = nfseForm;
      const tomadorDigits = normalizeDoc(nfseForm.tomadorCpfCnpj ?? '');
      if (tomadorDigits.length === 14 && !isTomadorEnderecoComplete(nfseForm.tomadorEndereco)) {
        setTomadorCnpjLookupLoading(true);
        try {
          const prefill = await resolveNfseTomadorByCnpj(
            nfseForm.tomadorCpfCnpj ?? '',
            catalogClientes,
            lookupCnpj,
          );
          if (prefill) {
            formToEmit = {
              ...nfseForm,
              tomadorRazaoSocial:
                nfseForm.tomadorRazaoSocial?.trim() || prefill.tomadorRazaoSocial,
              tomadorEmail: nfseForm.tomadorEmail?.trim() || prefill.tomadorEmail,
              tomadorEndereco: prefill.tomadorEndereco,
            };
            setNfseForm(formToEmit);
            lastTomadorLookupDocRef.current = tomadorDigits;
          }
        } catch (e: unknown) {
          reportEmitError(
            e instanceof Error ? e.message : 'Não foi possível buscar o endereço do tomador.',
          );
          return;
        } finally {
          setTomadorCnpjLookupLoading(false);
        }
      }

      const msg = getNfseValidationMessage(formToEmit);
      if (msg) {
        reportEmitError(msg);
        return;
      }
      if (emitirNotaInFlightRef.current) return;
      emitirNotaInFlightRef.current = true;
      setEmitirNotaPending(true);
      setEmitirNotaError(null);
      setEmitirNotaVisible(false);
      setEmitirNotaLoading(false);
      setActiveTab('notas');
      setNfseIncludeArchived(false);
      showToast(
        'Nota em envio. Acompanhe em Documentos emitidos.',
        'success',
      );

      void (async () => {
        try {
          const created = await emitirNfse(formToEmit);
          const statusKey = getNfseStatusKey(created?.status);
          await loadNotas({ syncPending: true });
          void loadMeiLimiteServidor();
          if (statusKey === 'rejeitado') {
            const detail = extractNfseFailureMessage(created?.response_json, created?.metadata_json)
              || 'A nota foi rejeitada. Veja o motivo na lista — em breve vai para Arquivadas.';
            showToast(detail, 'error');
          } else if (statusKey === 'processando') {
            showToast(
              'Nota enviada. A prefeitura está processando — acompanhe em Documentos emitidos.',
              'success',
            );
          } else {
            showToast('NFSe emitida.', 'success');
          }
        } catch (e: unknown) {
          const raw = e instanceof Error ? e.message : 'Falha ao emitir NFSe';
          showToast(humanizeFiscalEmitError(raw, { documentType: 'NFSE' }), 'error');
          void loadNotas({ syncPending: true });
        } finally {
          emitirNotaInFlightRef.current = false;
          setEmitirNotaPending(false);
        }
      })();
      return;
    }
    const docType = emitirNotaType as 'NFE' | 'NFCE';
    const form = nfeLikeForm;
    const msg = getNfeLikeValidationMessage(form, docType);
    if (msg) {
      reportEmitError(msg);
      return;
    }
    if (docType === 'NFE' && empresaFiscal && !empresaFiscal.nfe?.ativo) {
      reportEmitError(
        'NF-e não está activa para sua empresa no Plugnotas. Active em Certificado → Empresa ou contacte o suporte Plugnotas.',
      );
      return;
    }
    if (docType === 'NFCE' && empresaFiscal && !empresaFiscal.nfce?.ativo) {
      reportEmitError(
        'NFC-e não está activa para sua empresa no Plugnotas. Active em Certificado → Empresa ou contacte o suporte Plugnotas.',
      );
      return;
    }
    emitirNotaInFlightRef.current = true;
    setEmitirNotaPending(true);
    setEmitirNotaError(null);
    setEmitirNotaVisible(false);
    setEmitirNotaLoading(false);
    setActiveTab('notas');
    setNfseIncludeArchived(false);
    showToast(
      docType === 'NFE' ? 'NF-e em envio…' : 'NFC-e em envio…',
      'success',
    );

    const payload = buildNfeLikePayloadFromForm(form, docType);
    void (async () => {
      try {
        const created = docType === 'NFE' ? await emitirNfe(payload) : await emitirNfce(payload);
        const statusKey = getNfseStatusKey(created?.status);
        await loadNotas({ syncPending: true });
        if (statusKey === 'rejeitado') {
          showToast(
            extractNfseFailureMessage(created?.response_json, created?.metadata_json)
              || `${docType === 'NFE' ? 'NF-e' : 'NFC-e'} rejeitada. Veja o motivo na lista.`,
            'error',
          );
        } else {
          showToast(docType === 'NFE' ? 'NF-e emitida.' : 'NFC-e emitida.', 'success');
        }
        void loadNotas({ syncPending: true });
      } catch (e: unknown) {
        const raw = e instanceof Error ? e.message : 'Falha ao emitir nota';
        showToast(
          humanizeFiscalEmitError(raw, {
            documentType: docType,
            nfeAtivo: empresaFiscal?.nfe?.ativo,
            nfceAtivo: empresaFiscal?.nfce?.ativo,
          }),
          'error',
        );
        void loadNotas({ syncPending: true });
      } finally {
        emitirNotaInFlightRef.current = false;
        setEmitirNotaPending(false);
      }
    })();
  };

  const openEmitirNotaModal = () => {
    setEmitirNotaError(null);
    resetFiscalEmitentePrefillState();
    setNfeLikeForm(getDefaultNfeLikeForm());
    setEmitirNotaVisible(true);
  };

  const handlePlugNotasCertUpload = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const file = result.assets[0];
    if (!plugNotasPfxPassword.trim()) {
      Alert.alert('Erro', 'Informe a senha do certificado.');
      return;
    }
    setPlugNotasCertLoading(true);
    try {
      const resp = await cadastrarPlugNotasCertificado({
        arquivo: { uri: file.uri, name: file.name || 'certificate.pfx', type: file.mimeType || 'application/x-pkcs12' },
        senha: plugNotasPfxPassword,
      });
      setPlugNotasPfxPassword('');
      Alert.alert('Sucesso', 'Certificado enviado para integração fiscal.');
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Falha ao enviar certificado.');
    } finally {
      setPlugNotasCertLoading(false);
    }
  };

  const handleStartEditEmpresa = () => {
    if (!empresaFiscal) return;
    setIsEditingEmpresa(true);
    setPlugNotasCnpj(formatDocument(empresaFiscal.cpfCnpj || ''));
    setPlugNotasCompanyForm(empresaFiscalToCompanyForm(empresaFiscal));
    setShowPlugNotasEmpresaForm(true);
  };

  const handleCancelEditEmpresa = () => {
    setIsEditingEmpresa(false);
    setShowPlugNotasEmpresaForm(false);
    setPlugNotasCompanyForm(getDefaultPlugNotasCompanyForm());
  };

  const handlePlugNotasEmpresaSubmit = async () => {
    const cnpjNorm = normalizeDoc(plugNotasCnpj);
    if (cnpjNorm.length !== 14) {
      showToast('Informe um CNPJ válido com 14 dígitos.', 'error');
      return;
    }
    // Tipos vêm do espelho admin — o cliente não escolhe o que pode emitir.
    const formForSave = {
      ...plugNotasCompanyForm,
      nfseAtivo: Boolean(documentosPermitidos.nfse) || (!documentosPermitidos.nfe && !documentosPermitidos.nfce),
      nfeAtivo: Boolean(documentosPermitidos.nfe),
      nfceAtivo: false,
    };
    const msg = getPlugNotasCompanyValidationMessage(formForSave);
    if (msg) {
      showToast(msg, 'error');
      return;
    }
    setPlugNotasEmpresaLoading(true);
    try {
      const payload = buildPlugNotasEmpresaPayload({
        cnpj: cnpjNorm,
        certificadoId: '',
        form: formForSave,
      });

      let empresaJaCadastrada = Boolean(empresaFiscal?.cpfCnpj);
      if (!empresaJaCadastrada) {
        try {
          const consulted = await consultarEmpresaFiscal(cnpjNorm);
          empresaJaCadastrada = Boolean(consulted?.cpfCnpj);
        } catch {
          /* empresa ainda não existe no emissor */
        }
      }

      const shouldUpdate = isEditingEmpresa || empresaJaCadastrada;
      if (shouldUpdate) {
        await atualizarPlugNotasEmpresa(payload);
      } else {
        await cadastrarPlugNotasEmpresa(payload);
      }

      showToast('Empresa salva.', 'success');
      setIsEditingEmpresa(false);
      setShowPlugNotasEmpresaForm(false);

      try {
        const refreshed = await consultarEmpresaFiscal(cnpjNorm);
        setEmpresaFiscal(refreshed);
      } catch { /* não bloquear se refresh falhar */ }
    } catch (e: unknown) {
      const message = e instanceof Error
        ? e.message
        : (isEditingEmpresa ? 'Falha ao atualizar empresa' : 'Falha ao salvar empresa');
      showToast(message, 'error');
    } finally {
      setPlugNotasEmpresaLoading(false);
    }
  };

  const tabs: { key: MeiTab; label: string }[] = [
    { key: 'overview', label: 'Início' },
    { key: 'certificado', label: 'Certificado' },
    { key: 'das', label: isFocoSimplesUi ? 'DAS Simples' : 'Guia DAS' },
    { key: 'parcelamentos', label: isDesktop ? 'Parcelamentos' : 'Parcelar' },
    { key: 'notas', label: 'Notas' },
  ];

  // Sidebar items para desktop (com badges contextuais)
  const sidebarTabs: { key: MeiTab; label: string; icon: React.ComponentProps<typeof Ionicons>['name']; badge?: number }[] = [
    { key: 'overview', label: 'Início', icon: 'home-outline' },
    { key: 'certificado', label: 'Certificado', icon: 'shield-checkmark-outline' },
    {
      key: 'das',
      label: isFocoSimplesUi ? 'DAS Simples' : 'Guia DAS',
      icon: 'document-text-outline',
      badge: meiPeriodsEmAberto.length || undefined,
    },
    {
      key: 'parcelamentos',
      label: 'Parcelamentos',
      icon: 'list-outline',
      badge: parcelasEmAbertoCount || undefined,
    },
    { key: 'notas', label: 'Notas', icon: 'receipt-outline', badge: notas?.length || undefined },
  ];

  // Texto do CNPJ formatado para o chip
  const cnpjChipText = normalizedCnpj.length === 14 ? formatDocument(normalizedCnpj) : '—';

  const shellCanvasBg =
    hasGlobalNav && Platform.OS === 'web'
      ? isDarkMode
        ? SHELL_CANVAS_DARK
        : SHELL_CANVAS_LIGHT
      : undefined;

  const mobileTabSubtitle: Record<MeiTab, string> = {
    overview: 'Toque na opção que você precisa',
    das: 'Guia do mês em PDF',
    parcelamentos: 'Parcelamentos do MEI',
    notas: 'Emitir e ver suas notas',
    certificado: 'Enviar certificado digital A1',
  };

  const dasPeriodLabel = formatMeiPeriodLabel(selectedMonth, selectedYear);

  const handleDasPrevPeriod = () => {
    const next = shiftMeiPeriod(selectedMonth, selectedYear, -1);
    setSelectedMonth(next.month);
    setSelectedYear(next.year);
  };

  const handleDasNextPeriod = () => {
    const next = shiftMeiPeriod(selectedMonth, selectedYear, 1);
    setSelectedMonth(next.month);
    setSelectedYear(next.year);
  };

  const handleSelectDasPeriod = (period: MeiPeriod) => {
    const periodoApuracao = meiCompetenciaToPeriodoApuracao(period.competencia);
    if (!periodoApuracao) return;
    setSelectedYear(Number(periodoApuracao.slice(0, 4)));
    setSelectedMonth(periodoApuracao.slice(4, 6));
  };

  const mobileTabsWithBadges = tabs.map((tab) => ({
    ...tab,
    badge:
      tab.key === 'das'
        ? meiPeriodsEmAberto.length || undefined
        : tab.key === 'parcelamentos'
          ? parcelasEmAbertoCount || undefined
          : tab.key === 'notas'
            ? notas?.length || undefined
            : undefined,
  }));

  return (
    <SafeAreaView
      style={[styles.container, shellCanvasBg ? { backgroundColor: shellCanvasBg } : null]}
      edges={['top', 'bottom']}
    >
      {/* Header desktop legado (topbar azul) */}
      {isDesktop && !(hasGlobalNav && isDesktop) ? (
        <View style={styles.header}>
          {!hasGlobalNav ? (
            <TouchableOpacity
              onPress={openDrawer}
              hitSlop={10}
              style={{ padding: 4, marginRight: 8 }}
              accessibilityLabel="Abrir menu"
            >
              <Ionicons name="menu" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          ) : null}
          <View style={styles.headerBrand}>
            <Text style={styles.headerTitleDesktop}>{APP_BRAND_NAME}</Text>
            <Text style={styles.headerSubtitleDesktop}>Olá, {displayName || 'Usuário'}</Text>
          </View>
        </View>
      ) : null}

      {/* Mobile — só header fixo; abas rolam com o conteúdo */}
      {!isDesktop ? (
        <MfAppHeader
          title={NOTAS_AREA_TITLE}
          subtitle={mobileTabSubtitle[activeTab]}
          onMenuPress={openDrawer}
        />
      ) : null}

      <MfScrollView
        style={[styles.scrollView, Platform.OS === 'web' ? webScrollStyle : null]}
        contentContainerStyle={isDesktop ? styles.scrollContent : styles.scrollContentMobile}
        showsVerticalScrollIndicator
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      >
        {!isDesktop ? (
          <MeiTabBar tabs={mobileTabsWithBadges} active={activeTab} onChange={handleTabChange} />
        ) : null}

        {/* Sub-header MEI (desktop) — só na visão geral para não repetir título em cada aba */}
        {isDesktop && activeTab === 'overview' && (
          <View style={styles.meiSubHeader}>
            <View style={styles.meiSubHeaderLeft}>
              <Text style={styles.meiSubHeaderTitle}>🏛️  {NOTAS_AREA_TITLE}</Text>
              <Text style={styles.meiSubHeaderDesc}>
                Gerencie guias DAS, notas fiscais, parcelamentos e dados do contribuinte.
              </Text>
            </View>
            <View style={styles.meiSubHeaderRight}>
              <View style={styles.contextChip}>
                <View>
                  <Text style={styles.contextChipLabel}>CNPJ</Text>
                  <Text style={styles.contextChipValue}>{cnpjChipText}</Text>
                </View>
              </View>
              <View style={styles.contextChip}>
                <View
                  style={[
                    styles.contextChipDot,
                    { backgroundColor: hasCertificate ? theme.success : theme.error },
                  ]}
                />
                <View>
                  <Text style={styles.contextChipLabel}>Certificado</Text>
                  <Text
                    style={
                      hasUserCertificate
                        ? styles.contextChipValueSuccess
                        : styles.contextChipValueError
                    }
                  >
                    {meiCertificateLoading
                      ? 'Verificando...'
                      : hasUserCertificate
                      ? 'Configurado'
                      : 'Não configurado'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Layout 2-col desktop */}
        <View style={styles.meiLayout}>

          {/* Sidebar secundária — só desktop */}
          {isDesktop && (
            <View style={styles.meiSidebar}>
              {sidebarTabs.map(({ key, label, icon, badge }) => {
                const isActive = activeTab === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.sidebarItem, isActive && styles.sidebarItemActive]}
                    onPress={() => handleTabChange(key)}
                    activeOpacity={0.7}
                  >
                    {key === 'certificado'
                      ? <CertificateIcon size={18} color={isActive ? theme.primary : theme.textSecondary} />
                      : <Ionicons name={icon} size={18} color={isActive ? theme.primary : theme.textSecondary} />
                    }
                    <Text
                      style={[
                        styles.sidebarItemLabel,
                        isActive && styles.sidebarItemLabelActive,
                      ]}
                    >
                      {label}
                    </Text>
                    {typeof badge === 'number' && badge > 0 && (
                      <View
                        style={[
                          styles.sidebarBadge,
                          isActive && styles.sidebarBadgeActive,
                        ]}
                      >
                        <Text style={styles.sidebarBadgeText}>{badge}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Conteúdo principal */}
          <View style={isDesktop ? [styles.meiContent, activeTab === 'das' && styles.meiContentDas] : { flex: 1 }}>
            {isDesktop && activeTab !== 'das' && (
              <View style={styles.meiContentHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.meiContentTitle}>
                    {sidebarTabs.find((t) => t.key === activeTab)?.label || 'Início'}
                  </Text>
                  <Text style={styles.meiContentDesc}>
                    {activeTab === 'overview' && NOTAS_AREA_SUBTITLE}
                    {activeTab === 'parcelamentos' && 'Acompanhe parcelamentos ativos e baixe os PDFs.'}
                    {activeTab === 'notas' &&
                      'Emita, consulte e sincronize NFSe, NFe e NFC-e com o emissor.'}
                    {activeTab === 'certificado' && 'Certificado digital e dados da empresa emissora.'}
                  </Text>
                </View>
              </View>
            )}
            {isDesktop && activeTab === 'das' && (
              <View style={styles.meiDasPageHeader}>
                <Text style={styles.meiDasPageTitle}>{DAS_PAGE_TITLE}</Text>
                <Text style={styles.meiDasPageDesc}>{DAS_PAGE_DESC}</Text>
              </View>
            )}
        {activeTab === 'overview' && (
          <View style={styles.overviewSection}>
            <MeiLimiteFaturamentoCard
              anoCivil={meiLimiteBundle.anoCivil}
              progresso={meiLimiteBundle.progresso}
              vigenciaLabel={meiLimiteBundle.vigenciaLabel}
              loading={overviewLimiteCardLoading}
              variant={meiLimiteBundle.regime}
              onIrParaNotas={() => handleTabChange('notas')}
            />
            {isDesktop ? (
            <View style={styles.overviewGrid}>
              <TouchableOpacity
                style={styles.overviewCard}
                onPress={() => setActiveTab('certificado')}
                activeOpacity={0.85}
                disabled={overviewCertCardLoading}
              >
                <View
                  style={[
                    styles.overviewIconWrap,
                    hasCertificate ? styles.overviewIconWrapSuccess : styles.overviewIconWrapError,
                  ]}
                >
                  <CertificateIcon size={22} color={hasCertificate ? theme.success : theme.error} />
                </View>
                <Text style={styles.overviewTitle}>Certificado Digital</Text>
                <Text style={styles.overviewDesc}>
                  {hasUserCertificate
                    ? 'Certificado A1 instalado e válido para emissão.'
                    : 'Você ainda não enviou um certificado A1. Sem ele, não é possível emitir notas nem baixar guias.'}
                </Text>
                <View style={styles.overviewMetric}>
                  <Text style={styles.overviewMetricLabel}>Status</Text>
                  <Text
                    style={[
                      styles.overviewMetricValue,
                      hasUserCertificate ? styles.overviewMetricValueSuccess : styles.overviewMetricValueError,
                    ]}
                  >
                    {meiCertificateLoading ? '...' : hasUserCertificate ? 'Pronto' : 'Pendente'}
                  </Text>
                </View>
                <Text style={styles.overviewCta}>Gerenciar →</Text>
                {overviewCertCardLoading ? (
                  <View style={styles.overviewLoadingOverlay} pointerEvents="box-none">
                    {meiOverviewLoadingBackdrop}
                    <ActivityIndicator size={MEI_OVERVIEW_LOADING_SPINNER_SIZE} color={theme.primary} />
                  </View>
                ) : null}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.overviewCard}
                onPress={handleOverviewDasCardPress}
                activeOpacity={0.85}
                disabled={overviewDasCardLoading}
              >
                <View style={[styles.overviewIconWrap, styles.overviewIconWrapWarn]}>
                  <Ionicons name="document-text-outline" size={22} color={theme.warning} />
                </View>
                <Text style={styles.overviewTitle}>
                  {isFocoSimplesUi ? 'DAS · Simples Nacional' : 'DAS · Guias mensais'}
                </Text>
                <Text style={styles.overviewDesc}>
                  Gere e baixe as guias do Simples Nacional MEI mês a mês.
                </Text>
                <View style={styles.overviewMetric}>
                  <Text style={styles.overviewMetricLabel}>Guias em aberto</Text>
                  <Text
                    style={[
                      styles.overviewMetricValue,
                      overviewDasGuiasMetric.tudoEmDia
                        ? styles.overviewMetricValueSuccess
                        : styles.overviewMetricValueWarn,
                    ]}
                  >
                    {overviewDasGuiasMetric.texto}
                  </Text>
                </View>
                <Text style={styles.overviewCta}>Abrir guias →</Text>
                {overviewDasCardLoading ? (
                  <View style={styles.overviewLoadingOverlay} pointerEvents="box-none">
                    {meiOverviewLoadingBackdrop}
                    <ActivityIndicator size={MEI_OVERVIEW_LOADING_SPINNER_SIZE} color={theme.primary} />
                  </View>
                ) : null}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.overviewCard}
                onPress={() => handleTabChange('notas')}
                activeOpacity={0.85}
                disabled={overviewNotasCardLoading}
              >
                <View style={styles.overviewIconWrap}>
                  <Ionicons name="receipt-outline" size={22} color={theme.primary} />
                </View>
                <Text style={styles.overviewTitle}>Notas fiscais</Text>
                <Text style={styles.overviewDesc}>
                  NFSe, NFe e NFC-e emitidas. Tabela completa com filtros e ações por nota.
                </Text>
                <View style={styles.overviewMetric}>
                  <Text style={styles.overviewMetricLabel}>Total emitidas</Text>
                  <Text style={styles.overviewMetricValue}>{String(notas?.length || 0)}</Text>
                </View>
                <Text style={styles.overviewCta}>Ver notas →</Text>
                {overviewNotasCardLoading ? (
                  <View style={styles.overviewLoadingOverlay} pointerEvents="box-none">
                    {meiOverviewLoadingBackdrop}
                    <ActivityIndicator size={MEI_OVERVIEW_LOADING_SPINNER_SIZE} color={theme.primary} />
                  </View>
                ) : null}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.overviewCard}
                onPress={() => handleTabChange('parcelamentos')}
                activeOpacity={0.85}
                disabled={overviewParcCardLoading}
              >
                <View style={styles.overviewIconWrap}>
                  <Ionicons name="list-outline" size={22} color={theme.primary} />
                </View>
                <Text style={styles.overviewTitle}>Parcelamentos</Text>
                <Text style={styles.overviewDesc}>
                  Consulte parcelamentos ativos e baixe os PDFs disponíveis para download.
                </Text>
                <View style={styles.overviewMetric}>
                  <Text style={styles.overviewMetricLabel}>Ativos</Text>
                  <Text
                    style={[
                      styles.overviewMetricValue,
                      overviewParcMetric.tudoEmDia
                        ? styles.overviewMetricValueSuccess
                        : styles.overviewMetricValue,
                    ]}
                  >
                    {overviewParcMetric.texto}
                  </Text>
                </View>
                <Text style={styles.overviewCta}>Ver detalhes →</Text>
                {overviewParcCardLoading ? (
                  <View style={styles.overviewLoadingOverlay} pointerEvents="box-none">
                    {meiOverviewLoadingBackdrop}
                    <ActivityIndicator size={MEI_OVERVIEW_LOADING_SPINNER_SIZE} color={theme.primary} />
                  </View>
                ) : null}
              </TouchableOpacity>
            </View>
          ) : (
            <MeiMobileOverview
              actions={[
                {
                  key: 'cert',
                  title: hasUserCertificate ? 'Ver certificado' : 'Configurar certificado',
                  hint: hasUserCertificate ? 'Já está pronto' : 'Necessário para emitir notas',
                  icon: 'shield-checkmark-outline',
                  onPress: () => setActiveTab('certificado'),
                  loading: overviewCertCardLoading,
                  status: hasUserCertificate ? 'ok' : 'warn',
                },
                {
                  key: 'das',
                  title: 'Baixar guia do mês',
                  hint: overviewDasGuiasMetric.tudoEmDia
                    ? 'Tudo em dia'
                    : `${overviewDasGuiasMetric.texto} em aberto`,
                  icon: 'document-text-outline',
                  onPress: () => void handleOverviewDasCardPress(),
                  loading: overviewDasCardLoading,
                  status: overviewDasGuiasMetric.tudoEmDia ? 'ok' : 'warn',
                },
                {
                  key: 'notas',
                  title: 'Emitir nota fiscal',
                  hint: `${notas?.length || 0} notas já emitidas`,
                  icon: 'receipt-outline',
                  onPress: () => handleTabChange('notas'),
                  loading: overviewNotasCardLoading,
                },
                {
                  key: 'parc',
                  title: 'Ver parcelamentos',
                  hint: overviewParcMetric.texto,
                  icon: 'list-outline',
                  onPress: () => handleTabChange('parcelamentos'),
                  loading: overviewParcCardLoading,
                },
              ]}
            />
            )}
          </View>
        )}

        {activeTab === 'das' && (
        <>
        {false && isDesktop ? (
          <View>
            <View style={styles.dasToolbar}>
              <View style={styles.dasToolbarLeft}>
                <Ionicons name="document-text-outline" size={18} color={theme.primary} />
                <Text style={styles.dasToolbarTitle}>Guias DAS — Simples Nacional MEI</Text>
              </View>
              <View style={styles.dasToolbarActions}>
                <TouchableOpacity
                  style={[styles.dasBtn, !canDownloadGuide && styles.dasBtnDisabled]}
                  onPress={handleDownloadGuide}
                  disabled={!canDownloadGuide}
                >
                  {downloadLoading
                    ? <ActivityIndicator size="small" color="#FFF" />
                    : <><Ionicons name="download-outline" size={14} color="#FFF" /><Text style={styles.dasBtnText}>Baixar Guia</Text></>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.dasBtnSecondary} onPress={handleOpenPgmei}>
                  <Ionicons name="open-outline" size={14} color={theme.primary} />
                  <Text style={styles.dasBtnSecondaryText}>{DAS_PORTAL_LABEL}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Painel: Contribuinte + Competência */}
            <View style={styles.dasPanelCard}>
              <View style={styles.dasPanelHeader}>
                <Text style={styles.dasPanelHeaderText}>Dados do Contribuinte</Text>
              </View>
              <View style={styles.dasFormGrid}>
                <View style={styles.dasFormField}>
                  <Text style={styles.dasFormLabel}>CNPJ do Contribuinte</Text>
                  <TextInput
                    style={[styles.dasFormInput, certDocumento && styles.dasFormInputLocked]}
                    placeholder="00.000.000/0000-00"
                    placeholderTextColor={theme.placeholder}
                    value={cnpj}
                    onChangeText={(text) => setCnpj(formatDocument(text))}
                    keyboardType="numeric"
                    maxLength={18}
                    editable={!certDocumento}
                  />
                  {certDocumento && (
                    <Text style={styles.dasFormNote}>🔒 CNPJ extraído do certificado digital</Text>
                  )}
                </View>
                <View style={styles.dasFormField}>
                  <Text style={styles.dasFormLabel}>Competência — Mês</Text>
                  <View style={styles.dasChipGroup}>
                    {availableMonths.map((month) => (
                      <TouchableOpacity
                        key={month}
                        style={[styles.dasPeriodChip, selectedMonth === month && styles.dasPeriodChipActive]}
                        onPress={() => setSelectedMonth(month)}
                      >
                        <Text style={[styles.dasPeriodChipText, selectedMonth === month && styles.dasPeriodChipTextActive]}>
                          {month}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={[styles.dasFormLabel, { marginTop: 10 }]}>Ano</Text>
                  <View style={styles.dasChipGroup}>
                    {availableYears.map((year) => (
                      <TouchableOpacity
                        key={year}
                        style={[styles.dasPeriodChip, selectedYear === year && styles.dasPeriodChipActive]}
                        onPress={() => setSelectedYear(year)}
                      >
                        <Text style={[styles.dasPeriodChipText, selectedYear === year && styles.dasPeriodChipTextActive]}>
                          {year}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
              <View style={styles.dasFormActions}>
                <TouchableOpacity
                  style={[styles.dasActionBtn, styles.dasActionBtnOutline, (validateLoading || normalizedCnpj.length !== 14) && { opacity: 0.5 }]}
                  onPress={handleValidateGuide}
                  disabled={validateLoading || normalizedCnpj.length !== 14}
                >
                  {validateLoading
                    ? <ActivityIndicator size="small" color={theme.primary} />
                    : <><Ionicons name="checkmark-circle-outline" size={16} color={theme.primary} /><Text style={styles.dasActionBtnOutlineText}>Validar</Text></>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dasActionBtn, styles.dasActionBtnPrimary, (createGuideLoading || normalizedCnpj.length !== 14 || !hasCertificate) && { opacity: 0.5 }]}
                  onPress={handleCreateGuide}
                  disabled={createGuideLoading || normalizedCnpj.length !== 14 || !hasCertificate}
                >
                  {createGuideLoading
                    ? <ActivityIndicator size="small" color="#FFF" />
                    : <><Ionicons name="add-circle-outline" size={16} color="#FFF" /><Text style={styles.dasActionBtnPrimaryText}>Criar Guia</Text></>}
                </TouchableOpacity>
              </View>
            </View>

            {/* Painel: Períodos — tabela */}
            <View style={styles.dasPanelCard}>
                <View style={styles.dasPanelHeader}>
                  <Text style={styles.dasPanelHeaderText}>Períodos — Status DAS</Text>
                  <View style={styles.dasPanelHeaderActions}>
                    {meiPeriods.length > 0 ? (
                      <Text style={styles.dasPanelHeaderCount}>{meiPeriods.length} competências</Text>
                    ) : null}
                    <TouchableOpacity
                      style={styles.dasPanelRefreshBtn}
                      onPress={() => void handleAtualizarPeriodosDas()}
                      disabled={meiPeriodsLoading || normalizedCnpj.length !== 14}
                      accessibilityRole="button"
                      accessibilityLabel="Atualizar status das competências DAS"
                    >
                      {meiPeriodsLoading ? (
                        <ActivityIndicator size="small" color={theme.primary} />
                      ) : (
                        <>
                          <Ionicons name="refresh" size={14} color={theme.primary} />
                          <Text style={styles.dasPanelRefreshBtnText}>Atualizar</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
                {meiPeriodsLoading && meiPeriods.length === 0 ? (
                  <View style={styles.dasPeriodsEmpty}>
                    <ActivityIndicator size="small" color={theme.primary} />
                    <Text style={styles.dasPeriodsEmptyText}>Carregando períodos…</Text>
                  </View>
                ) : meiPeriodsError && meiPeriods.length === 0 ? (
                  <View style={styles.dasPeriodsEmpty}>
                    <Text style={styles.dasPeriodsEmptyText}>{meiPeriodsError}</Text>
                  </View>
                ) : meiPeriods.length === 0 ? (
                  <View style={styles.dasPeriodsEmpty}>
                    <Text style={styles.dasPeriodsEmptyText}>
                      Nenhum período listado. Escolha o mês acima e use Criar Guia ou Atualizar.
                    </Text>
                  </View>
                ) : (
                <View style={styles.dasTable}>
                  <View style={styles.dasTableHeader}>
                    <Text style={[styles.dasTableHeaderCell, { flex: 1 }]}>Competência</Text>
                    <Text style={[styles.dasTableHeaderCell, { flex: 1 }]}>Status</Text>
                    <Text style={[styles.dasTableHeaderCell, { width: 100, textAlign: 'right' }]}>Valor</Text>
                    <Text style={[styles.dasTableHeaderCell, { width: 70, textAlign: 'center' }]}>Ação</Text>
                  </View>
                  {meiPeriods.slice(0, 24).map((p, idx) => {
                    const vencida = isMeiPeriodVencida(p);
                    return (
                    <View key={p.competencia} style={[styles.dasTableRow, idx % 2 === 1 && styles.dasTableRowAlt]}>
                      <Text style={[styles.dasTableCell, { flex: 1, fontWeight: '600' }]}>{p.competencia}</Text>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <View style={[
                          styles.dasStatusBadge,
                          p.status === 'pago' ? styles.dasStatusPago :
                          p.status === 'erro' ? styles.dasStatusErro :
                          p.status === 'indisponivel' ? styles.dasStatusIndisponivel :
                          vencida ? styles.dasStatusVencida :
                          styles.dasStatusAPagar,
                        ]}>
                          <Text style={[styles.dasStatusBadgeText, {
                            color: p.status === 'pago' ? theme.success :
                              p.status === 'erro' ? theme.error :
                              p.status === 'indisponivel' ? theme.textSecondary :
                              vencida ? theme.error :
                              theme.warning,
                          }]}>
                            {p.status === 'pago' ? 'Pago' :
                              p.status === 'erro' ? 'Erro' :
                              p.status === 'indisponivel' ? 'Indisponível' :
                              vencida ? 'Vencida' :
                              'A pagar'}
                          </Text>
                        </View>
                        {vencida && p.status === 'a_pagar' ? (
                          <Text style={styles.dasPeriodReason} numberOfLines={2}>
                            Venceu {p.vencimento || 'dia 20'} — baixar atualiza o valor
                          </Text>
                        ) : (p.status === 'erro' || p.status === 'indisponivel') ? (
                          <Text style={styles.dasPeriodReason} numberOfLines={2}>
                            {p.errorMessage || 'Indisponível neste mês'}
                          </Text>
                        ) : null}
                      </View>
                      <Text style={[styles.dasTableCell, { width: 100, textAlign: 'right', fontVariant: ['tabular-nums'] }]}>
                        {p.valorTotal != null && Number.isFinite(p.valorTotal)
                          ? formatCurrencyBR(p.valorTotal)
                          : '—'}
                      </Text>
                      <View style={{ width: 70, alignItems: 'center' }}>
                        <TouchableOpacity
                          style={styles.dasTableAction}
                          onPress={() => void handleDownloadGuide(p)}
                          disabled={downloadLoading || p.status === 'indisponivel' || p.status === 'erro'}
                          accessibilityLabel={
                            vencida && p.status === 'a_pagar'
                              ? `Atualizar valor e baixar guia de ${p.competencia}`
                              : `Baixar guia de ${p.competencia}`
                          }
                        >
                          <Ionicons
                            name={vencida && p.status === 'a_pagar' ? 'refresh-outline' : 'download-outline'}
                            size={15}
                            color={
                              downloadLoading || p.status === 'indisponivel' || p.status === 'erro'
                                ? theme.textTertiary
                                : theme.primary
                            }
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                    );
                  })}
                </View>
                )}
              </View>
          </View>
        ) : (
          <MeiMobileDasPanel
            cnpj={cnpj}
            certDocumento={certDocumento}
            downloadLoading={downloadLoading}
            validateLoading={validateLoading}
            createGuideLoading={createGuideLoading}
            normalizedCnpjLen={normalizedCnpj.length}
            hasCertificate={hasCertificate}
            meiPeriods={meiPeriods}
            meiPeriodsLoading={meiPeriodsLoading}
            meiPeriodsError={meiPeriodsError}
            isWide={isDesktop}
            onCnpjChange={(text) => setCnpj(formatDocument(text))}
            onValidate={() => void handleValidateGuide()}
            onCreateGuide={() => void handleCreateGuide()}
            onRefreshPeriods={() => void handleAtualizarPeriodosDas()}
            onOpenPgmei={() => void handleOpenPgmei()}
            portalButtonLabel={DAS_PORTAL_LABEL}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onSelectPeriod={handleSelectDasPeriod}
            onDownloadPeriod={(period) => {
              handleSelectDasPeriod(period);
              void handleDownloadGuide(period);
            }}
          />
        )}
        </>
        )}

        {activeTab === 'parcelamentos' && (
          <View style={[styles.section, !isDesktop && styles.mobileParcSection]}>
            <Text style={[styles.sectionTitle, !isDesktop && styles.mobileParcTitle]}>Parcelamentos</Text>
            <Text style={styles.sectionDescription}>
              Acompanhe as parcelas do pedido ativo e baixe os PDFs — mês a mês, sem escolher período antes.
            </Text>
            <MeiParcelamentosPanel
              normalizedCnpjLen={normalizedCnpj.length}
              hasCertificate={hasCertificate}
              parcelamentos={parcelamentos}
              parcelamentosLoading={parcelamentosLoading}
              parcelasPorNumero={parcelasPorNumero}
              parcelasLoading={parcelasFilterLoading}
              downloadRowKey={parcelamentoDownloadRowKey}
              bulkDownloadLoading={parcelamentoBulkLoading}
              isWide={isDesktop}
              onRefresh={() => void handleAtualizarParcelamentos()}
              onDownloadRow={(row) => void handleDownloadParcelaRow(row)}
              onDownloadAll={() => void handleDownloadTodasParcelas()}
            />
          </View>
        )}

        {activeTab === 'notas' && (
          isDesktop ? (
            /* ─── DESKTOP — notas fiscais ─── */
            <View>
              <View style={styles.notasActionBar}>
                <TouchableOpacity
                  style={styles.notasBtnPrimary}
                  onPress={openEmitirNotaModal}
                  accessibilityLabel="Emitir nova nota fiscal"
                >
                  <Ionicons name="add" size={16} color="#FFF" />
                  <Text style={styles.dasBtnText}>Emitir nota</Text>
                </TouchableOpacity>
                <View style={styles.notasActionBarGroup}>
                  <TouchableOpacity
                    style={styles.notasBtnSecondary}
                    onPress={() => void handleAtualizarNotasToolbar()}
                    disabled={notasLoading}
                    accessibilityLabel="Atualizar lista e status das notas no emissor"
                    {...(Platform.OS === 'web'
                      ? { title: 'Atualizar lista e sincronizar notas em processamento com o emissor' }
                      : {})}
                  >
                    {notasLoading ? (
                      <ActivityIndicator size="small" color={theme.primary} />
                    ) : (
                      <>
                        <Ionicons name="refresh" size={15} color={theme.primary} />
                        <Text style={styles.dasBtnSecondaryText}>Atualizar</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.notasBtnSecondary}
                    onPress={() => setCatalogClientesManageVisible(true)}
                    accessibilityLabel="Abrir catálogo de clientes"
                  >
                    <Ionicons name="people-outline" size={15} color={theme.primary} />
                    <Text style={styles.dasBtnSecondaryText}>Clientes</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.notasBtnSecondary}
                    onPress={() => setCatalogProdutosManageVisible(true)}
                    accessibilityLabel="Abrir catálogo de serviços"
                  >
                    <Ionicons name="cube-outline" size={15} color={theme.primary} />
                    <Text style={styles.dasBtnSecondaryText}>Serviços</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Filtros */}
              <View style={styles.dasPanelCard}>
                <View style={[styles.dasFilterGroup, { paddingVertical: 12, paddingHorizontal: 16 }]}>
                  <Text style={[styles.dasFormLabel, { marginBottom: 0, marginRight: 6 }]}>Tipo</Text>
                  {notasTypeFilterOptions.map((f) => (
                    <TouchableOpacity
                      key={f}
                      style={[styles.dasFilterTab, nfseDocumentTypeFilter === f && styles.dasFilterTabActive]}
                      onPress={() => setNfseDocumentTypeFilter(f)}
                    >
                      <Text style={[styles.dasFilterTabText, nfseDocumentTypeFilter === f && styles.dasFilterTabTextActive]}>
                        {f === 'all' ? 'Todos' : f === 'NFSE' ? 'NFSe' : f === 'NFE' ? 'NFe' : 'NFC-e'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <View style={{ width: 1, height: 18, backgroundColor: theme.border, marginHorizontal: 6 }} />
                  <TouchableOpacity
                    style={[styles.dasFilterTab, nfseIncludeArchived && styles.dasFilterTabActive]}
                    onPress={() => setNfseIncludeArchived((prev) => !prev)}
                  >
                    <Ionicons name="archive-outline" size={13} color={nfseIncludeArchived ? '#FFF' : theme.textSecondary} />
                    <Text style={[styles.dasFilterTabText, nfseIncludeArchived && styles.dasFilterTabTextActive]}>
                      {nfseIncludeArchived ? 'Só arquivadas' : 'Arquivadas'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Lista de notas — cards com ações nomeadas */}
              <View style={styles.dasPanelCard}>
                <View style={styles.dasPanelHeader}>
                  <Text style={styles.dasPanelHeaderText}>Documentos Emitidos</Text>
                  <Text style={styles.dasPanelHeaderCount}>{notasParaExibir.length} nota{notasParaExibir.length !== 1 ? 's' : ''}</Text>
                </View>
                {notasLoading && notasParaExibir.length === 0 ? (
                  <View style={[styles.emptyContainer, { padding: 24 }]}><ActivityIndicator size="small" color={theme.primary} /></View>
                ) : notasParaExibir.length === 0 ? (
                  <View style={[styles.emptyContainer, { padding: 32 }]}>
                    <Ionicons name="receipt-outline" size={40} color={theme.border} />
                    <Text style={[styles.emptyText, { marginTop: 12 }]}>Nenhuma nota emitida</Text>
                  </View>
                ) : (
                  <View style={{ gap: 10, paddingBottom: 8 }}>
                    {notasParaExibir.map((n) => (
                      <View key={n.id} style={[styles.dasNoteCard, { borderLeftColor: getNotaCardAccentColor(n) }]}>
                        <NotaFiscalListRowHeader
                          nota={n}
                          textColor={theme.text}
                          textSecondary={theme.textSecondary}
                        />
                        <NotaFiscalFailureBanner nota={n} errorColor={theme.error} />
                        {n.id !== '__emit_pending__' ? (
                        <NotaFiscalRowActions
                          nota={n}
                          notaActionId={notaActionId}
                          theme={theme}
                          layout="card"
                          onSync={() => void handleSyncNotaEstado(n.id)}
                          onEdit={() => handleOpenEditNota(n)}
                          onPdf={() => void handleNotaPdf(n.id)}
                          onXml={() => void handleNotaXml(n.id)}
                          onCancel={() => void handleCancelarNota(n.id)}
                          onArchive={() => void handleArquivarNota(n.id)}
                        />
                        ) : null}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          ) : (
            /* ─── MOBILE — layout intuitivo ─── */
            <View style={styles.section}>
              {/* Botão Emitir — destaque */}
              <TouchableOpacity style={styles.dasEmitButton} onPress={openEmitirNotaModal} activeOpacity={0.85}>
                <View style={styles.dasEmitButtonInner}>
                  <View style={styles.dasEmitIconWrap}>
                    <Ionicons name="add-circle" size={26} color="#FFF" />
                  </View>
                  <View>
                    <Text style={styles.dasEmitButtonTitle}>Emitir Nota Fiscal</Text>
                    <Text style={styles.dasEmitButtonSub}>{emitDocTypesLabel || 'NFSe'}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>

              {/* Catálogos */}
              <View style={[styles.buttonRow, { marginBottom: 14 }]}>
                <TouchableOpacity style={[styles.typeButton, { flex: 1 }]} onPress={() => setCatalogClientesManageVisible(true)}>
                  <Ionicons name="people-outline" size={15} color={theme.primary} />
                  <Text style={[styles.typeButtonText, { color: theme.primary, marginLeft: 4 }]}>Clientes</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.typeButton, { flex: 1 }]} onPress={() => setCatalogProdutosManageVisible(true)}>
                  <Ionicons name="cube-outline" size={15} color={theme.primary} />
                  <Text style={[styles.typeButtonText, { color: theme.primary, marginLeft: 4 }]}>Serviços</Text>
                </TouchableOpacity>
              </View>

              {/* Filtros */}
              <View style={styles.filterRow}>
                {notasTypeFilterOptions.map((f) => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.filterButton, nfseDocumentTypeFilter === f && styles.filterButtonActive]}
                    onPress={() => setNfseDocumentTypeFilter(f)}
                  >
                    <Text style={[styles.filterText, nfseDocumentTypeFilter === f && styles.filterTextActive]}>
                      {f === 'all' ? 'Todos' : f === 'NFSE' ? 'NFSe' : f === 'NFE' ? 'NFe' : 'NFC-e'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={[styles.buttonRow, { marginBottom: 14 }]}>
                <TouchableOpacity
                  style={[styles.filterButton, nfseIncludeArchived && styles.filterButtonActive, { flex: 1 }]}
                  onPress={() => setNfseIncludeArchived((prev) => !prev)}
                >
                  <Text style={[styles.filterText, nfseIncludeArchived && styles.filterTextActive]}>
                    {nfseIncludeArchived ? '✓ Arquivadas' : 'Arquivadas'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.downloadButton, { flex: 1, marginTop: 0 }]}
                  onPress={() => void handleAtualizarNotasToolbar()}
                  disabled={notasLoading}
                  accessibilityLabel="Atualizar lista e status das notas"
                >
                  {notasLoading
                    ? <ActivityIndicator size="small" color="#FFF" />
                    : <Text style={styles.downloadButtonText}>Atualizar</Text>}
                </TouchableOpacity>
              </View>

              {/* Lista de notas */}
              {notasLoading && notasParaExibir.length === 0 ? (
                <View style={[styles.emptyContainer, { padding: 20 }]}><ActivityIndicator size="small" color={theme.primary} /></View>
              ) : notasParaExibir.length === 0 ? (
                <View style={[styles.emptyContainer, { padding: 24 }]}>
                  <Ionicons name="receipt-outline" size={36} color={theme.border} />
                  <Text style={[styles.emptyText, { marginTop: 10 }]}>Nenhuma nota emitida</Text>
                </View>
              ) : (
                notasParaExibir.map((n) => (
                  <View key={n.id} style={[styles.dasNoteCard, { borderLeftColor: getNotaCardAccentColor(n) }]}>
                    <NotaFiscalListRowHeader
                      nota={n}
                      textColor={theme.text}
                      textSecondary={theme.textSecondary}
                    />
                    <NotaFiscalFailureBanner nota={n} errorColor={theme.error} />
                    {n.id !== '__emit_pending__' ? (
                    <NotaFiscalRowActions
                      nota={n}
                      notaActionId={notaActionId}
                      theme={theme}
                      layout="card"
                      onSync={() => void handleSyncNotaEstado(n.id)}
                      onEdit={() => handleOpenEditNota(n)}
                      onPdf={() => void handleNotaPdf(n.id)}
                      onXml={() => void handleNotaXml(n.id)}
                      onCancel={() => void handleCancelarNota(n.id)}
                      onArchive={() => void handleArquivarNota(n.id)}
                    />
                    ) : null}
                  </View>
                ))
              )}
            </View>
          )
        )}

        {activeTab === 'certificado' && (
          <View style={isDesktop ? styles.configGrid : styles.section}>

            {/* ===== Card: Certificado Digital ===== */}
            <View style={isDesktop ? styles.configCard : { marginBottom: 8 }}>
              <View style={styles.configCardHeader}>
                <CertificateIcon size={22} color={theme.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.configCardTitle}>Certificado Digital (A1)</Text>
                  <Text style={styles.configCardSubtitle}>
                    Necessário para gerar guias DAS e emitir notas fiscais
                  </Text>
                </View>
              </View>
            {meiCertificateLoading ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : hasUserCertificate ? (
              <>
              <View style={styles.configCertActive}>
                <View style={styles.configCertActiveLeft}>
                  <Ionicons name="checkmark-circle" size={20} color={theme.success} />
                  <Text style={styles.configCertActiveText}>Certificado ativo</Text>
                </View>
                <TouchableOpacity onPress={handleRemoveCertificate} disabled={certUploadLoading} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  {certUploadLoading
                    ? <ActivityIndicator size="small" color={theme.error} />
                    : <Ionicons name="trash-outline" size={20} color={theme.error} />}
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.downloadButton, { marginTop: 12 }, cnpjLookupLoading && { opacity: 0.6 }]}
                onPress={() => void openImportCnaesFromEmpresa()}
                disabled={cnpjLookupLoading}
                accessibilityRole="button"
                accessibilityLabel="Importar CNAEs para o catálogo de serviços"
              >
                {cnpjLookupLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.downloadButtonText}>Importar CNAEs / serviços</Text>
                )}
              </TouchableOpacity>
              <Text style={[styles.sectionDescription, { marginTop: 8 }]}>
                Busca as atividades do CNPJ na Receita e adiciona no catálogo (código LC 116 você completa depois).
              </Text>
              </>
            ) : (
              <>
                <Text style={styles.sectionDescription}>
                  {isFocoSimplesUi
                    ? 'Envie o certificado A1 (e-CNPJ) da própria empresa (.pfx). Ele assina o termo Autentica Procurador na SERPRO e habilita DAS Simples e notas.'
                    : 'Envie o certificado A1 (PFX) para gerar guias DAS e emitir notas.'}
                </Text>

                {/* Passo 1: selecionar arquivo */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>1. Arquivo do certificado (.pfx)</Text>
                  {pickedCertFile ? (
                    <View style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}>
                        <Ionicons name="document-attach" size={18} color={theme.success} />
                        <Text style={{ flex: 1, fontSize: 13, color: theme.text }} numberOfLines={1}>
                          {pickedCertFile.name}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => { setPickedCertFile(null); setCertPlugnotasStatus(null); }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        disabled={certUploadLoading}
                      >
                        <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 8 }]}
                      onPress={handlePickCertFile}
                      disabled={certUploadLoading}
                    >
                      <Ionicons name="cloud-upload-outline" size={18} color={theme.primary} />
                      <Text style={{ fontSize: 14, color: theme.primary, fontWeight: '600' }}>Selecionar arquivo .pfx</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Passo 2: senha (só aparece se arquivo selecionado) */}
                {pickedCertFile && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>2. Senha do certificado</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Senha do .pfx"
                      placeholderTextColor={theme.placeholder}
                      value={certPassword}
                      onChangeText={setCertPassword}
                      secureTextEntry
                      editable={!certUploadLoading}
                    />
                  </View>
                )}

                {/* Passo 3: botão (só ativo com arquivo + senha) */}
                <TouchableOpacity
                  style={[styles.downloadButton, (!pickedCertFile || !certPassword.trim()) && { opacity: 0.5 }]}
                  onPress={handleUploadCertificate}
                  disabled={certUploadLoading || !pickedCertFile || !certPassword.trim()}
                >
                  {certUploadLoading ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={styles.downloadButtonText}>{certUploadProgress || 'Enviando...'}</Text>
                    </View>
                  ) : (
                    <Text style={styles.downloadButtonText}>
                      {!pickedCertFile ? 'Selecione o arquivo primeiro' :
                       !certPassword.trim() ? 'Informe a senha' :
                       'Enviar certificado'}
                    </Text>
                  )}
                </TouchableOpacity>

              </>
            )}
            {meiError ? <Text style={styles.errorText}>{meiError}</Text> : null}
            </View>

            {/* ===== Divider: Certificado → Empresa ===== */}
            {!isDesktop && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 16, gap: 12 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
                <Text style={{ fontSize: 11, color: theme.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Dados da Empresa</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
              </View>
            )}

            {/* ===== Card: Dados da Empresa ===== */}
            <View style={isDesktop ? styles.configCard : { marginBottom: 8 }}>
              {isDesktop && (
                <View style={styles.configCardHeader}>
                  <Ionicons name="business-outline" size={22} color={theme.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.configCardTitle}>Dados da Empresa</Text>
                    <Text style={styles.configCardSubtitle}>Informações da empresa emissora</Text>
                  </View>
                </View>
              )}
            {!hasCertificate && (
              <View style={[styles.inputGroup, { backgroundColor: theme.warning + '15', padding: 12, borderRadius: 8 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                  <Ionicons name="warning-outline" size={18} color={theme.warning} />
                  <Text style={{ flex: 1, fontSize: 13, color: theme.text, lineHeight: 18 }}>
                    Envie primeiro o <Text style={{ fontWeight: '600' }}>Certificado Digital (A1)</Text> no card acima.
                    Depois é só preencher os dados da empresa aqui — o certificado é reaproveitado automaticamente para emissão fiscal.
                  </Text>
                </View>
              </View>
            )}
            {empresaFiscalLoading ? (
              <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: 12 }} />
            ) : empresaFiscal?.cpfCnpj && !isEditingEmpresa ? (
              <EmpresaFiscalCard empresa={empresaFiscal} theme={theme} onEdit={handleStartEditEmpresa} />
            ) : !empresaFiscal?.cpfCnpj ? (
              <TouchableOpacity
                style={[styles.sectionHeader, { marginTop: 12 }]}
                onPress={() => setShowPlugNotasEmpresaForm((p) => !p)}
                activeOpacity={0.8}
              >
                <Text style={styles.sectionTitle}>
                  {hasCertificate ? 'Dados da empresa' : 'Cadastrar empresa'}
                </Text>
                <Ionicons name={showPlugNotasEmpresaForm ? 'chevron-up' : 'chevron-down'} size={20} color={theme.text} />
              </TouchableOpacity>
            ) : null}
            {showPlugNotasEmpresaForm && (
              <View style={styles.sectionBody}>
                {isEditingEmpresa ? (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 14, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                    <Text style={styles.sectionTitle}>Editar empresa</Text>
                    <TouchableOpacity
                      onPress={handleCancelEditEmpresa}
                      style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: theme.border }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel="Cancelar edição"
                    >
                      <Text style={{ fontSize: 13, color: theme.textSecondary, fontWeight: '600' }}>Cancelar</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
                <View style={styles.inputGroup}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={[styles.label, { marginBottom: 0 }]}>CNPJ da empresa</Text>
                    {cnpjLookupLoading && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <ActivityIndicator size="small" color={theme.primary} />
                        <Text style={{ fontSize: 11, color: theme.primary, fontWeight: '600' }}>
                          Consultando...
                        </Text>
                      </View>
                    )}
                  </View>
                  <TextInput
                    style={[styles.input, certDocumento && { backgroundColor: theme.border, color: theme.textSecondary }]}
                    placeholder="00.000.000/0000-00"
                    placeholderTextColor={theme.placeholder}
                    value={plugNotasCnpj}
                    onChangeText={(t) => {
                      const masked = formatDocument(t);
                      setPlugNotasCnpj(masked);
                      const digits = normalizeDoc(masked);
                      if (digits.length === 14) {
                        handleCnpjLookup(masked);
                      } else {
                        lastLookupCnpjRef.current = '';
                        setCnpjLookupError(null);
                      }
                    }}
                    keyboardType="numeric"
                    maxLength={18}
                    editable={!certDocumento}
                  />
                  {cnpjLookupError && (
                    <Text style={{ fontSize: 12, color: theme.error, marginTop: 6 }}>
                      ⚠️ {cnpjLookupError}
                    </Text>
                  )}
                  {!cnpjLookupError && !cnpjLookupLoading && normalizeDoc(plugNotasCnpj).length === 14 && plugNotasCompanyForm.razaoSocial && (
                    <Text style={{ fontSize: 12, color: theme.success, marginTop: 6 }}>
                      ✓ Dados preenchidos automaticamente
                    </Text>
                  )}
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Razão social {requiredMark}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Razão social"
                    placeholderTextColor={theme.placeholder}
                    value={plugNotasCompanyForm.razaoSocial}
                    onChangeText={(t) => updatePlugNotasCompanyForm({ razaoSocial: t })}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Nome fantasia</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Nome fantasia"
                    placeholderTextColor={theme.placeholder}
                    value={plugNotasCompanyForm.nomeFantasia}
                    onChangeText={(t) => updatePlugNotasCompanyForm({ nomeFantasia: t })}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>CEP {requiredMark}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="00000-000"
                    placeholderTextColor={theme.placeholder}
                    value={plugNotasCompanyForm.cep}
                    onChangeText={(t) => updatePlugNotasCompanyForm({ cep: t.replace(/\D/g, '').slice(0, 8) })}
                    keyboardType="numeric"
                    maxLength={8}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Logradouro {requiredMark}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Rua, avenida..."
                    placeholderTextColor={theme.placeholder}
                    value={plugNotasCompanyForm.logradouro}
                    onChangeText={(t) => updatePlugNotasCompanyForm({ logradouro: t })}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Número {requiredMark}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Número"
                    placeholderTextColor={theme.placeholder}
                    value={plugNotasCompanyForm.numero}
                    onChangeText={(t) => updatePlugNotasCompanyForm({ numero: t })}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Bairro {requiredMark}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Bairro"
                    placeholderTextColor={theme.placeholder}
                    value={plugNotasCompanyForm.bairro}
                    onChangeText={(t) => updatePlugNotasCompanyForm({ bairro: t })}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Código IBGE cidade {requiredMark}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Código IBGE (7 dígitos)"
                    placeholderTextColor={theme.placeholder}
                    value={plugNotasCompanyForm.codigoCidade}
                    onChangeText={(t) => updatePlugNotasCompanyForm({ codigoCidade: t })}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Cidade {requiredMark}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Nome da cidade"
                    placeholderTextColor={theme.placeholder}
                    value={plugNotasCompanyForm.descricaoCidade}
                    onChangeText={(t) => updatePlugNotasCompanyForm({ descricaoCidade: t })}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>UF {requiredMark}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="PR"
                    placeholderTextColor={theme.placeholder}
                    value={plugNotasCompanyForm.estado}
                    onChangeText={(t) => updatePlugNotasCompanyForm({ estado: t.toUpperCase().slice(0, 2) })}
                    maxLength={2}
                    autoCapitalize="characters"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>E-mail {requiredMark}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="contato@empresa.com.br"
                    placeholderTextColor={theme.placeholder}
                    value={plugNotasCompanyForm.email}
                    onChangeText={(t) => updatePlugNotasCompanyForm({ email: t })}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                {documentosPermitidos.nfe ? (
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Inscrição estadual (IE)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Número da IE ou ISENTO"
                      placeholderTextColor={theme.placeholder}
                      value={plugNotasCompanyForm.inscricaoEstadual}
                      onChangeText={(t) => updatePlugNotasCompanyForm({ inscricaoEstadual: t })}
                      autoCapitalize="characters"
                    />
                    <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 4, lineHeight: 16 }}>
                      Obrigatória para NF-e de produtos. Use ISENTO se não tiver inscrição estadual.
                    </Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={[styles.downloadButton, !hasCertificate && { opacity: 0.5 }]}
                  onPress={handlePlugNotasEmpresaSubmit}
                  disabled={plugNotasEmpresaLoading || !hasCertificate}
                >
                  {plugNotasEmpresaLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.downloadButtonText}>
                      {!hasCertificate
                        ? 'Envie o certificado primeiro'
                        : isEditingEmpresa
                          ? 'Salvar alterações'
                          : 'Salvar'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
            </View>
          </View>
        )}
          </View>
        </View>
      </MfScrollView>

      {/* Modal: Certificado obrigatório */}
      <Modal
        visible={showCertRequiredModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCertRequiredModal(false)}
      >
        <View style={{
          flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center', alignItems: 'center', padding: 16,
        }}>
          <View style={{
            width: '100%', maxWidth: 460,
            backgroundColor: theme.surface, borderRadius: 16,
            borderWidth: 1, borderColor: theme.border, overflow: 'hidden',
          }}>
            {/* Header com ícone */}
            <View style={{
              padding: 24, alignItems: 'center',
              borderBottomWidth: 1, borderBottomColor: theme.border,
              backgroundColor: theme.primary + '0D',
            }}>
              <View style={{
                width: 56, height: 56, borderRadius: 28,
                backgroundColor: theme.primary + '22',
                alignItems: 'center', justifyContent: 'center',
                marginBottom: 12,
              }}>
                <CertificateIcon size={28} color={theme.primary} />
              </View>
              <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text, textAlign: 'center' }}>
                Certificado digital necessário
              </Text>
            </View>

            {/* Corpo */}
            <View style={{ padding: 20, gap: 12 }}>
              <Text style={{ fontSize: 14, color: theme.text, lineHeight: 22 }}>
                Pra usar essa parte do app você precisa enviar antes o{' '}
                <Text style={{ fontWeight: '700' }}>certificado digital A1</Text>
                {isFocoSimplesUi
                  ? ' (e-CNPJ da própria empresa, arquivo .pfx).'
                  : ' (o arquivo .pfx do seu MEI).'}
              </Text>
              <Text style={{ fontSize: 14, color: theme.text, lineHeight: 22 }}>
                É ele que autoriza o app a:
              </Text>
              <View style={{ gap: 8, paddingLeft: 4 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Ionicons name="checkmark-circle" size={18} color={theme.success} style={{ marginTop: 1 }} />
                  <Text style={{ flex: 1, fontSize: 13, color: theme.text, lineHeight: 20 }}>
                    Baixar as <Text style={{ fontWeight: '600' }}>guias DAS</Text> direto da Receita
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Ionicons name="checkmark-circle" size={18} color={theme.success} style={{ marginTop: 1 }} />
                  <Text style={{ flex: 1, fontSize: 13, color: theme.text, lineHeight: 20 }}>
                    Emitir <Text style={{ fontWeight: '600' }}>notas fiscais</Text> (NFS-e, NF-e, NFC-e) em seu nome
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Ionicons name="checkmark-circle" size={18} color={theme.success} style={{ marginTop: 1 }} />
                  <Text style={{ flex: 1, fontSize: 13, color: theme.text, lineHeight: 20 }}>
                    Consultar <Text style={{ fontWeight: '600' }}>parcelamentos</Text> de tributos
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 18, marginTop: 4 }}>
                ℹ️ Se você ainda não tem o certificado, ele pode ser comprado em qualquer autoridade certificadora
                (Serasa, Certisign, Soluti, AC Safeweb e outras) por cerca de R$ 150–250 e tem validade de 1 ano.
              </Text>
            </View>

            {/* Botões */}
            <View style={{
              flexDirection: 'row', gap: 12, padding: 20, paddingTop: 0,
            }}>
              <TouchableOpacity
                style={{
                  flex: 1, paddingVertical: 12, borderRadius: 8,
                  borderWidth: 1, borderColor: theme.border,
                  alignItems: 'center', backgroundColor: theme.background,
                }}
                onPress={() => setShowCertRequiredModal(false)}
              >
                <Text style={{ fontSize: 14, color: theme.text, fontWeight: '600' }}>Agora não</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1.4, paddingVertical: 12, borderRadius: 8,
                  alignItems: 'center', backgroundColor: theme.primary,
                  flexDirection: 'row', justifyContent: 'center', gap: 6,
                }}
                onPress={() => {
                  setShowCertRequiredModal(false);
                  setActiveTab('certificado');
                }}
              >
                <Ionicons name="key-outline" size={16} color="#FFFFFF" />
                <Text style={{ fontSize: 14, color: '#FFFFFF', fontWeight: '700' }}>
                  Cadastrar certificado
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <MeiFlowModalShell
        visible={editNotaVisible}
        onClose={() => setEditNotaVisible(false)}
        title="Editar nota"
        eyebrow="Nota fiscal"
        footer={
          <MeiPrimaryButton
            label="Salvar"
            onPress={handleSaveEditNota}
            loading={editNotaLoading}
          />
        }
      >
        <MeiFormField
          label="Descrição interna"
          placeholder="Opcional"
          value={editNotaDescricao}
          onChangeText={setEditNotaDescricao}
          multiline
          style={{ minHeight: 80, textAlignVertical: 'top' }}
        />
      </MeiFlowModalShell>

      <MeiFlowModalShell
        visible={emitirNotaVisible}
        onClose={() => {
          setEmitirNotaVisible(false);
          setEmitirNotaError(null);
        }}
        title="Emitir nota"
        eyebrow="Nota fiscal"
        tabs={{
          value: emitirNotaType as MeiDocType,
          onChange: (t) => {
            setEmitirNotaType(t);
            setEmitirNotaError(null);
          },
          allowedTypes: emitDocTypesAllowed,
        }}
        footer={
          <MeiPrimaryButton
            label={
              emitirNotaLoading && emitirNotaType === 'NFSE'
                ? 'Aguardando prefeitura…'
                : emitirNotaLoading
                  ? 'Enviando…'
                  : 'Emitir'
            }
            onPress={handleEmitirNotaSubmit}
            loading={emitirNotaLoading}
          />
        }
      >
              {emitirNotaError ? (
                <MeiFormBanner>{emitirNotaError}</MeiFormBanner>
              ) : null}
              {emitirNotaType === 'NFSE' && (
                <>
                  {nfsePrestadorPrefillLoading ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <ActivityIndicator size="small" color={theme.primary} />
                      <Text style={{ color: theme.placeholder, fontSize: 13 }}>A carregar dados do cadastro…</Text>
                    </View>
                  ) : null}
                  {nfsePrestadorPrefillBanner ? (
                    <MeiFormBanner>{nfsePrestadorPrefillBanner}</MeiFormBanner>
                  ) : null}
                  <MeiFormField
                    label="CNPJ prestador"
                    required
                    placeholder="00.000.000/0000-00"
                    value={nfseForm.prestadorCpfCnpj}
                    onChangeText={(t) => {
                      touchNfsePrestadorFields();
                      setNfseForm((f) => ({ ...f, prestadorCpfCnpj: formatDocument(t) }));
                    }}
                    keyboardType="numeric"
                    maxLength={18}
                  />
                  <MeiFormField
                    label="Razão social prestador"
                    placeholder="Opcional — enviada à API se preenchida"
                    value={nfseForm.prestadorRazaoSocial ?? ''}
                    onChangeText={(t) => {
                      touchNfsePrestadorFields();
                      setNfseForm((f) => ({ ...f, prestadorRazaoSocial: t }));
                    }}
                  />
                  <MeiFormField
                    label="E-mail prestador"
                    placeholder="Opcional"
                    value={nfseForm.prestadorEmail ?? ''}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    onChangeText={(t) => {
                      touchNfsePrestadorFields();
                      setNfseForm((f) => ({ ...f, prestadorEmail: t }));
                    }}
                  />
                  <MeiFormField
                    label="Logradouro prestador"
                    required
                    placeholder="Rua, número"
                    value={nfseForm.prestadorEndereco?.logradouro ?? ''}
                    onChangeText={(t) => {
                      touchNfsePrestadorFields();
                      setNfseForm((f) => ({ ...f, prestadorEndereco: { ...f.prestadorEndereco, logradouro: t } }));
                    }}
                  />
                  <MeiFormField
                    label="Número"
                    required
                    placeholder="Número"
                    value={nfseForm.prestadorEndereco?.numero ?? ''}
                    onChangeText={(t) => {
                      touchNfsePrestadorFields();
                      setNfseForm((f) => ({ ...f, prestadorEndereco: { ...f.prestadorEndereco, numero: t } }));
                    }}
                  />
                  <MeiFormField
                    label="CEP prestador"
                    required
                    placeholder="00000000"
                    value={nfseForm.prestadorEndereco?.cep ?? ''}
                    onChangeText={(t) => {
                      touchNfsePrestadorFields();
                      setNfseForm((f) => ({
                        ...f,
                        prestadorEndereco: { ...f.prestadorEndereco, cep: t.replace(/\D/g, '').slice(0, 8) },
                      }));
                    }}
                    keyboardType="numeric"
                    maxLength={8}
                  />
                  <MeiFormField
                    label="Bairro"
                    required
                    placeholder="Bairro"
                    value={nfseForm.prestadorEndereco?.bairro ?? ''}
                    onChangeText={(t) => {
                      touchNfsePrestadorFields();
                      setNfseForm((f) => ({ ...f, prestadorEndereco: { ...f.prestadorEndereco, bairro: t } }));
                    }}
                  />
                  <MeiFormField
                    label="Código IBGE cidade"
                    required
                    placeholder="Código IBGE"
                    value={nfseForm.prestadorEndereco?.codigoCidade ?? ''}
                    onChangeText={(t) => {
                      touchNfsePrestadorFields();
                      setNfseForm((f) => ({ ...f, prestadorEndereco: { ...f.prestadorEndereco, codigoCidade: t } }));
                    }}
                  />
                  <MeiFormField
                    label="Cidade"
                    required
                    placeholder="Cidade"
                    value={nfseForm.prestadorEndereco?.descricaoCidade ?? ''}
                    onChangeText={(t) => {
                      touchNfsePrestadorFields();
                      setNfseForm((f) => ({ ...f, prestadorEndereco: { ...f.prestadorEndereco, descricaoCidade: t } }));
                    }}
                  />
                  <MeiFormField
                    label="UF"
                    required
                    placeholder="PR"
                    value={nfseForm.prestadorEndereco?.estado ?? ''}
                    onChangeText={(t) => {
                      touchNfsePrestadorFields();
                      setNfseForm((f) => ({
                        ...f,
                        prestadorEndereco: { ...f.prestadorEndereco, estado: t.toUpperCase().slice(0, 2) },
                      }));
                    }}
                    maxLength={2}
                  />
                  <MeiLinkButton
                    label="Selecionar tomador do catálogo"
                    onPress={() => {
                      setCatalogClienteVisible(true);
                      if (catalogClientes.length === 0) loadCatalogClientes();
                    }}
                  />
                  <MeiFormField
                    label="CPF/CNPJ tomador"
                    required
                    placeholder="CPF ou CNPJ"
                    value={nfseForm.tomadorCpfCnpj ?? ''}
                    onChangeText={(t) => {
                      const masked = formatDocument(t);
                      const digits = normalizeDoc(masked);
                      setNfseForm((f) => ({ ...f, tomadorCpfCnpj: masked }));
                      if (digits.length !== 14) {
                        lastTomadorLookupDocRef.current = '';
                      } else {
                        void lookupTomadorByCnpj(masked);
                      }
                    }}
                    onBlur={() => void lookupTomadorByCnpj(nfseForm.tomadorCpfCnpj ?? '')}
                    keyboardType="numeric"
                    maxLength={18}
                  />
                  {tomadorCnpjLookupLoading ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <ActivityIndicator size="small" color={theme.primary} />
                      <Text style={{ color: theme.placeholder, fontSize: 13 }}>
                        Buscando dados do tomador…
                      </Text>
                    </View>
                  ) : null}
                  <MeiFormField
                    label="Razão social tomador"
                    required
                    placeholder="Nome do tomador"
                    value={nfseForm.tomadorRazaoSocial ?? ''}
                    onChangeText={(t) => setNfseForm((f) => ({ ...f, tomadorRazaoSocial: t }))}
                  />
                  <MeiFormField
                    label="E-mail tomador (opcional)"
                    placeholder="E-mail do cliente"
                    value={nfseForm.tomadorEmail ?? ''}
                    onChangeText={(t) => setNfseForm((f) => ({ ...f, tomadorEmail: t }))}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  {normalizeDoc(nfseForm.tomadorCpfCnpj ?? '').length === 14
                  && nfseForm.tomadorEndereco?.logradouro?.trim()
                  && nfseForm.tomadorEndereco?.descricaoCidade?.trim() ? (
                    <MeiFormBanner>
                      Endereço do tomador: {nfseForm.tomadorEndereco.logradouro},{' '}
                      {nfseForm.tomadorEndereco.numero || 'S/N'} —{' '}
                      {nfseForm.tomadorEndereco.descricaoCidade}/{nfseForm.tomadorEndereco.estado}
                    </MeiFormBanner>
                  ) : null}
                  {normalizeDoc(nfseForm.tomadorCpfCnpj ?? '').length === 14
                  && !isTomadorEnderecoComplete(nfseForm.tomadorEndereco) ? (
                    <>
                      {!nfseForm.tomadorEndereco?.bairro?.trim() ? (
                        <MeiFormField
                          label="Bairro do tomador"
                          required
                          placeholder="Bairro"
                          value={nfseForm.tomadorEndereco?.bairro ?? ''}
                          onChangeText={(t) =>
                            setNfseForm((f) => ({
                              ...f,
                              tomadorEndereco: { ...getDefaultNfeDestinatarioEndereco(), ...f.tomadorEndereco, bairro: t },
                            }))
                          }
                        />
                      ) : null}
                      {normalizeDoc(nfseForm.tomadorEndereco?.codigoCidade ?? '').length !== 7 ? (
                        <MeiFormField
                          label="Código IBGE da cidade do tomador"
                          required
                          placeholder="3304557"
                          hint="7 dígitos — preenchido automaticamente na consulta do CNPJ quando possível."
                          value={nfseForm.tomadorEndereco?.codigoCidade ?? ''}
                          onChangeText={(t) =>
                            setNfseForm((f) => ({
                              ...f,
                              tomadorEndereco: {
                                ...getDefaultNfeDestinatarioEndereco(),
                                ...f.tomadorEndereco,
                                codigoCidade: t.replace(/\D/g, '').slice(0, 7),
                              },
                            }))
                          }
                          keyboardType="numeric"
                          maxLength={7}
                        />
                      ) : null}
                    </>
                  ) : null}
                  <MeiLinkButton
                    label="Selecionar serviço do catálogo"
                    onPress={() => {
                      setCatalogProdutoVisible(true);
                      void loadCatalogProdutos();
                    }}
                  />
                  <MeiFormField
                    label="Código serviço (LC 116)"
                    required
                    placeholder="Ex.: 17.19.01"
                    hint="Item da lista municipal — mínimo 6 caracteres sem pontos (17.19 não basta; use 17.19.01)."
                    value={nfseForm.servico?.codigo ?? ''}
                    onChangeText={(t) => setNfseForm((f) => ({ ...f, servico: { ...f.servico, codigo: t } }))}
                  />
                  <MeiFormField
                    label="CNAE"
                    required
                    placeholder="CNAE"
                    value={nfseForm.servico?.cnae ?? ''}
                    onChangeText={(t) => setNfseForm((f) => ({ ...f, servico: { ...f.servico, cnae: t } }))}
                  />
                  <MeiFormField
                    label="Discriminação"
                    required
                    placeholder="Descrição do serviço"
                    value={nfseForm.servico?.discriminacao ?? ''}
                    onChangeText={(t) => setNfseForm((f) => ({ ...f, servico: { ...f.servico, discriminacao: t } }))}
                  />
                  <MeiFormField
                    label="Alíquota ISS (opcional)"
                    placeholder="MEI/Simples: deixe em branco"
                    value={String(nfseForm.servico?.aliquota ?? '')}
                    onChangeText={(t) => setNfseForm((f) => ({ ...f, servico: { ...f.servico, aliquota: t } }))}
                    keyboardType="decimal-pad"
                  />
                  <MeiFormField
                    label="Valor do serviço"
                    required
                    placeholder="0,00"
                    value={String(nfseForm.servico?.valorServico ?? '')}
                    onChangeText={(t) => setNfseForm((f) => ({ ...f, servico: { ...f.servico, valorServico: t } }))}
                    keyboardType="decimal-pad"
                  />
                </>
              )}
              {(emitirNotaType === 'NFE' || emitirNotaType === 'NFCE') && (
                <>
                  {nfeEmitentePrefillLoading ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <ActivityIndicator size="small" color={theme.primary} />
                      <Text style={{ color: theme.placeholder, fontSize: 13 }}>A carregar dados do emitente…</Text>
                    </View>
                  ) : null}
                  {nfeEmitentePrefillBanner ? (
                    <MeiFormBanner>{nfeEmitentePrefillBanner}</MeiFormBanner>
                  ) : null}
                  <MeiFormField
                    label="CNPJ emitente"
                    required
                    placeholder="00.000.000/0000-00"
                    value={nfeLikeForm.emitenteCpfCnpj}
                    onChangeText={(t) => {
                      touchNfeEmitenteFields();
                      setNfeLikeForm((f) => ({ ...f, emitenteCpfCnpj: formatDocument(t) }));
                    }}
                    keyboardType="numeric"
                    maxLength={18}
                  />
                  <MeiFormField
                    label="Razão social emitente"
                    required
                    placeholder="Razão social"
                    value={nfeLikeForm.emitenteRazaoSocial}
                    onChangeText={(t) => {
                      touchNfeEmitenteFields();
                      setNfeLikeForm((f) => ({ ...f, emitenteRazaoSocial: t }));
                    }}
                  />
                  <MeiFormField
                    label="Inscrição Estadual do emitente (opcional)"
                    placeholder="Somente números ou ISENTO"
                    value={nfeLikeForm.emitenteInscricaoEstadual}
                    onChangeText={(t) => {
                      touchNfeEmitenteFields();
                      setNfeLikeForm((f) => ({ ...f, emitenteInscricaoEstadual: t }));
                    }}
                    keyboardType="default"
                  />
                  <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: mfSpacing.sm, lineHeight: 16 }}>
                    IE da sua empresa MEI no XML do emitente. Não confunda com a IE do cliente (destinatário).
                  </Text>
                  <MeiLinkButton
                    label="Alterar no cadastro da empresa"
                    onPress={() => {
                      setEmitirNotaVisible(false);
                      setActiveTab('certificado');
                      if (empresaFiscal) handleStartEditEmpresa();
                    }}
                  />
                  <MeiLinkButton
                    label="Selecionar destinatário do catálogo"
                    onPress={() => {
                      setCatalogClienteVisible(true);
                      if (catalogClientes.length === 0) loadCatalogClientes();
                    }}
                  />
                  <MeiFormField
                    label="CPF/CNPJ destinatário"
                    required
                    placeholder="CPF ou CNPJ"
                    value={nfeLikeForm.destinatarioCpfCnpj}
                    onChangeText={(t) => setNfeLikeForm((f) => ({ ...f, destinatarioCpfCnpj: formatDocument(t) }))}
                    keyboardType="numeric"
                    maxLength={18}
                  />
                  <MeiFormField
                    label="Razão social destinatário"
                    required
                    placeholder="Razão social"
                    value={nfeLikeForm.destinatarioRazaoSocial}
                    onChangeText={(t) => setNfeLikeForm((f) => ({ ...f, destinatarioRazaoSocial: t }))}
                  />
                  <View style={{ marginBottom: mfSpacing.sm, gap: 8 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text }}>
                      Situação de IE do destinatário
                      <Text style={{ color: theme.error }}> *</Text>
                    </Text>
                    <Text style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 16 }}>
                      {DESTINATARIO_IE_SECTION_HINT}
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {DESTINATARIO_IE_OPTIONS.map((opt) => {
                        const selected = nfeLikeForm.destinatarioIndIEDest === opt.value;
                        return (
                          <Pressable
                            key={opt.value}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            accessibilityLabel={opt.label}
                            onPress={() =>
                              setNfeLikeForm((f) => ({
                                ...f,
                                destinatarioIndIEDest: opt.value as DestinatarioIndIeDest,
                                ...(opt.value !== '1' ? { destinatarioInscricaoEstadual: '' } : {}),
                              }))
                            }
                            style={{
                              paddingHorizontal: 12,
                              paddingVertical: 8,
                              borderRadius: 8,
                              borderWidth: 1,
                              borderColor: selected ? theme.primary : theme.border,
                              backgroundColor: selected ? `${theme.primary}18` : theme.surface,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: selected ? '700' : '500',
                                color: selected ? theme.primary : theme.text,
                              }}
                            >
                              {opt.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <Text style={{ fontSize: 11, color: theme.textSecondary, lineHeight: 15 }}>
                      {
                        DESTINATARIO_IE_OPTIONS.find((o) => o.value === nfeLikeForm.destinatarioIndIEDest)
                          ?.hint
                      }
                    </Text>
                  </View>
                  {nfeLikeForm.destinatarioIndIEDest === '1' ? (
                    <MeiFormField
                      label="Inscrição Estadual do destinatário (cliente)"
                      required
                      placeholder="Somente números — não use a IE do seu MEI"
                      value={nfeLikeForm.destinatarioInscricaoEstadual}
                      onChangeText={(t) =>
                        setNfeLikeForm((f) => ({
                          ...f,
                          destinatarioInscricaoEstadual: t.replace(/\D/g, ''),
                        }))
                      }
                      keyboardType="numeric"
                    />
                  ) : null}
                  {emitirNotaType === 'NFE' ? (
                    <>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text, marginBottom: 4 }}>
                        Endereço do destinatário
                        <Text style={{ color: theme.error }}> *</Text>
                      </Text>
                      <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 8, lineHeight: 16 }}>
                        Obrigatório na NF-e. Use o endereço de entrega ou sede do condomínio/cliente.
                      </Text>
                      <MeiFormField
                        label="CEP"
                        required
                        placeholder="00000000"
                        value={nfeLikeForm.destinatarioEndereco.cep}
                        onChangeText={(t) =>
                          setNfeLikeForm((f) => ({
                            ...f,
                            destinatarioEndereco: {
                              ...f.destinatarioEndereco,
                              cep: t.replace(/\D/g, '').slice(0, 8),
                            },
                          }))
                        }
                        keyboardType="numeric"
                        maxLength={8}
                      />
                      <MeiFormField
                        label="Logradouro"
                        required
                        placeholder="Rua, avenida…"
                        value={nfeLikeForm.destinatarioEndereco.logradouro}
                        onChangeText={(t) =>
                          setNfeLikeForm((f) => ({
                            ...f,
                            destinatarioEndereco: { ...f.destinatarioEndereco, logradouro: t },
                          }))
                        }
                      />
                      <MeiFormField
                        label="Número"
                        required
                        placeholder="123"
                        value={nfeLikeForm.destinatarioEndereco.numero}
                        onChangeText={(t) =>
                          setNfeLikeForm((f) => ({
                            ...f,
                            destinatarioEndereco: { ...f.destinatarioEndereco, numero: t },
                          }))
                        }
                      />
                      <MeiFormField
                        label="Complemento"
                        placeholder="Opcional"
                        value={nfeLikeForm.destinatarioEndereco.complemento}
                        onChangeText={(t) =>
                          setNfeLikeForm((f) => ({
                            ...f,
                            destinatarioEndereco: { ...f.destinatarioEndereco, complemento: t },
                          }))
                        }
                      />
                      <MeiFormField
                        label="Bairro"
                        required
                        placeholder="Bairro"
                        value={nfeLikeForm.destinatarioEndereco.bairro}
                        onChangeText={(t) =>
                          setNfeLikeForm((f) => ({
                            ...f,
                            destinatarioEndereco: { ...f.destinatarioEndereco, bairro: t },
                          }))
                        }
                      />
                      <MeiFormField
                        label="Código IBGE (7 dígitos)"
                        required
                        placeholder="3550308"
                        hint="Código da cidade na Receita — consulte em ibge.gov.br se necessário."
                        value={nfeLikeForm.destinatarioEndereco.codigoCidade}
                        onChangeText={(t) =>
                          setNfeLikeForm((f) => ({
                            ...f,
                            destinatarioEndereco: {
                              ...f.destinatarioEndereco,
                              codigoCidade: t.replace(/\D/g, '').slice(0, 7),
                            },
                          }))
                        }
                        keyboardType="numeric"
                        maxLength={7}
                      />
                      <MeiFormField
                        label="Cidade"
                        required
                        placeholder="São Paulo"
                        value={nfeLikeForm.destinatarioEndereco.descricaoCidade}
                        onChangeText={(t) =>
                          setNfeLikeForm((f) => ({
                            ...f,
                            destinatarioEndereco: { ...f.destinatarioEndereco, descricaoCidade: t },
                          }))
                        }
                      />
                      <MeiFormField
                        label="UF"
                        required
                        placeholder="SP"
                        value={nfeLikeForm.destinatarioEndereco.estado}
                        onChangeText={(t) =>
                          setNfeLikeForm((f) => ({
                            ...f,
                            destinatarioEndereco: {
                              ...f.destinatarioEndereco,
                              estado: t.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 2),
                            },
                          }))
                        }
                        maxLength={2}
                        autoCapitalize="characters"
                      />
                    </>
                  ) : null}
                  <MeiLinkButton
                    label="Selecionar produto do catálogo"
                    onPress={() => {
                      setCatalogProdutoVisible(true);
                      void loadCatalogProdutos();
                    }}
                  />
                  {nfeLikeForm.itens.length > 0 && (() => {
                    const item = nfeLikeForm.itens[0];
                    const setItem = (up: Partial<NfeItemForm>) =>
                      setNfeLikeForm((f) => ({ ...f, itens: f.itens.map((it, i) => (i === 0 ? { ...it, ...up } : it)) }));
                    return (
                      <>
                        <MeiFormField label="Código item" required placeholder="Código" value={item.codigo} onChangeText={(t) => setItem({ codigo: t })} />
                        <MeiFormField label="Descrição" required placeholder="Descrição" value={item.descricao} onChangeText={(t) => setItem({ descricao: t })} />
                        <MeiFormField
                          label="NCM (8 dígitos)"
                          required
                          placeholder="00000000"
                          value={item.ncm}
                          onChangeText={(t) => setItem({ ncm: t.replace(/\D/g, '').slice(0, 8) })}
                          keyboardType="numeric"
                          maxLength={8}
                        />
                        <MeiFormField label="CFOP" required placeholder="5102" value={item.cfop} onChangeText={(t) => setItem({ cfop: t.replace(/\D/g, '').slice(0, 4) })} keyboardType="numeric" maxLength={4} />
                        <MeiFormField label="Unidade" required placeholder="UN" value={item.unidade} onChangeText={(t) => setItem({ unidade: t })} />
                        <MeiFormField label="Quantidade" required placeholder="1" value={item.quantidade} onChangeText={(t) => setItem({ quantidade: t })} keyboardType="decimal-pad" />
                        <MeiFormField label="Valor unitário" required placeholder="0,00" value={item.valorUnitario} onChangeText={(t) => setItem({ valorUnitario: t })} keyboardType="decimal-pad" />
                        {(() => {
                          const lineTotal = getNfeItemLineTotal(item);
                          return (
                            <View style={{ marginBottom: mfSpacing.sm, gap: 2 }}>
                              <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text }}>
                                Valor total do item:{' '}
                                {lineTotal !== null ? formatCurrencyBR(lineTotal) : '—'}
                              </Text>
                              <Text style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 16 }}>
                                Calculado automaticamente (quantidade × unitário). Não precisa informar o total à parte.
                              </Text>
                            </View>
                          );
                        })()}
                        <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: mfSpacing.sm, lineHeight: 16 }}>
                          Tributos vêm do cadastro do produto (catálogo). Use &quot;Selecionar produto&quot; ou edite aqui se necessário.
                        </Text>
                        <MeiFormField
                          label="CSOSN ICMS (MEI)"
                          required
                          placeholder="102"
                          value={item.tributos.icms.csosn}
                          onChangeText={(t) => {
                            const csosn = t.replace(/\D/g, '').slice(0, 3);
                            setItem({
                              tributos: {
                                ...item.tributos,
                                icms: { ...item.tributos.icms, csosn, cst: '' },
                              },
                            });
                          }}
                          keyboardType="numeric"
                          maxLength={3}
                        />
                        <MeiFormField
                          label="CST PIS"
                          required
                          placeholder="49"
                          value={item.tributos.pis.cst}
                          onChangeText={(t) =>
                            setItem({
                              tributos: {
                                ...item.tributos,
                                pis: { ...item.tributos.pis, cst: t.replace(/\D/g, '').slice(0, 2) },
                              },
                            })
                          }
                          keyboardType="numeric"
                          maxLength={2}
                        />
                        <MeiFormField
                          label="CST COFINS"
                          required
                          placeholder="49"
                          value={item.tributos.cofins.cst}
                          onChangeText={(t) =>
                            setItem({
                              tributos: {
                                ...item.tributos,
                                cofins: { ...item.tributos.cofins, cst: t.replace(/\D/g, '').slice(0, 2) },
                              },
                            })
                          }
                          keyboardType="numeric"
                          maxLength={2}
                        />
                      </>
                    );
                  })()}
                </>
              )}
      </MeiFlowModalShell>

      <MeiFlowModalShell
        visible={catalogClienteVisible}
        onClose={() => setCatalogClienteVisible(false)}
        title="Selecionar cliente"
        closeIcon="close"
        flatListBody
      >
        {catalogLoading && catalogClientes.length === 0 ? (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={theme.primary} />
          </View>
        ) : (
          <FlatList
            data={catalogClientes}
            keyExtractor={(item) => item.id}
            style={meiFlow.listPad}
            ListEmptyComponent={
              <Text style={meiFlow.empty}>Nenhum cliente no catálogo.</Text>
            }
            renderItem={({ item }) => (
              <MeiCatalogListCard
                title={buildClienteCatalogLabel(item)}
                meta={item.document_type ?? undefined}
                onPress={() => handleSelectCatalogCliente(item)}
              />
            )}
          />
        )}
      </MeiFlowModalShell>

      <MeiCatalogoClientesModal
        visible={catalogClientesManageVisible}
        onClose={() => setCatalogClientesManageVisible(false)}
        onCatalogChanged={loadCatalogClientes}
      />

      <MeiCatalogoProdutosModal
        visible={catalogProdutosManageVisible}
        onClose={() => setCatalogProdutosManageVisible(false)}
        onCatalogChanged={loadCatalogProdutos}
        allowedDocumentTypes={emitDocTypesAllowed}
      />

      <MeiImportCnaesModal
        visible={importCnaesVisible}
        cnaes={pendingImportCnaes}
        onClose={() => {
          setImportCnaesVisible(false);
          setPendingImportCnaes([]);
        }}
        onImported={() => {
          void loadCatalogProdutos();
        }}
      />

      <MeiFlowModalShell
        visible={catalogProdutoVisible}
        onClose={() => setCatalogProdutoVisible(false)}
        title={emitirNotaType === 'NFSE' ? 'Selecionar serviço' : 'Selecionar produto'}
        closeIcon="close"
        flatListBody
      >
        {catalogLoading && catalogProdutos.length === 0 ? (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={theme.primary} />
          </View>
        ) : (
          <FlatList
            data={
              emitirNotaType === 'NFSE'
                ? catalogProdutos
                : catalogProdutos.filter((p) => isCatalogProdutoUsableForNfeLike(p, emitirNotaType))
            }
            keyExtractor={(item) => item.id}
            style={meiFlow.listPad}
            ListEmptyComponent={
              <Text style={meiFlow.empty}>
                {emitirNotaType === 'NFSE'
                  ? 'Nenhum serviço no catálogo.'
                  : 'Nenhum produto NF-e no catálogo. Cadastre em Catálogo → Produtos (tipo NFE).'}
              </Text>
            }
            renderItem={({ item }) => {
              const needsCodigo = !String(item.codigo || '').trim()
                || String(item.codigo || '').replace(/[^0-9A-Za-z]/g, '').length < 6
              return (
                <MeiCatalogListCard
                  title={buildProdutoCatalogLabel(item)}
                  meta={[
                    item.document_type,
                    item.cnae ? `CNAE ${item.cnae}` : null,
                    needsCodigo ? 'Completar código LC 116' : null,
                  ].filter(Boolean).join(' · ') || undefined}
                  onPress={() => handleSelectCatalogProduto(item)}
                />
              )
            }}
          />
        )}
      </MeiFlowModalShell>
    </SafeAreaView>
  );
}

/** Gate leve: sem permissão não monta o ecrã pesado (evita efeitos/rede — feedback QA M1). */
export default function MeiScreen() {
  const { role, mei, user } = useAuthStore();
  const { isDarkMode } = useThemeStore();
  const theme = useMemo(() => getTheme(isDarkMode), [isDarkMode]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const canAccessMei = useMemo(() => canAccessMeiArea(role, mei), [role, mei]);
  const router = useRouter();
  const sessionEmail = user?.email?.trim() || '';

  if (!canAccessMei) {
    const needsPlan = role === 'admin' && mei !== true;
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.accessDeniedWrap}>
          <Ionicons name="lock-closed-outline" size={48} color={theme.tabInactive} />
          <Text style={styles.accessDeniedTitle}>
            {needsPlan ? 'Escolha um plano MEI' : 'Área indisponível'}
          </Text>
          <Text style={styles.accessDeniedText}>
            {needsPlan
              ? NOTAS_PAYWALL
              : NOTAS_ACCESS_DENIED}
          </Text>
          {sessionEmail ? (
            <Text style={[styles.accessDeniedText, { marginTop: 8 }]}>
              Conta logada: {sessionEmail}
            </Text>
          ) : null}
          {needsPlan ? (
            <TouchableOpacity
              style={[styles.downloadButton, { marginTop: 20, alignSelf: 'center' }]}
              onPress={() => router.replace('/(app)/planos' as never)}
              accessibilityRole="button"
              accessibilityLabel="Ir para tabela de preços"
            >
              <Text style={styles.downloadButtonText}>Ver planos e pagar</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  return <MeiScreenContent />;
}

const MEI_DESKTOP_MAX_WIDTH = 1280;
const MEI_DESKTOP_PADDING_H = 24;

const createStyles = (
  theme: ReturnType<typeof getTheme>,
  isDesktop: boolean = false,
  isDarkMode: boolean = false
) => {
  const tokens = getTechTokens(isDarkMode);
  const warningSoftBg = isDarkMode ? 'rgba(245, 158, 11, 0.16)' : '#FEF3C7';
  const warningSoftBorder = isDarkMode ? 'rgba(245, 158, 11, 0.42)' : 'rgba(245, 158, 11, 0.38)';
  const warningSoftText = isDarkMode ? '#FCD34D' : '#B45309';

  const glassWeb =
    Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        } as object)
      : {};
  const glassCardWeb =
    Platform.OS === 'web'
      ? ({
          boxShadow: isDarkMode
            ? '0 10px 40px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.07)'
            : '0 8px 32px rgba(15, 23, 42, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.95)',
        } as object)
      : {
          elevation: 0,
          shadowOpacity: 0,
        };
  const glassBtnActiveWeb =
    Platform.OS === 'web' && isDarkMode
      ? ({ boxShadow: '0 0 18px rgba(96, 165, 250, 0.22)' } as object)
      : null;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      ...(Platform.OS === 'web' ? { minHeight: 0 } : {}),
    },
    // Topbar (igual ao Dashboard quando desktop)
    header: isDesktop
      ? {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 12,
          paddingHorizontal: MEI_DESKTOP_PADDING_H,
          backgroundColor: theme.primary,
          gap: 12,
        }
      : {
          flexDirection: 'row',
          justifyContent: 'flex-start',
          alignItems: 'center',
          padding: 20,
          backgroundColor: theme.surface,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
        },
    headerBrand: isDesktop
      ? { flex: 1 }
      : { flex: 1 },
    headerTitleDesktop: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
    headerSubtitleDesktop: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.text,
    },
    subtitle: {
      marginTop: 6,
      fontSize: 12,
      color: theme.textSecondary,
    },
    // Sub-header MEI (chips de contexto)
    meiSubHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 16,
      marginBottom: 20,
      marginTop: 4,
      flexWrap: 'wrap',
    },
    meiSubHeaderLeft: { flex: 1, minWidth: 280 },
    meiSubHeaderTitle: { fontSize: 22, fontWeight: '800', color: theme.text, letterSpacing: -0.3 },
    meiSubHeaderDesc: { fontSize: 13, color: theme.textSecondary, marginTop: 4 },
    meiSubHeaderRight: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
    contextChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 999,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 2,
      elevation: 1,
    },
    contextChipLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.textTertiary,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    contextChipValue: { fontSize: 13, fontWeight: '600', color: theme.text },
    contextChipValueSuccess: { fontSize: 13, fontWeight: '600', color: theme.success },
    contextChipValueError: { fontSize: 13, fontWeight: '600', color: theme.error },
    contextChipDot: { width: 8, height: 8, borderRadius: 4 },
    // Container central (scroll content)
    scrollContent: isDesktop
      ? {
          maxWidth: MEI_DESKTOP_MAX_WIDTH,
          width: '100%',
          alignSelf: 'center',
          paddingHorizontal: MEI_DESKTOP_PADDING_H,
          paddingBottom: 32,
          paddingTop: 24,
        }
      : { paddingTop: 16, paddingBottom: 24 },
    scrollContentMobile: {
      paddingBottom: mfSpacing.xl,
      gap: mfSpacing.sm,
    },
    // Layout 2-col (sidebar + content)
    meiLayout: isDesktop
      ? { flexDirection: 'row', gap: 20, alignItems: 'flex-start' }
      : {},
    meiSidebar: isDesktop
      ? {
          width: 220,
          backgroundColor: theme.card,
          borderRadius: 16,
          padding: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 6,
          elevation: 2,
        }
      : {},
    sidebarItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      marginVertical: 2,
    },
    sidebarItemActive: {
      backgroundColor: theme.primaryLight,
    },
    sidebarItemLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.textSecondary,
      flex: 1,
    },
    sidebarItemLabelActive: { color: theme.primary, fontWeight: '600' },
    sidebarBadge: {
      backgroundColor: theme.error,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 999,
      minWidth: 22,
      alignItems: 'center',
    },
    sidebarBadgeActive: { backgroundColor: theme.primary },
    sidebarBadgeText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
    meiContent: isDesktop
      ? {
          flex: 1,
          backgroundColor: theme.card,
          borderRadius: 16,
          padding: 24,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 6,
          elevation: 2,
        }
      : {},
    meiContentDas: {
      paddingTop: mfSpacing.lg,
    },
    meiContentHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 0,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    meiContentTitle: { fontSize: 18, fontWeight: '700', color: theme.text },
    meiContentDesc: { fontSize: 13, color: theme.textSecondary, marginTop: 4 },
    meiDasPageHeader: {
      marginBottom: mfSpacing.lg,
      gap: 4,
    },
    meiDasPageTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.text,
      letterSpacing: -0.3,
    },
    meiDasPageDesc: {
      fontSize: 14,
      color: theme.textSecondary,
      lineHeight: 20,
    },
    // Overview grid 2x2
    overviewSection: {
      width: '100%',
      ...(isDesktop ? {} : { paddingHorizontal: mfSpacing.md }),
    },
    overviewGrid: isDesktop
      ? { flexDirection: 'row', flexWrap: 'wrap', gap: 16 }
      : {},
    overviewCard: isDesktop
      ? {
          width: '48.5%',
          backgroundColor: theme.card,
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: 12,
          padding: 20,
          overflow: 'hidden',
          position: 'relative',
        }
      : {
          backgroundColor: theme.card,
          marginHorizontal: 0,
          marginBottom: 12,
          padding: 16,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: theme.border,
          overflow: 'hidden',
          position: 'relative',
        },
    overviewLoadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 12,
      zIndex: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    overviewLoadingBlur: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      borderRadius: 12,
      overflow: 'hidden',
    },
    overviewLoadingVeil: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      borderRadius: 12,
      backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.72)' : 'rgba(255, 255, 255, 0.78)',
    },
    overviewIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: theme.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    overviewIconWrapSuccess: { backgroundColor: theme.successLight },
    overviewIconWrapWarn: { backgroundColor: '#FEF3C7' },
    overviewIconWrapError: { backgroundColor: theme.errorLight },
    overviewTitle: { fontSize: 16, fontWeight: '700', color: theme.text, marginBottom: 4 },
    overviewDesc: { fontSize: 13, color: theme.textSecondary, marginBottom: 14, lineHeight: 18 },
    overviewMetric: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.borderLight,
    },
    overviewMetricLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    overviewMetricValue: { fontSize: 20, fontWeight: '800', color: theme.text },
    overviewMetricValueSuccess: { color: theme.success },
    overviewMetricValueWarn: { color: theme.warning },
    overviewMetricValueError: { color: theme.error },
    overviewCta: {
      marginTop: 10,
      fontSize: 12,
      color: theme.primary,
      fontWeight: '600',
    },
    // Sections (mobile) — preservar
    sectionDesktop: isDesktop
      ? {
          marginHorizontal: 0,
          marginBottom: 16,
          backgroundColor: 'transparent',
          borderWidth: 0,
          padding: 0,
        }
      : {},

    // Certificado — grid 2-col desktop
    configGrid: isDesktop
      ? { flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }
      : {},
    configCard: isDesktop
      ? {
          width: '48.5%',
          backgroundColor: theme.background,
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: 12,
          padding: 20,
        }
      : {},
    configCardFull: isDesktop
      ? { width: '100%' }
      : {},
    configCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingBottom: 12,
      marginBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    configCardTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.text,
      flex: 1,
    },
    configCardSubtitle: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    configCertActive: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.successLight,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: theme.success + '40',
    },
    configCertActiveLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    configCertActiveText: { fontSize: 14, fontWeight: '600', color: theme.success },
    configFormRow: isDesktop
      ? { flexDirection: 'row', gap: 12 }
      : {},
    configFormHalf: isDesktop
      ? { flex: 1 }
      : {},
    configSubgroupTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginTop: 8,
      marginBottom: 10,
    },
    accessDeniedWrap: {
      flex: 1,
      padding: 24,
      paddingHorizontal: 28,
      justifyContent: 'center',
      alignItems: 'center',
    },
    accessDeniedTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.text,
      marginTop: 16,
      textAlign: 'center',
    },
    accessDeniedText: {
      fontSize: 15,
      color: theme.textSecondary,
      marginTop: 12,
      textAlign: 'center',
      lineHeight: 22,
    },
    tabRow: {
      flexGrow: 0,
      flexShrink: 0,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    tabRowContent: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      gap: 8,
    },
    tabButton: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 8,
      alignItems: 'center',
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
    },
    tabButtonActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    tabButtonText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.text,
    },
    tabButtonTextActive: {
      color: '#FFFFFF',
    },
    scrollView: {
      flex: 1,
      ...(Platform.OS === 'web'
        ? {
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
          }
        : {}),
    },
    pgmeiCard: {
      backgroundColor: isDesktop ? theme.card : tokens.insetFill,
      marginHorizontal: isDesktop ? 20 : mfSpacing.md,
      marginBottom: isDesktop ? 20 : mfSpacing.sm,
      padding: mfSpacing.md,
      borderRadius: mfRadius.md,
      borderWidth: 1,
      borderColor: isDesktop ? theme.border : tokens.insetBorder,
      overflow: 'hidden',
      position: 'relative',
      ...(Platform.OS === 'android' ? { elevation: 0 } : {}),
    },
    pgmeiInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6,
    },
    pgmeiTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    pgmeiSubtitle: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    section: {
      marginHorizontal: isDesktop ? 20 : mfSpacing.md,
      marginBottom: isDesktop ? 20 : mfSpacing.sm,
      backgroundColor: isDesktop ? theme.card : tokens.insetFill,
      borderRadius: mfRadius.md,
      borderWidth: 1,
      borderColor: isDesktop ? theme.border : tokens.insetBorder,
      padding: mfSpacing.md,
      ...(Platform.OS === 'android' ? { elevation: 0, overflow: 'hidden' as const } : {}),
    },
    sectionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    sectionDescription: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 6,
      marginBottom: 12,
    },
    mobileOverview: {
      marginHorizontal: mfSpacing.md,
      gap: mfSpacing.sm,
      marginBottom: mfSpacing.sm,
    },
    mobileOverviewTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.text,
    },
    mobileOverviewHint: {
      fontSize: 12,
      color: theme.textSecondary,
      marginBottom: mfSpacing.xs,
    },
    mobileOverviewCard: {
      marginHorizontal: 0,
      marginBottom: 0,
    },
    mobileParcSection: {
      paddingHorizontal: mfSpacing.md,
      marginHorizontal: 0,
    },
    mobileParcTitle: {
      fontSize: 20,
      fontWeight: '800',
    },
    mobileParcCard: {
      padding: mfSpacing.lg,
      borderRadius: mfRadius.md,
      borderWidth: 1,
      borderColor: tokens.insetBorder,
      backgroundColor: tokens.insetFill,
      gap: mfSpacing.md,
      marginBottom: mfSpacing.md,
    },
    mobileParcCardLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.textSecondary,
      textAlign: 'center',
    },
    mobileParcActions: {
      flexDirection: 'row',
      gap: mfSpacing.sm,
    },
    mobileParcBtn: {
      flex: 1,
      minHeight: 48,
      borderRadius: mfRadius.sm,
      borderWidth: 1,
      borderColor: tokens.insetBorder,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: mfSpacing.sm,
    },
    mobileParcBtnPrimary: {
      backgroundColor: tokens.accent,
      borderColor: tokens.accent,
    },
    mobileParcBtnDisabled: { opacity: 0.45 },
    mobileParcBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.text,
    },
    mobileParcBtnTextPrimary: {
      fontSize: 14,
      fontWeight: '800',
      color: isDarkMode ? '#030508' : '#fff',
    },
    statusBadge: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.primary,
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
    },
    sectionBody: {
      marginTop: 16,
    },
    inputGroup: {
      marginBottom: 16,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 8,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: theme.inputText,
      backgroundColor: theme.inputBackground,
    },
    periodRow: {
      marginBottom: 12,
    },
    periodLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.textSecondary,
      marginBottom: 6,
    },
    periodOptions: {
      flexDirection: 'row',
      gap: 8,
      paddingBottom: 2,
    },
    periodChip: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.background,
    },
    periodChipActive: {
      backgroundColor: tokens.accent,
      borderColor: tokens.accent,
    },
    periodChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.text,
    },
    periodChipTextActive: {
      color: isDarkMode ? '#030508' : '#FFFFFF',
    },
    certificateBox: {
      borderWidth: 1,
      borderColor: theme.border,
      borderStyle: 'dashed',
      backgroundColor: theme.background,
      borderRadius: 10,
      padding: 12,
      marginTop: 4,
      marginBottom: 8,
    },
    certificateText: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    downloadButton: {
      backgroundColor: theme.primary,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 4,
    },
    downloadButtonDisabled: {
      backgroundColor: theme.border,
    },
    downloadButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
    },
    errorText: {
      fontSize: 12,
      color: theme.error,
      marginBottom: 8,
    },
    currencyInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: 8,
      backgroundColor: theme.inputBackground,
      paddingLeft: 12,
    },
    currencySymbol: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      marginRight: 4,
    },
    currencyInput: {
      flex: 1,
      padding: 12,
      fontSize: 16,
      color: theme.inputText,
      backgroundColor: 'transparent',
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 10,
    },
    typeButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      backgroundColor: theme.background,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    typeButtonActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    typeButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
    },
    typeButtonTextActive: {
      color: '#FFFFFF',
    },
    saveButton: {
      backgroundColor: theme.primary,
      paddingVertical: 14,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 4,
    },
    saveButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    dateInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: 8,
      backgroundColor: theme.inputBackground,
    },
    dateInput: {
      flex: 1,
      padding: 12,
      fontSize: 16,
      color: theme.inputText,
    },
    textArea: {
      minHeight: 100,
      paddingTop: 12,
      paddingBottom: 12,
    },
    characterCount: {
      fontSize: 12,
      color: theme.textSecondary,
      textAlign: 'right',
      marginTop: 4,
    },
    filterRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 12,
      marginBottom: 12,
    },
    filterButton: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 8,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.background,
    },
    filterButtonActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    filterText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.text,
    },
    filterTextActive: {
      color: '#FFFFFF',
    },
    transactionCard: {
      backgroundColor: theme.card,
      marginVertical: 6,
      padding: 16,
      borderRadius: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    parcelamentoGlassCard: {
      marginVertical: 8,
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.85)',
      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.055)' : 'rgba(255, 255, 255, 0.7)',
      overflow: 'hidden',
      ...glassWeb,
      ...glassCardWeb,
    },
    parcelamentoCardMainRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    parcelamentoCardInfo: {
      flex: 1,
      minWidth: 0,
    },
    parcelamentoCardAside: {
      alignItems: 'flex-end',
      gap: 8,
      flexShrink: 0,
      maxWidth: isDesktop ? 148 : 118,
    },
    parcelamentoRefreshBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(96, 165, 250, 0.35)' : 'rgba(37, 99, 235, 0.22)',
      backgroundColor: isDarkMode ? 'rgba(96, 165, 250, 0.1)' : 'rgba(37, 99, 235, 0.06)',
      ...glassWeb,
    },
    parcelamentoRefreshBtnText: {
      color: theme.primary,
      fontSize: 12,
      fontWeight: '600',
    },
    parcelamentoNumero: {
      fontSize: 17,
      fontWeight: '700',
      color: theme.text,
      letterSpacing: -0.3,
      marginBottom: 4,
    },
    parcelamentoBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 999,
      ...glassWeb,
    },
    parcelamentoBadgeOpen: {
      backgroundColor: isDarkMode ? 'rgba(52, 211, 153, 0.12)' : 'rgba(16, 185, 129, 0.1)',
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(52, 211, 153, 0.32)' : 'rgba(5, 150, 105, 0.22)',
    },
    parcelamentoBadgeClosed: {
      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.04)' : 'rgba(248, 250, 252, 0.85)',
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : theme.border,
    },
    parcelamentoBadgePago: {
      backgroundColor: isDarkMode ? 'rgba(34, 197, 94, 0.18)' : 'rgba(220, 252, 231, 0.95)',
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(74, 222, 128, 0.35)' : 'rgba(22, 163, 74, 0.35)',
    },
    parcelamentoBadgeDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.success,
    },
    parcelamentoBadgeText: {
      fontSize: 10,
      fontWeight: '600',
      textAlign: 'right',
      lineHeight: 13,
    },
    parcelamentoBadgeTextOpen: {
      color: isDarkMode ? '#6ee7b7' : '#047857',
    },
    parcelamentoBadgeTextClosed: {
      color: theme.textSecondary,
    },
    parcelamentoBadgeTextPago: {
      color: isDarkMode ? '#86efac' : '#15803d',
    },
    parcFilterCard: {
      marginTop: 12,
      marginBottom: 16,
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : theme.border,
      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.04)' : theme.card,
      gap: 4,
      ...glassWeb,
      ...glassCardWeb,
    },
    parcFilterHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4,
    },
    parcFilterTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.text,
    },
    parcFilterHint: {
      fontSize: 13,
      color: theme.textSecondary,
      lineHeight: 18,
      marginBottom: 8,
    },
    parcFilterHintStrong: {
      fontWeight: '700',
      color: theme.text,
    },
    parcPeriodLive: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(96, 165, 250, 0.35)' : 'rgba(37, 99, 235, 0.25)',
      backgroundColor: isDarkMode ? 'rgba(96, 165, 250, 0.12)' : 'rgba(37, 99, 235, 0.08)',
    },
    parcPeriodLiveLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    parcPeriodLiveValue: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.primary,
      letterSpacing: 0.3,
    },
    parcFilterActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
      marginTop: 10,
    },
    parcListCaption: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.textSecondary,
      marginBottom: 8,
    },
    parcelamentoModalidade: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.textSecondary,
      marginBottom: 3,
    },
    parcelamentoMeta: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.primary,
      lineHeight: 16,
      marginTop: 2,
    },
    parcelamentoMetaSecondary: {
      fontSize: 11,
      color: theme.textTertiary,
      lineHeight: 15,
      marginTop: 2,
    },
    parcelamentoResumoLinha: {
      fontSize: 11,
      color: theme.textSecondary,
      lineHeight: 15,
      marginTop: 4,
    },
    parcelamentoParcelaSection: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)',
      gap: 8,
    },
    parcelamentoParcelaLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    parcelamentoParcelaGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    parcelamentoParcelaChip: {
      minWidth: isDesktop ? 92 : '30%',
      flexGrow: isDesktop ? 0 : 1,
      flexBasis: isDesktop ? 'auto' : '30%',
      maxWidth: isDesktop ? 120 : '32%',
      paddingVertical: 10,
      paddingHorizontal: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.14)' : theme.border,
      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.04)' : theme.backgroundMuted,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    parcelamentoParcelaChipPago: {
      borderColor: isDarkMode ? 'rgba(74, 222, 128, 0.4)' : 'rgba(22, 163, 74, 0.35)',
      backgroundColor: isDarkMode ? 'rgba(34, 197, 94, 0.12)' : 'rgba(220, 252, 231, 0.9)',
    },
    parcelamentoParcelaChipAberto: {
      borderColor: isDarkMode ? 'rgba(251, 191, 36, 0.45)' : 'rgba(217, 119, 6, 0.4)',
      backgroundColor: isDarkMode ? 'rgba(251, 191, 36, 0.1)' : 'rgba(254, 243, 199, 0.85)',
    },
    parcelamentoParcelaChipLiberada: {
      borderColor: isDarkMode ? 'rgba(96, 165, 250, 0.35)' : 'rgba(37, 99, 235, 0.3)',
      backgroundColor: isDarkMode ? 'rgba(96, 165, 250, 0.1)' : 'rgba(219, 234, 254, 0.85)',
    },
    parcelamentoParcelaChipActive: {
      borderColor: theme.primary,
      backgroundColor: isDarkMode ? 'rgba(96, 165, 250, 0.22)' : 'rgba(37, 99, 235, 0.12)',
      ...(Platform.OS === 'web'
        ? { boxShadow: `0 0 0 2px ${isDarkMode ? 'rgba(96, 165, 250, 0.35)' : 'rgba(37, 99, 235, 0.25)'}` }
        : {}),
    },
    parcelamentoParcelaChipPressed: {
      opacity: 0.88,
    },
    parcelamentoParcelaChipText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.text,
      textAlign: 'center',
    },
    parcelamentoParcelaChipTextActive: {
      color: theme.primary,
    },
    parcelamentoParcelaChipSub: {
      fontSize: 9,
      fontWeight: '600',
      color: theme.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    parcelamentoParcelaChipSubActive: {
      color: isDarkMode ? '#93c5fd' : '#2563eb',
    },
    parcelamentoParcelaChipSubPago: {
      color: isDarkMode ? '#86efac' : '#15803d',
    },
    parcelamentoParcelaSelected: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    parcelamentoParcelaSelectedStrong: {
      fontWeight: '700',
      color: theme.text,
    },
    parcelamentoParcelaHint: {
      marginTop: 8,
      fontSize: 11,
      color: theme.textTertiary,
    },
    parcelamentoDownloadRowBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1,
      width: '100%',
      ...glassWeb,
    },
    parcelamentoDownloadRowBtnActive: {
      borderColor: isDarkMode ? 'rgba(96, 165, 250, 0.45)' : 'rgba(37, 99, 235, 0.35)',
      backgroundColor: isDarkMode ? 'rgba(96, 165, 250, 0.14)' : 'rgba(37, 99, 235, 0.08)',
    },
    parcelamentoDownloadRowBtnSecondary: {
      borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : theme.border,
      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.03)' : theme.backgroundMuted,
    },
    parcelamentoDownloadRowBtnText: {
      fontSize: 14,
      fontWeight: '700',
    },
    parcelamentoDownloadRowBtnTextActive: {
      color: theme.primary,
    },
    parcelamentoDownloadRowBtnTextSecondary: {
      color: theme.textSecondary,
    },
    parcelamentoDownloadBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 999,
      borderWidth: 1,
      minWidth: 64,
      ...glassWeb,
    },
    parcelamentoDownloadBtnActive: {
      backgroundColor: isDarkMode ? 'rgba(96, 165, 250, 0.14)' : 'rgba(37, 99, 235, 0.08)',
      borderColor: isDarkMode ? 'rgba(96, 165, 250, 0.42)' : 'rgba(37, 99, 235, 0.28)',
      ...(glassBtnActiveWeb || {}),
    },
    parcelamentoDownloadBtnSecondary: {
      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.04)' : 'rgba(248, 250, 252, 0.9)',
      borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : theme.border,
    },
    parcelamentoDownloadBtnDisabled: {
      opacity: 0.45,
    },
    parcelamentoDownloadBtnLabel: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.4,
    },
    parcelamentoDownloadBtnLabelActive: {
      color: theme.primary,
    },
    parcelamentoDownloadBtnLabelSecondary: {
      color: theme.textSecondary,
    },
    transactionInfo: {
      flex: 1,
    },
    transactionDescription: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 4,
    },
    transactionDate: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    transactionStatus: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 4,
    },
    transactionDetails: {
      alignItems: 'flex-end',
    },
    transactionValue: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 8,
    },
    expenseValue: {
      color: theme.error,
    },
    actionButtons: {
      flexDirection: 'row',
      gap: 8,
    },
    editButton: {
      padding: 4,
    },
    deleteButton: {
      padding: 4,
    },
    emptyContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    emptyText: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    deleteOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    deleteModal: {
      width: '100%',
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 20,
    },
    deleteTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.text,
      marginBottom: 8,
    },
    deleteMessage: {
      fontSize: 14,
      color: theme.textSecondary,
      marginBottom: 20,
    },
    deleteActions: {
      flexDirection: 'row',
      gap: 10,
    },
    deleteButtonBase: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    deleteCancelButton: {
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
    },
    deleteConfirmButton: {
      backgroundColor: theme.error,
    },
    deleteCancelText: {
      color: theme.text,
      fontWeight: '600',
    },
    deleteConfirmText: {
      color: '#FFFFFF',
      fontWeight: '600',
    },

    // ── DAS & Notas — Enterprise (TOTVS) + Mobile ──────────────
    dasToolbar: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginBottom: 12,
      flexWrap: 'wrap' as const,
      gap: 8,
    },
    dasToolbarLeft: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, flex: 1 },
    dasToolbarTitle: { fontSize: 15, fontWeight: '700' as const, color: theme.text },
    dasToolbarActions: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, flexWrap: 'wrap' as const },
    notasActionBar: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      flexWrap: 'wrap' as const,
      gap: 12,
      paddingTop: 4,
      paddingBottom: 16,
      marginBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    notasActionBarGroup: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      flexWrap: 'wrap' as const,
      gap: 8,
    },
    notasBtnPrimary: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      backgroundColor: theme.primary,
      paddingHorizontal: 16,
      minHeight: 40,
      paddingVertical: 10,
      borderRadius: 10,
      gap: 6,
    },
    notasBtnSecondary: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 14,
      minHeight: 40,
      paddingVertical: 10,
      borderRadius: 10,
      gap: 6,
    },
    dasBtn: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      backgroundColor: theme.primary,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 6,
      gap: 4,
    },
    dasBtnDisabled: { backgroundColor: theme.border },
    dasBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' as const },
    dasBtnSecondary: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 6,
      gap: 4,
    },
    dasBtnSecondaryText: { color: theme.primary, fontSize: 13, fontWeight: '600' as const },
    dasPanelCard: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      marginBottom: 12,
      overflow: 'hidden' as const,
    },
    dasPanelHeader: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.backgroundMuted,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    dasPanelHeaderText: {
      fontSize: 12,
      fontWeight: '700' as const,
      color: theme.textSecondary,
      letterSpacing: 0.6,
      textTransform: 'uppercase' as const,
    },
    dasPanelHeaderCount: {
      fontSize: 12,
      fontWeight: '600' as const,
      color: theme.textTertiary,
    },
    dasPanelHeaderActions: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 10,
    },
    dasPanelRefreshBtn: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 5,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    dasPanelRefreshBtnText: {
      fontSize: 11,
      fontWeight: '600' as const,
      color: theme.primary,
    },
    dasPeriodsEmpty: {
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: 8,
      paddingVertical: 24,
      paddingHorizontal: 16,
    },
    dasPeriodsEmptyText: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center' as const,
      lineHeight: 20,
    },
    dasFormGrid: isDesktop
      ? { flexDirection: 'row' as const, gap: 16, padding: 16, flexWrap: 'wrap' as const }
      : {},
    dasFormField: isDesktop ? { flex: 1, minWidth: 240 } : {},
    dasFormLabel: {
      fontSize: 11,
      fontWeight: '700' as const,
      color: theme.textTertiary,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    dasFormInput: {
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: 6,
      paddingVertical: 9,
      paddingHorizontal: 12,
      fontSize: 14,
      color: theme.inputText,
      backgroundColor: theme.inputBackground,
    },
    dasFormInputLocked: { backgroundColor: theme.backgroundMuted, color: theme.textSecondary },
    dasFormNote: { fontSize: 11, color: theme.textSecondary, marginTop: 4 },
    dasChipGroup: { flexDirection: 'row' as const, gap: 6, flexWrap: 'wrap' as const, marginBottom: 6 },
    dasPeriodChip: {
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.background,
    },
    dasPeriodChipActive: { backgroundColor: tokens.accent, borderColor: tokens.accent },
    dasPeriodChipText: { fontSize: 12, fontWeight: '600' as const, color: theme.text },
    dasPeriodChipTextActive: { color: isDarkMode ? '#030508' : '#FFF' },
    dasFormActions: {
      flexDirection: 'row' as const,
      gap: 10,
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    dasActionBtn: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 8,
      gap: 4,
    },
    dasActionBtnPrimary: { backgroundColor: theme.primary },
    dasActionBtnPrimaryText: { color: '#FFF', fontSize: 14, fontWeight: '600' as const },
    dasActionBtnOutline: { borderWidth: 1, borderColor: theme.primary, backgroundColor: 'transparent' as const },
    dasActionBtnOutlineText: { color: theme.primary, fontSize: 14, fontWeight: '600' as const },
    dasFilterGroup: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 6,
      padding: 12,
      flexWrap: 'wrap' as const,
    },
    dasFilterTab: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 4,
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: 5,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.background,
    },
    dasFilterTabActive: { backgroundColor: theme.primary, borderColor: theme.primary },
    dasFilterTabText: { fontSize: 12, fontWeight: '600' as const, color: theme.textSecondary },
    dasFilterTabTextActive: { color: '#FFF' },
    dasRegisterBtn: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 4,
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: 5,
      borderWidth: 1,
      borderColor: theme.primary,
    },
    dasRegisterBtnText: { fontSize: 12, fontWeight: '600' as const, color: theme.primary },
    dasInlineForm: { padding: 16, borderTopWidth: 1, borderTopColor: theme.border },
    dasTable: { width: '100%' as const },
    dasTableHeader: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      paddingHorizontal: 16,
      paddingVertical: 9,
      backgroundColor: theme.backgroundMuted,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    dasTableHeaderCell: {
      fontSize: 10,
      fontWeight: '800' as const,
      color: theme.textTertiary,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.8,
    },
    dasTableRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      paddingHorizontal: 16,
      paddingVertical: 11,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderLight,
    },
    dasTableRowAlt: { backgroundColor: theme.backgroundMuted },
    dasTableCell: { fontSize: 13, color: theme.text },
    dasTableCellMoney: { fontWeight: '700' as const, textAlign: 'right' as const },
    dasTableAction: {
      width: 30,
      height: 28,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.background,
    },
    dasStatusBadge: {
      alignSelf: 'flex-start' as const,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 4,
      borderWidth: 1,
    },
    dasStatusPago: { backgroundColor: theme.successLight, borderColor: theme.success + '40' },
    dasStatusAPagar: { backgroundColor: warningSoftBg, borderColor: warningSoftBorder },
    dasStatusVencida: { backgroundColor: theme.errorLight, borderColor: theme.error + '40' },
    dasStatusErro: { backgroundColor: theme.errorLight, borderColor: theme.error + '40' },
    dasStatusIndisponivel: { backgroundColor: theme.backgroundMuted, borderColor: theme.border },
    dasStatusBadgeText: { fontSize: 11, fontWeight: '700' as const },
    dasPeriodReason: {
      marginTop: 6,
      fontSize: 10,
      lineHeight: 14,
      color: theme.textTertiary,
    },
    dasTypeBadge: {
      fontSize: 10,
      fontWeight: '800' as const,
      color: theme.primary,
      backgroundColor: theme.primaryLight,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 3,
      alignSelf: 'flex-start' as const,
      letterSpacing: 0.5,
      textTransform: 'uppercase' as const,
    },
    dasCardHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, marginBottom: 12 },
    dasCertNote: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 5,
      marginTop: 6,
      backgroundColor: theme.successLight,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 6,
    },
    dasCertNoteText: { fontSize: 12, color: theme.success, fontWeight: '500' as const },
    dasMobilePeriodCard: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      minWidth: 72,
      alignItems: 'center' as const,
    },
    dasMobilePeriodPago: { backgroundColor: theme.successLight, borderColor: theme.success + '40' },
    dasMobilePeriodAberto: { backgroundColor: warningSoftBg, borderColor: warningSoftBorder },
    dasMobilePeriodErro: { backgroundColor: theme.errorLight, borderColor: theme.error + '40' },
    dasMobilePeriodComp: { fontSize: 13, fontWeight: '700' as const, color: theme.text, marginBottom: 2 },
    dasMobilePeriodStatus: { fontSize: 10, fontWeight: '700' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
    dasMobilePeriodStatusAberto: { color: warningSoftText },
    dasEmitButton: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      backgroundColor: theme.primary,
      borderRadius: 14,
      padding: 18,
      marginBottom: 16,
    },
    dasEmitButtonInner: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 14 },
    dasEmitIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    dasEmitButtonTitle: { fontSize: 16, fontWeight: '700' as const, color: '#FFF' },
    dasEmitButtonSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
    dasNoteCard: {
      backgroundColor: theme.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      borderLeftWidth: 4,
      marginBottom: 10,
      paddingTop: 14,
      paddingRight: 16,
      paddingBottom: 14,
      paddingLeft: 18,
      gap: 8,
    },
    dasNoteCardActions: {
      flexDirection: 'row' as const,
      borderTopWidth: 1,
      borderTopColor: theme.borderLight,
      backgroundColor: theme.backgroundMuted,
    },
    dasNoteAction: {
      flex: 1,
      alignItems: 'center' as const,
      paddingVertical: 10,
      gap: 3,
      borderRightWidth: 1,
      borderRightColor: theme.borderLight,
    },
    dasNoteActionText: { fontSize: 10, fontWeight: '600' as const, color: theme.primary },
  });
};

const createModalStyles = (theme: ReturnType<typeof getTheme>) =>
  StyleSheet.create({
    modalContainer: {
      flex: 1,
      backgroundColor: theme.surface,
    },
    modalContent: {
      flex: 1,
      backgroundColor: theme.surface,
    },
    modalBodyContent: {
      paddingBottom: 40,
      flexGrow: 1,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.surface,
    },
    closeButton: {
      padding: 8,
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    titleContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      textAlign: 'center',
    },
    modalBody: {
      flex: 1,
      padding: 20,
    },
    inputGroup: {
      marginBottom: 20,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 8,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: theme.inputText,
      backgroundColor: theme.inputBackground,
    },
    currencyInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: 8,
      backgroundColor: theme.inputBackground,
      paddingLeft: 12,
    },
    currencySymbol: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      marginRight: 4,
    },
    currencyInput: {
      flex: 1,
      padding: 12,
      fontSize: 16,
      color: theme.inputText,
      backgroundColor: 'transparent',
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 10,
    },
    typeButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      backgroundColor: theme.background,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    typeButtonActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    typeButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
    },
    typeButtonTextActive: {
      color: '#FFFFFF',
    },
    saveButton: {
      backgroundColor: theme.primary,
      paddingVertical: 14,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 10,
    },
    saveButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    dateInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: 8,
      backgroundColor: theme.inputBackground,
    },
    dateInput: {
      flex: 1,
      padding: 12,
      fontSize: 16,
      color: theme.inputText,
    },
    textArea: {
      minHeight: 100,
      paddingTop: 12,
      paddingBottom: 12,
    },
    characterCount: {
      fontSize: 12,
      color: theme.textSecondary,
      textAlign: 'right',
      marginTop: 4,
    },
  });
