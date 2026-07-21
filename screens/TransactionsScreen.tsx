import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  SectionList,
  Animated,
  Easing,
  useWindowDimensions,
  Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar, DateData } from 'react-native-calendars';
import { useTransactionStore } from '../store/transactionStore';
import { useRecorrenciaStore } from '../store/recorrenciaStore';
import { projectRecurrences, isProjecao, buildMaterializationPayload, type ProjectedTransaction } from '../lib/recorrenciaProjection';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { getTheme } from '../lib/theme';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { fetchUserCategories } from '../lib/categoryService';
import { apiClient } from '../lib/apiClient';
import { isLocalApiAuthMode } from '../lib/authMode';
import { promptGoogleAuth } from '../lib/google-auth-flow';
import { formatNumberBR, parseNumberBR, formatCurrencyInput, formatCurrencyBR } from '../lib/numberFormat';
import { useNavigationDrawer } from '../lib/navigationContext';
import { AppLegalFooter, useShellLayout } from '../components/shell';
import { SHELL_CANVAS_DARK, SHELL_CANVAS_LIGHT } from '../components/shell/shellTokens';
import { MfAppHeader, MfPeriodNav, MfSegmented } from '../components/ui';
import { MfConfirmDialog } from '../components/ui/MfConfirmDialog';
import { mfRadius, mfSpacing, mfTypography } from '../lib/theme';
import { getTechTokens, mfTechInsetSurface, mfTechPanelChrome } from '../lib/techDesign';
import { useMfTheme } from '../components/ui/useMfTheme';
import { TransactionsPageChrome } from './Transactions/transactionsPageChrome';
import { TransactionsMonthMetrics } from './Transactions/TransactionsMonthMetrics';
import { TransactionsPeriodToolbar } from './Transactions/TransactionsPeriodToolbar';
import { TransactionsHeaderActions } from './Transactions/TransactionsHeaderActions';
import { TransactionsDateSectionHeader } from './Transactions/TransactionsDateSectionHeader';
import { TransactionsMobileListHeader } from './Transactions/TransactionsMobileListHeader';
import { TransactionsFilterPills } from './Transactions/TransactionsFilterPills';
import {
  matchesTransactionPeriod,
  periodToolbarLabel,
  type TransactionDateRange,
  type TransactionPeriodPreset,
} from '../lib/transactionPeriodFilter';
import { exportTransactionsToExcel } from '../lib/exportTransactionsSpreadsheet';
import { ContaPickerField } from '../components/contas/ContaPickerField';
import { useUserContasFinanceiras } from '../hooks/useUserContasFinanceiras';
import {
  filterTransactionsByConta,
  computeMonthFlowKpis,
  type ContaFilterValue,
} from '../lib/contaFinanceiraIntegration';
import {
  getWebScrollbarStyle,
  WEB_HIDE_X_SCROLL_CLASS,
  WEB_SCROLL_Y_CLASS,
} from '../lib/webScrollbar';

/**
 * Inter (carregada em web/index.html) — contornos suaves em UI; itálico incluído.
 * ui-sans-serif / system-ui como fallback se a fonte ainda não tiver carregado.
 */
const WEB_UI_FONT_STACK =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

/** Painel fixo do formulário de lançamento (layout desktop / web). */
const DESKTOP_FORM_PANEL_WIDTH = 400;

function webUiFont(): {
  fontFamily?: string;
  WebkitFontSmoothing?: string;
  MozOsxFontSmoothing?: string;
} {
  if (Platform.OS !== 'web') return {};
  return {
    fontFamily: WEB_UI_FONT_STACK,
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale',
  };
}

interface Categoria {
  id: number;
  nome: string;
  tipo: string;
}

/** Mapeamento de categoria (lowercase, sem acentos) → ícone Ionicons. */
const CATEGORY_ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  // Alimentação
  'alimentacao': 'restaurant-outline',
  'alimentação': 'restaurant-outline',
  'comida': 'restaurant-outline',
  'restaurante': 'restaurant-outline',
  'lanche': 'fast-food-outline',
  'mercado': 'cart-outline',
  'supermercado': 'cart-outline',
  // Transporte
  'transporte': 'car-outline',
  'combustivel': 'car-outline',
  'combustível': 'car-outline',
  'gasolina': 'car-outline',
  'uber': 'car-outline',
  '99': 'car-outline',
  'estacionamento': 'car-outline',
  // Casa
  'casa': 'home-outline',
  'aluguel': 'home-outline',
  'condominio': 'business-outline',
  'condomínio': 'business-outline',
  'agua': 'water-outline',
  'água': 'water-outline',
  'luz': 'flash-outline',
  'energia': 'flash-outline',
  'gas': 'flame-outline',
  'gás': 'flame-outline',
  // Comunicação
  'internet': 'wifi-outline',
  'telefone': 'call-outline',
  'celular': 'phone-portrait-outline',
  'assinaturas': 'repeat-outline',
  'streaming': 'film-outline',
  'netflix': 'film-outline',
  'spotify': 'musical-notes-outline',
  // Saúde
  'saude': 'medkit-outline',
  'saúde': 'medkit-outline',
  'farmacia': 'medkit-outline',
  'farmácia': 'medkit-outline',
  'medico': 'medkit-outline',
  'médico': 'medkit-outline',
  'plano de saude': 'medkit-outline',
  // Educação
  'educacao': 'school-outline',
  'educação': 'school-outline',
  'curso': 'school-outline',
  'faculdade': 'school-outline',
  // Lazer
  'lazer': 'happy-outline',
  'cinema': 'film-outline',
  'viagem': 'airplane-outline',
  'hotel': 'bed-outline',
  // Pessoal
  'roupa': 'shirt-outline',
  'beleza': 'cut-outline',
  'cabelo': 'cut-outline',
  'pet': 'paw-outline',
  // Financeiro
  'salario': 'cash-outline',
  'salário': 'cash-outline',
  'receita': 'trending-up-outline',
  'receitas': 'trending-up-outline',
  'receitas diversas': 'cash-outline',
  'investimento': 'trending-up-outline',
  'investimentos': 'trending-up-outline',
  'banco': 'business-outline',
  'cartao': 'card-outline',
  'cartão': 'card-outline',
  'emprestimo': 'cash-outline',
  'empréstimo': 'cash-outline',
  'imposto': 'document-text-outline',
  'taxa': 'document-text-outline',
  // Trabalho
  'trabalho': 'briefcase-outline',
  'freelance': 'briefcase-outline',
};

/** Retorna o ícone apropriado para uma categoria; fallback genérico. */
function getCategoryIcon(classificacao: string, tipo: string): keyof typeof Ionicons.glyphMap {
  if (!classificacao) {
    return String(tipo).toLowerCase() === 'entrada' ? 'arrow-down-circle-outline' : 'pricetag-outline';
  }
  const key = classificacao.toLowerCase().trim();
  if (CATEGORY_ICON_MAP[key]) return CATEGORY_ICON_MAP[key];
  // Tentar match parcial (categoria contém alguma palavra-chave conhecida)
  for (const [pattern, icon] of Object.entries(CATEGORY_ICON_MAP)) {
    if (key.includes(pattern) || pattern.includes(key)) return icon;
  }
  return String(tipo).toLowerCase() === 'entrada' ? 'arrow-down-circle-outline' : 'pricetag-outline';
}

/** Mesmos dados para edição, sem id nem recorrência — novo lançamento ao salvar. */
function buildDuplicateTransactionDraft(tx: any) {
  if (!tx) return null;
  const copy: any = { ...tx };
  delete copy.id;
  delete copy.criado_em;
  delete copy.__projecao;
  delete copy.recorrencia_id;
  delete copy.recorrencia_ano_mes;
  copy._draftDuplicate = true;
  return copy;
}

/**
 * Data em dd/mm/aaaa só a partir de dígitos (máx. 8).
 * Evita "1//05/2026" ao editar no meio do campo: ignora barras digitadas e remonta.
 */
function formatPartialBrDateInput(raw: string): string {
  const digits = String(raw).replace(/\D/g, '').slice(0, 8);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function countDigitsBeforeDisplayIndex(str: string, displayIndex: number): number {
  const lim = Math.min(Math.max(0, displayIndex), str.length);
  let n = 0;
  for (let i = 0; i < lim; i++) {
    if (/\d/.test(str[i])) n++;
  }
  return n;
}

/** Posição do cursor (índice na string formatada) logo após o enésimo dígito; 0 = início. */
function displayCaretAfterNDigits(str: string, nDigits: number): number {
  if (nDigits <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < str.length; i++) {
    if (/\d/.test(str[i])) {
      seen++;
      if (seen === nDigits) return i + 1;
    }
  }
  return str.length;
}

/**
 * Mantém o cursor perto de onde o utilizador editou ao reformatar dd/mm/aaaa
 * (evita saltar para o fim em inputs controlados).
 */
function computeBrDateInputUpdate(
  prevDisplay: string,
  nativeText: string,
  caretStart: number
): { formatted: string; caret: number } {
  const formatted = formatPartialBrDateInput(nativeText);
  const prevDigits = prevDisplay.replace(/\D/g, '').length;
  const newDigits = formatted.replace(/\D/g, '').length;
  const digitsBeforeCaret = countDigitsBeforeDisplayIndex(prevDisplay, caretStart);

  let caretDigitIndex = digitsBeforeCaret;
  if (newDigits < prevDigits) {
    caretDigitIndex = Math.max(0, digitsBeforeCaret - 1);
  } else if (newDigits > prevDigits) {
    caretDigitIndex = Math.min(digitsBeforeCaret + 1, newDigits);
  } else {
    caretDigitIndex = Math.min(digitsBeforeCaret, newDigits);
  }

  const caret = displayCaretAfterNDigits(formatted, caretDigitIndex);
  return { formatted, caret };
}

const WEEKDAY_ABBR_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;

/** A partir de YYYY-MM-DD válido, abreviação do dia da semana (pt-BR). */
function weekdayAbbrFromYmd(ymd: string): string {
  const m = String(ymd || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return '';
  return WEEKDAY_ABBR_PT[dt.getDay()];
}

function TransactionModal({
  visible,
  onClose,
  transaction,
  onSave,
  useDialogLayout = false,
  contasAtivas = [],
  defaultContaId = null,
}: {
  visible: boolean;
  onClose: () => void;
  transaction?: any;
  onSave: (data: any) => void;
  /** Web desktop: modal centralizado em vez de tela cheia. */
  useDialogLayout?: boolean;
  contasAtivas?: import('../lib/contaFinanceiraTypes').ContaFinanceira[];
  defaultContaId?: string | null;
}) {
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useThemeStore();
  const theme = useMemo(() => getTheme(isDarkMode), [isDarkMode]);
  const modalStyles = useMemo(
    () => createModalStyles(theme, useDialogLayout),
    [theme, useDialogLayout],
  );
  /** Evita fechar ao soltar o clique fora do card depois de interagir com o form (web). */
  const blockBackdropCloseRef = useRef(false);

  useEffect(() => {
    if (!visible || !useDialogLayout || Platform.OS !== 'web') return;
    const releasePointer = () => {
      blockBackdropCloseRef.current = false;
    };
    window.addEventListener('pointerup', releasePointer);
    return () => window.removeEventListener('pointerup', releasePointer);
  }, [visible, useDialogLayout]);

  const handleBackdropClose = () => {
    if (blockBackdropCloseRef.current) return;
    onClose();
  };

  const markDialogInteraction = () => {
    blockBackdropCloseRef.current = true;
  };

  // Função auxiliar para normalizar tipo (aceita todas as variações)
  const normalizarTipoParaUI = (tipo: string | undefined): 'entrada' | 'saída' => {
    if (!tipo) return 'saída';
    const tipoLower = String(tipo).toLowerCase().trim();
    // Normalizar para entrada
    if (tipoLower === 'entrada') return 'entrada';
    // Todas as outras variações (saida, saída, saida, etc.) -> 'saída' para UI
    // Isso garante que qualquer variação de 'saída' seja normalizada para 'saída'
    return 'saída';
  };

  const [tipo, setTipo] = useState<'entrada' | 'saída'>('saída');
  // Garantir que valor seja convertido corretamente para string com R$ e formatação
  const [valor, setValor] = useState(() => {
    if (!transaction?.valor) return '';
    const numVal = typeof transaction.valor === 'number' ? transaction.valor : parseFloat(String(transaction.valor));
    if (isNaN(numVal)) return '';
    // Formata com R$ e separadores de milhar
    const formatted = numVal.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `R$ ${formatted}`;
  });
  const [classificacao, setClassificacao] = useState(String(transaction?.classificacao || ''));
  const [data, setData] = useState(() => {
    if (!transaction?.data) return new Date().toISOString().split('T')[0];
    const s = String(transaction.data).trim();
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : new Date().toISOString().split('T')[0];
  });
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [status, setStatus] = useState(
    String(transaction?.status || (transaction?.tipo === 'entrada' ? 'recebido' : 'pago'))
  );
  const [obs, setObs] = useState(String(transaction?.obs || ''));
  const [recorrente, setRecorrente] = useState(false);
  // Limite de duração da recorrência: null = indefinido; número = quantidade de meses.
  const [maxOcorrencias, setMaxOcorrencias] = useState<number | null>(null);
  const [customMesesInput, setCustomMesesInput] = useState<string>('');
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [categoriaDropdownVisible, setCategoriaDropdownVisible] = useState(false);
  const [contaId, setContaId] = useState<string | null>(null);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const { userId } = useAuthStore();
  const { addRecorrencia, updateRecorrencia: updateRecorrenciaStore, recorrencias: storeRecorrencias } = useRecorrenciaStore();
  // Guarda a duração inicial vinda do template — usado para detectar mudança ao salvar.
  const [initialMaxOcorrencias, setInitialMaxOcorrencias] = useState<number | null>(null);
  const isEditing = Boolean(transaction?.id);
  const isDuplicateDraft = Boolean((transaction as any)?._draftDuplicate);
  const vinculadaARecorrencia = Boolean(transaction?.recorrencia_id);

  // Função para converter YYYY-MM-DD para dd/mm/aaaa
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

  // Função para converter dd/mm/aaaa para YYYY-MM-DD
  const parseDateFromBR = (dateString: string): string => {
    if (!dateString) return '';
    // Remove caracteres não numéricos exceto /
    const cleaned = dateString.replace(/[^\d/]/g, '');
    const parts = cleaned.split('/');
    
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      
      // Validar formato básico
      if (day && month && year && year.length === 4) {
        const dateStr = `${year}-${month}-${day}`;
        const date = new Date(dateStr + 'T00:00:00');
        if (!isNaN(date.getTime())) {
          return dateStr;
        }
      }
    }
    
    // Se não conseguir converter, retorna vazio
    return '';
  };

  /** Extrai YYYY-MM-DD de ISO/timestamp vindo do banco (evita formatDateToBR quebrar). */
  const toIsoDateOnly = (raw: string): string => {
    if (!raw) return '';
    const s = String(raw).trim();
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : '';
  };

  // Estado para o valor formatado da data (dd/mm/aaaa)
  const [dataFormatada, setDataFormatada] = useState(() => {
    if (transaction?.data) {
      const s = String(transaction.data).trim();
      const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
      const iso = m ? m[1] : new Date().toISOString().split('T')[0];
      return formatDateToBR(iso);
    }
    return formatDateToBR(new Date().toISOString().split('T')[0]);
  });
  const modalDataDateSelectionRef = useRef({ start: 0, end: 0 });
  const [modalDataDateSelection, setModalDataDateSelection] = useState<
    { start: number; end: number } | undefined
  >(undefined);
  const modalDataFormatadaRef = useRef('');
  modalDataFormatadaRef.current = dataFormatada;

  const modalDataWeekdayAbbr = useMemo(() => {
    let iso = '';
    if (data && /^\d{4}-\d{2}-\d{2}$/.test(String(data))) iso = String(data);
    if (!iso && dataFormatada.length === 10) iso = parseDateFromBR(dataFormatada);
    return iso ? weekdayAbbrFromYmd(iso) : '';
  }, [data, dataFormatada]);

  // Filtrar categorias pelo tipo da transação
  const categoriasFiltradas = categorias.filter((cat) => {
    // Normalizar tipos para comparação (banco pode ter 'saida' ou 'saída', transação usa 'saída')
    const catTipoRaw = String(cat.tipo || '').toLowerCase();
    const catTipo = catTipoRaw === 'saida' || catTipoRaw === 'saída' ? 'saída' : cat.tipo;
    const tipoStr = String(tipo);
    const tipoNormalizado = tipoStr === 'saida' || tipoStr === 'saída' ? 'saída' : tipo;
    return catTipo === tipoNormalizado;
  });

  // Atualizar estados quando o modal for aberto ou quando a transação mudar
  useEffect(() => {
    if (!visible) {
      // Fechar dropdown de categorias e calendário quando o modal principal fechar
      setCategoriaDropdownVisible(false);
      setCalendarVisible(false);
      // Resetar estados quando fechar
      setTipo('saída');
      setStatus('pago');
      setValor('');
      setClassificacao('');
      setContaId(defaultContaId || null);
      setObs('');
      setRecorrente(false);
      setMaxOcorrencias(null);
      setCustomMesesInput('');
      setIsCustomMode(false);
    } else {
      // Atualizar campos com dados da transação ou valores padrão
      // Normalizar tipo: pode vir 'saida' ou 'saída' do banco, sempre normalizar para 'saída' na UI
      const tipoNormalizado = normalizarTipoParaUI(transaction?.tipo);
      // Sempre atualizar o tipo quando o modal abrir ou a transação mudar
      // Forçar atualização usando setTimeout para garantir que aconteça após renderização
      setTipo(tipoNormalizado);
      
      if (transaction?.valor) {
        const numVal = typeof transaction.valor === 'number' ? transaction.valor : parseFloat(String(transaction.valor));
        if (isNaN(numVal)) {
          setValor('');
        } else {
          const formatted = numVal.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
          setValor(`R$ ${formatted}`);
        }
      } else {
        setValor('');
      }
      
      setClassificacao(String(transaction?.classificacao || ''));
      const rawData = transaction?.data ? String(transaction.data) : new Date().toISOString().split('T')[0];
      const dataValue = toIsoDateOnly(rawData) || new Date().toISOString().split('T')[0];
      setData(dataValue);
      setDataFormatada(formatDateToBR(dataValue));
      
      // Definir status: se transaction existe e tem status, usar esse status; senão, usar padrão baseado no tipo
      if (transaction?.status) {
        // Se a transação existe e tem status, usar esse status
        setStatus(String(transaction.status));
      } else {
        // Se não tem status, usar padrão baseado no tipo
        const statusPadrao = tipoNormalizado === 'entrada' ? 'recebido' : 'pago';
        setStatus(statusPadrao);
      }
      
      setObs(String(transaction?.obs || ''));
      setContaId(
        transaction?.conta_id
          ? String(transaction.conta_id)
          : defaultContaId || null,
      );

      // Se a transação vem de uma recorrência, reflete o estado real e busca o limite
      // (max_ocorrencias) do template para mostrar a duração configurada.
      if (transaction?.recorrencia_id) {
        setRecorrente(true);
        const tpl = storeRecorrencias.find((r) => r.id === transaction.recorrencia_id);
        const max = tpl?.max_ocorrencias ?? null;
        setMaxOcorrencias(max);
        setInitialMaxOcorrencias(max);
        if (max != null && ![3, 6, 12].includes(max)) {
          setIsCustomMode(true);
          setCustomMesesInput(String(max));
        } else {
          setIsCustomMode(false);
          setCustomMesesInput('');
        }
      } else {
        setRecorrente(false);
        setMaxOcorrencias(null);
        setInitialMaxOcorrencias(null);
        setCustomMesesInput('');
        setIsCustomMode(false);
      }

      // Carregar categorias
      if (!userId) return;
      void fetchUserCategories(userId)
        .then((data) => {
          const normalizedData = (data || []).map((cat) => ({
            id: Number(cat.id) || 0,
            nome: String(cat.nome || ''),
            tipo: String(cat.tipo || ''),
          }));
          setCategorias(normalizedData);
        })
        .catch(() => setCategorias([]));
    }
  }, [visible, transaction, userId]);

  // Atualizar tipo quando transaction mudar (garantir que sempre esteja sincronizado)
  // Este useEffect garante que qualquer variação (saida, saída, etc.) seja normalizada para 'saída' na UI
  useEffect(() => {
    if (visible) {
      // Sempre normalizar e atualizar o tipo quando modal estiver visível
      // Isso garante que 'saida' (sem acento) ou 'saída' (com acento) sempre marquem o botão "Saída"
      const tipoNormalizado = normalizarTipoParaUI(transaction?.tipo);
      setTipo(tipoNormalizado);
    }
  }, [transaction?.tipo, visible, transaction]);

  // Atualizar status quando o tipo mudar (apenas transação nova — sem objeto ainda)
  useEffect(() => {
    if (visible && !transaction) {
      setStatus(tipo === 'entrada' ? 'recebido' : 'pago');
    }
  }, [tipo, visible, transaction]);

  // Limpar categoria e fechar dropdown quando o tipo mudar
  useEffect(() => {
    if (!visible) return;
    
    // Fechar dropdown se estiver aberto
    setCategoriaDropdownVisible(false);
    
    // Verificar se a categoria atual é compatível com o novo tipo
    if (classificacao && categorias.length > 0) {
      const categoriaAtual = categorias.find((cat) => {
        // Normalizar tipos para comparação (pode ser 'saída' ou 'saida' no banco)
        const catTipo = cat.tipo === 'saida' ? 'saída' : cat.tipo;
        return cat.nome === classificacao && catTipo === tipo;
      });
      
      // Se a categoria não for compatível com o novo tipo, limpar
      if (!categoriaAtual) {
        setClassificacao('');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo]); // Só executar quando o tipo mudar

  const handleSave = async () => {
    if (!valor || !classificacao || !userId) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos');
      return;
    }

    // Validar e converter data (campo manual completo tem prioridade sobre ISO antigo)
    let dataFinal = '';
    if (dataFormatada && dataFormatada.length === 10) {
      dataFinal = parseDateFromBR(dataFormatada);
    }
    if (!dataFinal && data) {
      dataFinal = toIsoDateOnly(String(data));
    }

    if (!dataFinal || !dataFinal.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert('Erro', 'Por favor, insira uma data válida (dd/mm/aaaa)');
      return;
    }

    // Garantir que valor seja número válido (remove formatação R$ e separadores)
    const cleaned = valor.replace(/[R$\s.]/g, '').replace(',', '.');
    const valorNum = parseFloat(cleaned);
    if (isNaN(valorNum) || valorNum <= 0) {
      Alert.alert('Erro', 'Por favor, insira um valor válido');
      return;
    }

    // Converter tipo de 'saída' para 'saida' antes de salvar no banco
    const tipoParaBanco = tipo === 'saída' ? 'saida' : tipo;

    // Resolve a duração final (max_ocorrencias) a partir do estado dos pills.
    const limiteFinal: number | null = (() => {
      if (!isCustomMode) return maxOcorrencias;
      const n = parseInt(customMesesInput, 10);
      return Number.isInteger(n) && n >= 1 && n <= 1200 ? n : null;
    })();

    // Se a transação JÁ é vinculada a uma recorrência e o usuário mudou a duração,
    // propaga essa mudança para o template — isso é o que permite "editar a
    // recorrência em qualquer mês" sem ir a Configurações.
    if (vinculadaARecorrencia && transaction?.recorrencia_id && limiteFinal !== initialMaxOcorrencias) {
      try {
        await updateRecorrenciaStore(transaction.recorrencia_id, {
          max_ocorrencias: limiteFinal,
        });
      } catch (err) {
        console.error('Falha ao atualizar duração da recorrência:', err);
        Alert.alert(
          'Atenção',
          'A duração da recorrência não pôde ser atualizada. As outras alterações serão salvas.'
        );
      }
    }

    // Se for transação NOVA e o usuário marcou como recorrente, criar a recorrência ANTES
    // da transação para conseguir vincular `recorrencia_id` + `recorrencia_ano_mes`. Isso
    // evita duplicar projeção no mês atual e mantém o toggle ativo ao reabrir para editar.
    let recorrenciaIdParaVincular: string | null = null;
    let recorrenciaAnoMes: string | null = null;
    if (recorrente && !vinculadaARecorrencia) {
      const diaDoMes = Number((dataFinal || '').slice(8, 10)) || new Date().getDate();
      try {
        const created = await addRecorrencia({
          tipo: String(tipoParaBanco),
          valor: valorNum,
          classificacao: String(classificacao),
          status: String(status),
          obs: obs.trim() || null,
          dia_do_mes: Math.min(Math.max(diaDoMes, 1), 31),
          ativo: true,
          max_ocorrencias: limiteFinal,
        });
        if (created?.id) {
          recorrenciaIdParaVincular = created.id;
          recorrenciaAnoMes = dataFinal.slice(0, 7); // YYYY-MM
        }
      } catch (err) {
        console.error('Falha ao criar recorrência:', err);
        Alert.alert(
          'Atenção',
          'Não foi possível criar a recorrência. A transação ainda será salva como avulsa.'
        );
      }
    }

    onSave({
      tipo: String(tipoParaBanco),
      valor: valorNum,
      classificacao: String(classificacao),
      data: String(dataFinal),
      status: String(status),
      obs: obs.trim() || null,
      conta_id: contaId || null,
      ...(recorrenciaIdParaVincular ? { recorrencia_id: recorrenciaIdParaVincular } : {}),
      ...(recorrenciaAnoMes ? { recorrencia_ano_mes: recorrenciaAnoMes } : {}),
      ...(transaction && transaction.id ? { id: String(transaction.id) } : {}),
    });

    onClose();
  };

  const statusRealizado = tipo === 'entrada' ? 'recebido' : 'pago';
  const statusPendente = tipo === 'entrada' ? 'a_receber' : 'a_pagar';
  const statusUiKey =
    status === statusRealizado || status === 'recebido' || status === 'pago'
      ? 'realizado'
      : 'pendente';
  const tipoUiKey = tipo === 'entrada' ? 'entrada' : 'saida';

  const modalTitle =
    transaction && transaction.id
      ? 'Editar lançamento'
      : isDuplicateDraft
        ? 'Duplicar lançamento'
        : 'Novo lançamento';

  const modalSaveFooter = isDuplicateDraft ? (
    <View style={modalStyles.modalFooterRow}>
      <TouchableOpacity style={modalStyles.modalCancelOutline} onPress={onClose}>
        <Text style={modalStyles.modalCancelOutlineText}>Cancelar</Text>
      </TouchableOpacity>
      <TouchableOpacity style={modalStyles.saveButtonPrimaryFlex} onPress={handleSave}>
        <Text style={modalStyles.saveButtonText}>Salvar</Text>
      </TouchableOpacity>
    </View>
  ) : (
    <TouchableOpacity style={modalStyles.saveButton} onPress={handleSave} accessibilityLabel="Salvar lançamento">
      <Text style={modalStyles.saveButtonText}>Salvar lançamento</Text>
    </TouchableOpacity>
  );

  const modalFormFields = (
    <>
              <View style={modalStyles.inputGroup}>
                <Text style={modalStyles.label}>Tipo</Text>
                <MfSegmented
                  options={[
                    { key: 'entrada', label: 'Entrada', tone: 'income' },
                    { key: 'saida', label: 'Saída', tone: 'expense' },
                  ]}
                  value={tipoUiKey}
                  onChange={(k) => setTipo(k === 'entrada' ? 'entrada' : 'saída')}
                />
              </View>

              <View style={modalStyles.inputGroup}>
                <Text style={modalStyles.label}>Valor</Text>
                <TextInput
                  style={[modalStyles.fieldSurface, modalStyles.fieldInput]}
                  placeholder="R$ 0,00"
                  placeholderTextColor={theme.placeholder}
                  value={valor}
                  onChangeText={(t: string) => setValor(formatCurrencyInput(t))}
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={modalStyles.inputGroup}>
                <Text style={modalStyles.label}>Categoria</Text>
              <TouchableOpacity
                style={[modalStyles.fieldSurface, modalStyles.fieldTouch]}
                onPress={() => setCategoriaDropdownVisible(true)}
              >
                <Text style={[modalStyles.categoriaText, !classificacao && modalStyles.categoriaPlaceholder]}>
                  {classificacao || 'Selecione uma categoria'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Modal de seleção de categorias */}
            <Modal
              visible={categoriaDropdownVisible}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setCategoriaDropdownVisible(false)}
            >
              <TouchableOpacity
                style={modalStyles.dropdownOverlay}
                activeOpacity={1}
                onPress={() => setCategoriaDropdownVisible(false)}
              >
                <View style={modalStyles.dropdownContainer} onStartShouldSetResponder={() => true}>
                  <View style={modalStyles.dropdownHeader}>
                    <Text style={modalStyles.dropdownTitle}>Selecione uma categoria</Text>
                    <TouchableOpacity onPress={() => setCategoriaDropdownVisible(false)}>
                      <Ionicons name="close" size={24} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <ScrollView style={modalStyles.dropdownList}>
                    {categoriasFiltradas.length === 0 ? (
                      <View style={modalStyles.dropdownEmpty}>
                        <Text style={modalStyles.dropdownEmptyText}>
                          Nenhuma categoria disponível para {tipo === 'entrada' ? 'entrada' : 'saída'}
                        </Text>
                      </View>
                    ) : (
                      categoriasFiltradas.map((categoria) => (
                        <TouchableOpacity
                          key={categoria.id}
                          style={[
                            modalStyles.dropdownItem,
                            classificacao === categoria.nome && modalStyles.dropdownItemSelected,
                          ]}
                          onPress={() => {
                            setClassificacao(categoria.nome);
                            setCategoriaDropdownVisible(false);
                          }}
                        >
                          <Text
                            style={[
                              modalStyles.dropdownItemText,
                              classificacao === categoria.nome && modalStyles.dropdownItemTextSelected,
                            ]}
                          >
                            {categoria.nome}
                          </Text>
                          {classificacao === categoria.nome && (
                            <Ionicons name="checkmark" size={20} color={theme.primary} />
                          )}
                        </TouchableOpacity>
                      ))
                    )}
                  </ScrollView>
                </View>
              </TouchableOpacity>
            </Modal>

            <ContaPickerField
              theme={theme}
              contas={contasAtivas}
              value={contaId}
              onChange={setContaId}
            />

            <View style={modalStyles.inputGroup}>
              <Text style={modalStyles.label}>Data</Text>
              <View style={[modalStyles.fieldSurface, modalStyles.fieldTouch, modalStyles.dateInputContainer]}>
                {modalDataWeekdayAbbr ? (
                  <Text style={modalStyles.dateWeekdayPrefix}>{modalDataWeekdayAbbr}</Text>
                ) : null}
                <TextInput
                  style={modalStyles.dateInput}
                  placeholder="dd/mm/aaaa"
                  placeholderTextColor={theme.placeholder}
                  value={dataFormatada}
                  selection={modalDataDateSelection}
                  onSelectionChange={(e) => {
                    modalDataDateSelectionRef.current = e.nativeEvent.selection;
                  }}
                  onChangeText={(text) => {
                    const prev = modalDataFormatadaRef.current;
                    const caret = modalDataDateSelectionRef.current.start;
                    const { formatted: cleaned, caret: nextCaret } = computeBrDateInputUpdate(
                      prev,
                      text,
                      caret
                    );
                    setDataFormatada(cleaned);
                    modalDataFormatadaRef.current = cleaned;
                    modalDataDateSelectionRef.current = { start: nextCaret, end: nextCaret };
                    setModalDataDateSelection({ start: nextCaret, end: nextCaret });
                    setTimeout(() => setModalDataDateSelection(undefined), 0);
                    if (cleaned.length === 10) {
                      const parsedDate = parseDateFromBR(cleaned);
                      if (parsedDate) {
                        setData(parsedDate);
                      }
                    } else {
                      setData('');
                    }
                  }}
                  maxLength={10}
                  keyboardType="numeric"
                />
                <TouchableOpacity
                  style={modalStyles.calendarIconButton}
                  onPress={() => setCalendarVisible(true)}
                >
                  <Ionicons name="calendar-outline" size={20} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={modalStyles.inputGroup}>
              <Text style={modalStyles.label}>Status</Text>
              <MfSegmented
                options={[
                  {
                    key: 'realizado',
                    label: tipo === 'entrada' ? 'Recebido' : 'Pago',
                    tone: 'income',
                  },
                  {
                    key: 'pendente',
                    label: tipo === 'entrada' ? 'A receber' : 'A pagar',
                    tone: 'pending',
                  },
                ]}
                value={statusUiKey}
                onChange={(k) => setStatus(k === 'realizado' ? statusRealizado : statusPendente)}
              />
            </View>

            <View style={modalStyles.inputGroup}>
              <TouchableOpacity
                style={[modalStyles.recurrenceRow, recorrente && modalStyles.recurrenceRowOn]}
                onPress={() => {
                  if (vinculadaARecorrencia) return;
                  setRecorrente((prev) => !prev);
                }}
                activeOpacity={vinculadaARecorrencia ? 1 : 0.8}
                accessibilityRole="switch"
                accessibilityState={{ checked: recorrente, disabled: vinculadaARecorrencia }}
                accessibilityLabel="Repetir esta transação todo mês"
              >
                <View style={modalStyles.recurrenceToggleLeft}>
                  <View style={[modalStyles.recurrenceIconWrap, recorrente && modalStyles.recurrenceIconWrapOn]}>
                    <Ionicons name="repeat" size={18} color={recorrente ? theme.primary : theme.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={modalStyles.recurrenceToggleTitle}>
                      {vinculadaARecorrencia ? 'Faz parte de uma recorrência' : 'Repetir todo mês'}
                    </Text>
                    <Text style={modalStyles.recurrenceToggleHint}>
                      {vinculadaARecorrencia
                        ? 'Você pode ajustar a duração abaixo (afeta toda a recorrência).'
                        : recorrente
                          ? `Será lançada todo dia ${Number((data || '').slice(8, 10)) || new Date().getDate()} do mês`
                          : isEditing
                            ? 'Ative para criar uma recorrência mensal desta transação'
                            : 'Crie uma recorrência mensal a partir desta transação'}
                    </Text>
                  </View>
                </View>
                <View
                  style={[
                    modalStyles.recurrenceCheckbox,
                    recorrente && modalStyles.recurrenceCheckboxOn,
                  ]}
                >
                  {recorrente ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
                </View>
              </TouchableOpacity>

              {recorrente && (
                <View style={modalStyles.recurrenceDurationBox}>
                  <Text style={modalStyles.recurrenceDurationLabel}>
                    {vinculadaARecorrencia ? 'Duração da recorrência:' : 'Termina em:'}
                  </Text>
                  {vinculadaARecorrencia && (
                    <Text style={modalStyles.recurrenceHintInline}>
                      Mudar aqui afeta TODOS os meses dessa recorrência.
                    </Text>
                  )}
                  <View style={modalStyles.recurrencePillsRow}>
                    {[
                      { label: 'Indefinido', value: null as number | null, custom: false },
                      { label: '3 meses', value: 3, custom: false },
                      { label: '6 meses', value: 6, custom: false },
                      { label: '12 meses', value: 12, custom: false },
                      { label: 'Personalizar', value: null as number | null, custom: true },
                    ].map((opt) => {
                      const isActive = opt.custom
                        ? isCustomMode
                        : !isCustomMode && maxOcorrencias === opt.value;
                      return (
                        <TouchableOpacity
                          key={opt.label}
                          style={[modalStyles.recurrencePill, isActive && modalStyles.recurrencePillActive]}
                          onPress={() => {
                            if (opt.custom) {
                              setIsCustomMode(true);
                              setMaxOcorrencias(null);
                            } else {
                              setIsCustomMode(false);
                              setMaxOcorrencias(opt.value);
                              setCustomMesesInput('');
                            }
                          }}
                          activeOpacity={0.75}
                        >
                          <Text
                            style={[
                              modalStyles.recurrencePillText,
                              isActive && modalStyles.recurrencePillTextActive,
                            ]}
                          >
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {isCustomMode && (
                    <View style={modalStyles.recurrenceCustomRow}>
                      <Text style={modalStyles.recurrenceCustomLabel}>Por</Text>
                      <TextInput
                        style={modalStyles.recurrenceCustomInput}
                        placeholder="Ex: 24"
                        placeholderTextColor={theme.placeholder}
                        value={customMesesInput}
                        onChangeText={(text) => {
                          const digits = text.replace(/\D/g, '').slice(0, 4);
                          setCustomMesesInput(digits);
                        }}
                        keyboardType="numeric"
                        maxLength={4}
                      />
                      <Text style={modalStyles.recurrenceCustomLabel}>meses</Text>
                    </View>
                  )}

                  {(() => {
                    const effective = isCustomMode
                      ? (parseInt(customMesesInput, 10) || 0)
                      : (maxOcorrencias || 0);
                    if (effective < 1) {
                      return (
                        <Text style={modalStyles.recurrenceSummary}>
                          ✓ Sem data limite — repete todo mês até você desativar
                        </Text>
                      );
                    }
                    const baseDay = Number((data || '').slice(8, 10)) || new Date().getDate();
                    const baseMonth = Number((data || '').slice(5, 7)) || (new Date().getMonth() + 1);
                    const baseYear = Number((data || '').slice(0, 4)) || new Date().getFullYear();
                    // Última repetição = base + (effective - 1) meses
                    const lastDate = new Date(baseYear, baseMonth - 1 + (effective - 1), baseDay);
                    const lastLabel = lastDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                    return (
                      <Text style={modalStyles.recurrenceSummary}>
                        ✓ Última repetição em {lastLabel} ({effective}x)
                      </Text>
                    );
                  })()}

                  {(() => {
                    // Aviso de inflação quando a duração ultrapassa 12 meses (ou é indefinida).
                    const effective = isCustomMode
                      ? (parseInt(customMesesInput, 10) || 0)
                      : (maxOcorrencias || 0);
                    const isLongTerm = effective === 0 || effective > 12;
                    if (!isLongTerm) return null;
                    return (
                      <View style={modalStyles.inflationNote}>
                        <Ionicons name="information-circle-outline" size={16} color={theme.warning} />
                        <Text style={modalStyles.inflationNoteText}>
                          Este valor não considera inflação. Em anos futuros, o preço real pode ser diferente — você pode editar a recorrência quando isso acontecer.
                        </Text>
                      </View>
                    );
                  })()}
                </View>
              )}
            </View>

            <View style={modalStyles.inputGroup}>
              <Text style={modalStyles.label}>Observação</Text>
              <TextInput
                style={[modalStyles.fieldSurface, modalStyles.fieldInput, modalStyles.textArea]}
                placeholder="Ex: Mercado da semana (opcional)"
                placeholderTextColor={theme.placeholder}
                value={obs}
                onChangeText={(text) => {
                  if (text.length <= 500) {
                    setObs(text);
                  }
                }}
                multiline
                numberOfLines={4}
                maxLength={500}
                textAlignVertical="top"
              />
              <Text style={modalStyles.characterCount}>{obs.length}/500</Text>
            </View>
    </>
  );

  const modalBody = (
      <SafeAreaView
        style={[modalStyles.modalContainer, useDialogLayout && modalStyles.dialogSafeArea]}
        edges={useDialogLayout ? [] : ['top', 'bottom']}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <View style={[modalStyles.modalContent, useDialogLayout && modalStyles.dialogContent]}>
            {useDialogLayout ? (
              <View style={modalStyles.dialogHeader}>
                <Text style={modalStyles.dialogTitle}>{modalTitle}</Text>
                <TouchableOpacity
                  onPress={onClose}
                  style={modalStyles.dialogCloseBtn}
                  accessibilityLabel="Fechar"
                >
                  <Ionicons name="close" size={22} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[modalStyles.modalHeader, { paddingTop: Math.max(insets.top, 16) }]}>
                <TouchableOpacity onPress={onClose} style={modalStyles.closeButton}>
                  <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <View style={modalStyles.titleContainer}>
                  <Text style={modalStyles.modalTitle}>{modalTitle}</Text>
                </View>
                <View style={modalStyles.closeButton} />
              </View>
            )}

            <ScrollView
              style={[modalStyles.modalBody, useDialogLayout && modalStyles.dialogScroll]}
              contentContainerStyle={[
                modalStyles.modalBodyContent,
                useDialogLayout && modalStyles.dialogBodyContent,
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={!useDialogLayout}
              nestedScrollEnabled
              {...(Platform.OS === 'web' ? { className: WEB_SCROLL_Y_CLASS } : {})}
            >
              {modalFormFields}
              {!useDialogLayout ? modalSaveFooter : null}
            </ScrollView>
            {useDialogLayout ? <View style={modalStyles.dialogFooter}>{modalSaveFooter}</View> : null}
          </View>
        </KeyboardAvoidingView>
        {calendarVisible ? (
          <View
            style={[StyleSheet.absoluteFillObject, { zIndex: 1000, elevation: 24 }]}
            pointerEvents="box-none"
          >
            <Pressable
              style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}
              onPress={() => setCalendarVisible(false)}
            />
            <View
              style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
                paddingHorizontal: 16,
              }}
              pointerEvents="box-none"
            >
              <View style={modalStyles.calendarContainer} onStartShouldSetResponder={() => true}>
                <View style={modalStyles.calendarHeader}>
                  <Text style={modalStyles.calendarTitle}>Selecione a Data</Text>
                  <TouchableOpacity onPress={() => setCalendarVisible(false)}>
                    <Ionicons name="close" size={24} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>
                <Calendar
                  current={
                    data && /^\d{4}-\d{2}-\d{2}$/.test(String(data))
                      ? String(data)
                      : new Date().toISOString().split('T')[0]
                  }
                  onDayPress={(day: DateData) => {
                    const selectedDate = day.dateString;
                    setData(selectedDate);
                    setDataFormatada(formatDateToBR(selectedDate));
                    setCalendarVisible(false);
                  }}
                  markedDates={
                    (() => {
                      const d =
                        data && /^\d{4}-\d{2}-\d{2}$/.test(String(data)) ? String(data).slice(0, 10) : null;
                      return d
                        ? {
                            [d]: {
                              selected: true,
                              selectedColor: theme.primary,
                              selectedTextColor: '#FFFFFF',
                            },
                          }
                        : {};
                    })()
                  }
                  theme={{
                    backgroundColor: theme.surface,
                    calendarBackground: theme.surface,
                    textSectionTitleColor: theme.textSecondary,
                    selectedDayBackgroundColor: theme.primary,
                    selectedDayTextColor: '#FFFFFF',
                    todayTextColor: theme.primary,
                    dayTextColor: theme.text,
                    textDisabledColor: theme.textTertiary,
                    arrowColor: theme.primary,
                    monthTextColor: theme.text,
                    textDayFontWeight: '600',
                    textMonthFontWeight: 'bold',
                    textDayHeaderFontWeight: '600',
                    textDayFontSize: 16,
                    textMonthFontSize: 18,
                    textDayHeaderFontSize: 13,
                  }}
                  enableSwipeMonths={true}
                  firstDay={0}
                />
                <View style={modalStyles.calendarFooter}>
                  <TouchableOpacity
                    style={modalStyles.calendarButton}
                    onPress={() => {
                      const today = new Date().toISOString().split('T')[0];
                      setDataFormatada(formatDateToBR(today));
                      setData(today);
                    }}
                  >
                    <Text style={modalStyles.calendarButtonText}>Hoje</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[modalStyles.calendarButton, modalStyles.calendarButtonClear]}
                    onPress={() => {
                      setDataFormatada('');
                      setData('');
                    }}
                  >
                    <Text style={[modalStyles.calendarButtonText, modalStyles.calendarButtonTextClear]}>
                      Limpar
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        ) : null}
      </SafeAreaView>
  );

  return (
    <Modal
      visible={visible}
      animationType={useDialogLayout ? 'fade' : 'slide'}
      presentationStyle={useDialogLayout ? undefined : 'fullScreen'}
      transparent={useDialogLayout}
      onRequestClose={onClose}
    >
      {useDialogLayout ? (
        <View style={modalStyles.dialogOverlay}>
          <Pressable
            style={modalStyles.dialogBackdrop}
            onPress={handleBackdropClose}
            accessibilityLabel="Fechar"
          />
          <View style={modalStyles.dialogCard} pointerEvents="box-none">
            <View
              style={modalStyles.dialogCardInner}
              pointerEvents="auto"
              onStartShouldSetResponder={() => {
                markDialogInteraction();
                return false;
              }}
              {...(Platform.OS === 'web'
                ? ({ onPointerDownCapture: markDialogInteraction } as object)
                : { onTouchStart: markDialogInteraction })}
            >
              {modalBody}
            </View>
          </View>
        </View>
      ) : (
        modalBody
      )}
    </Modal>
  );
}

// --- Componentes auxiliares (Fase 1 redesign) ---

function formatYmdToBrShort(ymd: string): string {
  const m = String(ymd || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function ListPanelWrap({
  isDesktop,
  showPanelHeader,
  shellPanelStyle,
  legacyPanelStyle,
  children,
  bare = false,
}: {
  isDesktop: boolean;
  showPanelHeader: boolean;
  shellPanelStyle: object;
  legacyPanelStyle: object;
  children: React.ReactNode;
  bare?: boolean;
}) {
  const { isDarkMode } = useMfTheme();
  const listChrome = useMemo(() => mfTechPanelChrome(isDarkMode, 'surface'), [isDarkMode]);

  if (bare) {
    return (
      <View style={[shellPanelStyle, { flex: 1, minHeight: 0 }]}>
        {children}
      </View>
    );
  }

  if (isDesktop && showPanelHeader) {
    return (
      <View style={[shellPanelStyle, listChrome, { padding: mfSpacing.md }]}>
        <View style={{ flex: 1, minHeight: 0 }}>{children}</View>
      </View>
    );
  }
  return <View style={legacyPanelStyle}>{children}</View>;
}

function FilterGroup({
  label,
  children,
  styles,
}: {
  label: string;
  children: React.ReactNode;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.filterGroup}>
      {label ? <Text style={styles.filterGroupLabel}>{label}</Text> : null}
      {children}
    </View>
  );
}

/** Pills de filtro por conta bancária (só quando há contas cadastradas). */
function ContaFilterPillsRow({
  contasAtivas,
  contaFilter,
  onChange,
  styles,
  theme,
  combinedRow = false,
}: {
  contasAtivas: import('../lib/contaFinanceiraTypes').ContaFinanceira[];
  contaFilter: ContaFilterValue;
  onChange: (v: ContaFilterValue) => void;
  styles: ReturnType<typeof createStyles>;
  theme: ReturnType<typeof getTheme>;
  /** Uma única linha horizontal com tipo/status (shell desktop). */
  combinedRow?: boolean;
}) {
  if (contasAtivas.length === 0) return null;

  const options: { key: ContaFilterValue; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'all', label: 'Todas contas', icon: 'wallet-outline' },
    ...contasAtivas.map((c) => ({
      key: c.id as ContaFilterValue,
      label: c.nome,
      icon: 'card-outline' as const,
    })),
    { key: 'unassigned', label: 'Meu financeiro', icon: 'wallet-outline' },
  ];

  const pills = options.map((opt) => {
    const active = contaFilter === opt.key;
    const pillStyle = active
      ? { box: styles.pillActive, label: styles.pillTextActive, icon: theme.primary }
      : { box: undefined as object | undefined, label: undefined as object | undefined, icon: theme.textSecondary };
    return (
      <TouchableOpacity
        key={`conta-${opt.key}`}
        onPress={() => onChange(opt.key)}
        style={[styles.pill, pillStyle.box]}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
      >
        <Ionicons name={opt.icon} size={13} color={pillStyle.icon} />
        <Text style={[styles.pillText, pillStyle.label]} numberOfLines={1}>
          {opt.label}
        </Text>
      </TouchableOpacity>
    );
  });

  if (combinedRow) {
    return (
      <>
        <View style={styles.filterPillDivider} />
        {pills}
      </>
    );
  }

  return (
    <FilterGroup label="Conta" styles={styles}>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={styles.pillsScrollView}
        contentContainerStyle={styles.pillsRowContent}
        {...(Platform.OS === 'web' ? { className: WEB_HIDE_X_SCROLL_CLASS } : {})}
      >
        {pills}
      </ScrollView>
    </FilterGroup>
  );
}

/** Formulário inline para criar/editar transações no layout dois painéis (desktop). */
function InlineTransactionForm({
  theme,
  userId,
  editingTransaction,
  onCreated,
  onUpdated,
  onCancelEdit,
  embeddedInPanel = false,
  contasAtivas = [],
  defaultContaId = null,
}: {
  theme: ReturnType<typeof getTheme>;
  userId: string | null;
  editingTransaction: any | null;
  onCreated: () => void;
  onUpdated: () => void;
  onCancelEdit: () => void;
  /** Título fica no painel pai (MfContentPanel). */
  embeddedInPanel?: boolean;
  contasAtivas?: import('../lib/contaFinanceiraTypes').ContaFinanceira[];
  defaultContaId?: string | null;
}) {
  const { addTransaction, updateTransaction } = useTransactionStore();
  const { addRecorrencia, updateRecorrencia, recorrencias: storeRecorrencias } = useRecorrenciaStore();
  const useCompactFields = true;
  const styles = useMemo(
    () => createInlineFormStyles(theme, embeddedInPanel),
    [theme, embeddedInPanel],
  );
  const isEditing = Boolean(editingTransaction?.id);
  const isDuplicateDraft = Boolean(editingTransaction?._draftDuplicate);
  const vinculadaARecorrencia = Boolean(editingTransaction?.recorrencia_id);

  const [tipo, setTipo] = useState<'entrada' | 'saida'>('saida');
  const [valor, setValor] = useState('');
  const [classificacao, setClassificacao] = useState('');
  const [data, setData] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<'pago' | 'a_pagar'>('pago');
  const [obs, setObs] = useState('');
  const [recorrente, setRecorrente] = useState(false);
  const [maxOcorrencias, setMaxOcorrencias] = useState<number | null>(null);
  const [initialMaxOcorrencias, setInitialMaxOcorrencias] = useState<number | null>(null);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customMesesInput, setCustomMesesInput] = useState('');
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaDropdownVisible, setCategoriaDropdownVisible] = useState(false);
  const [contaId, setContaId] = useState<string | null>(null);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dataFormatada, setDataFormatada] = useState(() => {
    const iso = new Date().toISOString().split('T')[0];
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  });
  const inlineDataDateSelectionRef = useRef({ start: 0, end: 0 });
  const [inlineDataDateSelection, setInlineDataDateSelection] = useState<
    { start: number; end: number } | undefined
  >(undefined);
  const inlineDataFormatadaRef = useRef('');
  inlineDataFormatadaRef.current = dataFormatada;

  /**
   * Calcula o número da ocorrência (1-based) de uma data dentro de uma recorrência.
   * Ex: rec criada em jan/2026, data abr/2026 → 4ª ocorrência.
   * Usado para traduzir entre "duração relativa" (UX) e "max absoluto" (banco).
   */
  const occurrenceAtDate = (criadoEm: string, dataIso: string): number => {
    if (!criadoEm || !dataIso) return 1;
    const [cy, cm] = criadoEm.slice(0, 7).split('-').map(Number);
    const [dy, dm] = dataIso.slice(0, 7).split('-').map(Number);
    return Math.max(1, (dy - cy) * 12 + (dm - cm) + 1);
  };

  const toIsoFromRaw = (raw: string): string => {
    const m = String(raw || '').trim().match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : '';
  };

  // Ocorrência atual quando estamos editando uma vinculada — usado para mapear
  // "Mais 3 meses" → max_ocorrencias absoluto correto.
  const currentOccurrence = useMemo(() => {
    if (!vinculadaARecorrencia || !editingTransaction?.recorrencia_id) return 1;
    const tpl = storeRecorrencias.find((r) => r.id === editingTransaction.recorrencia_id);
    if (!tpl?.criado_em) return 1;
    return occurrenceAtDate(tpl.criado_em, editingTransaction.data || data);
  }, [vinculadaARecorrencia, editingTransaction?.recorrencia_id, editingTransaction?.data, storeRecorrencias, data]);

  // Função de reset compartilhada (após criar ou cancelar edição)
  const resetForm = () => {
    setTipo('saida');
    setValor('');
    setClassificacao('');
    const today = new Date().toISOString().split('T')[0];
    setData(today);
    const [ty, tm, td] = today.split('-');
    setDataFormatada(`${td}/${tm}/${ty}`);
    setStatus('pago');
    setObs('');
    setRecorrente(false);
    setMaxOcorrencias(null);
    setInitialMaxOcorrencias(null);
    setIsCustomMode(false);
    setCustomMesesInput('');
    setCategoriaDropdownVisible(false);
    setContaId(defaultContaId || null);
    setCalendarVisible(false);
  };

  // Popular form quando entra em modo de edição.
  useEffect(() => {
    if (!editingTransaction) {
      resetForm();
      return;
    }
    const t = editingTransaction;
    const tipoNorm = String(t.tipo || '').toLowerCase() === 'entrada' ? 'entrada' : 'saida';
    setTipo(tipoNorm);
    if (t.valor != null) {
      const numVal = typeof t.valor === 'number' ? t.valor : parseFloat(String(t.valor));
      if (!isNaN(numVal)) {
        setValor(
          `R$ ${numVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        );
      }
    } else {
      setValor('');
    }
    setClassificacao(String(t.classificacao || ''));
    const rawD = t.data ? String(t.data) : '';
    const isoD = toIsoFromRaw(rawD) || new Date().toISOString().split('T')[0];
    setData(isoD);
    const [dy, dm, dd] = isoD.split('-');
    setDataFormatada(`${dd}/${dm}/${dy}`);
    const s = String(t.status || '').toLowerCase();
    setStatus(s === 'a_pagar' || s === 'a_receber' ? 'a_pagar' : 'pago');
    setObs(String(t.obs || ''));
    setContaId(t.conta_id ? String(t.conta_id) : defaultContaId || null);
    if (t.recorrencia_id) {
      setRecorrente(true);
      const tpl = storeRecorrencias.find((r) => r.id === t.recorrencia_id);
      const absMax = tpl?.max_ocorrencias ?? null;
      setInitialMaxOcorrencias(absMax);
      // Converte max absoluto → "meses restantes a partir desta ocorrência" para a UI.
      if (absMax == null || !tpl?.criado_em) {
        setMaxOcorrencias(null);
        setIsCustomMode(false);
        setCustomMesesInput('');
      } else {
        const occ = occurrenceAtDate(tpl.criado_em, t.data || data);
        const remaining = absMax - occ + 1;
        if (remaining <= 0) {
          // Recorrência já passou do limite — apresenta como "indefinido" para edição.
          setMaxOcorrencias(null);
          setIsCustomMode(false);
          setCustomMesesInput('');
        } else if ([3, 6, 12].includes(remaining)) {
          setMaxOcorrencias(remaining);
          setIsCustomMode(false);
          setCustomMesesInput('');
        } else {
          setIsCustomMode(true);
          setMaxOcorrencias(null);
          setCustomMesesInput(String(remaining));
        }
      }
    } else {
      setRecorrente(false);
      setMaxOcorrencias(null);
      setInitialMaxOcorrencias(null);
      setIsCustomMode(false);
      setCustomMesesInput('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingTransaction]);

  // Carregar categorias
  useEffect(() => {
    if (!userId) return;
    void fetchUserCategories(userId)
      .then((rows) => {
        setCategorias(
          (rows || []).map((cat) => ({
            id: Number(cat.id) || 0,
            nome: String(cat.nome || ''),
            tipo: String(cat.tipo || ''),
          })),
        );
      })
      .catch(() => setCategorias([]));
  }, [userId]);

  const categoriasFiltradas = categorias.filter((cat) => {
    const ct = String(cat.tipo || '').toLowerCase();
    const ctNorm = ct === 'saída' ? 'saida' : ct;
    return ctNorm === tipo;
  });

  const formatBRDate = (iso: string) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  const parseBRDateToIso = (br: string): string => {
    if (!br || br.length < 10) return '';
    const cleaned = br.replace(/[^\d/]/g, '');
    const parts = cleaned.split('/');
    if (parts.length !== 3 || String(parts[2]).length !== 4) return '';
    const day = String(parts[0]).padStart(2, '0');
    const month = String(parts[1]).padStart(2, '0');
    const year = String(parts[2]);
    const iso = `${year}-${month}-${day}`;
    const dt = new Date(`${iso}T00:00:00`);
    return Number.isNaN(dt.getTime()) ? '' : iso;
  };

  const inlineDataWeekdayAbbr = useMemo(() => {
    let iso = '';
    if (data && /^\d{4}-\d{2}-\d{2}$/.test(String(data))) iso = String(data);
    if (!iso && dataFormatada.length === 10) iso = parseBRDateToIso(dataFormatada);
    return iso ? weekdayAbbrFromYmd(iso) : '';
  }, [data, dataFormatada]);

  const modalPickStyles = useMemo(() => createModalStyles(theme), [theme]);

  const handleSubmit = async () => {
    if (submitting) return;
    if (!classificacao.trim()) {
      Alert.alert('Atenção', 'Selecione uma categoria.');
      return;
    }
    const cleaned = valor.replace(/[R$\s.]/g, '').replace(',', '.');
    const valorNum = parseFloat(cleaned);
    if (isNaN(valorNum) || valorNum <= 0) {
      Alert.alert('Atenção', 'Informe um valor válido.');
      return;
    }
    setSubmitting(true);
    try {
      let dataIso = '';
      if (dataFormatada && dataFormatada.length === 10) {
        dataIso = parseBRDateToIso(dataFormatada);
      }
      if (!dataIso && data) {
        dataIso = toIsoFromRaw(String(data));
      }
      if (!dataIso || !/^\d{4}-\d{2}-\d{2}$/.test(dataIso)) {
        Alert.alert('Atenção', 'Informe uma data válida (dd/mm/aaaa).');
        setSubmitting(false);
        return;
      }

      const finalStatus = tipo === 'entrada' ? (status === 'pago' ? 'recebido' : 'a_receber') : status;

      // "Meses restantes" escolhido pelo usuário (UI-relative, a partir deste mês).
      const mesesRelativos: number | null = (() => {
        if (!isCustomMode) return maxOcorrencias;
        const n = parseInt(customMesesInput, 10);
        return Number.isInteger(n) && n >= 1 && n <= 1200 ? n : null;
      })();

      // Para vinculadas em edição: traduz "mais N meses" → max absoluto.
      // Para novas: mesesRelativos JÁ é o max absoluto (recorrência começa do zero).
      const absMaxParaSalvar: number | null = (() => {
        if (mesesRelativos == null) return null;
        if (vinculadaARecorrencia && currentOccurrence > 0) {
          return currentOccurrence + mesesRelativos - 1;
        }
        return mesesRelativos;
      })();

      if (isEditing && editingTransaction?.id) {
        // Modo edição: atualiza a transação existente.
        // Se for vinculada a recorrência e a duração mudou, propaga para o template.
        if (vinculadaARecorrencia && editingTransaction.recorrencia_id && absMaxParaSalvar !== initialMaxOcorrencias) {
          try {
            await updateRecorrencia(editingTransaction.recorrencia_id, {
              max_ocorrencias: absMaxParaSalvar,
            });
          } catch (err) {
            console.error('Falha ao atualizar duração da recorrência:', err);
          }
        }
        await updateTransaction(String(editingTransaction.id), {
          tipo,
          valor: valorNum,
          classificacao: classificacao.trim(),
          data: dataIso,
          status: finalStatus,
          obs: obs.trim() || null,
          conta_id: contaId || null,
        } as any);
        onUpdated();
        return;
      }

      // Modo criação
      let recorrenciaId: string | null = null;
      let recorrenciaAnoMes: string | null = null;
      if (recorrente) {
        const dia = Number(dataIso.slice(8, 10)) || new Date().getDate();
        const created = await addRecorrencia({
          tipo,
          valor: valorNum,
          classificacao: classificacao.trim(),
          status: finalStatus,
          obs: obs.trim() || null,
          dia_do_mes: Math.min(Math.max(dia, 1), 31),
          ativo: true,
          max_ocorrencias: absMaxParaSalvar,
        });
        if (created?.id) {
          recorrenciaId = created.id;
          recorrenciaAnoMes = dataIso.slice(0, 7);
        }
      }
      await addTransaction({
        tipo,
        valor: valorNum,
        classificacao: classificacao.trim(),
        data: dataIso,
        status: finalStatus,
        obs: obs.trim() || null,
        conta_id: contaId || null,
        ...(recorrenciaId ? { recorrencia_id: recorrenciaId } : {}),
        ...(recorrenciaAnoMes ? { recorrencia_ano_mes: recorrenciaAnoMes } : {}),
      } as any);
      resetForm();
      if (isDuplicateDraft) {
        onCancelEdit();
      }
      onCreated();
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Falha ao salvar transação.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <View style={[styles.container, (isEditing || isDuplicateDraft) && styles.containerEditing]}>
      {!embeddedInPanel ? (
        <View style={styles.headerRow}>
          <View style={styles.headerTitleBlock}>
            <Text style={styles.title}>
              {isDuplicateDraft ? 'Duplicar lançamento' : isEditing ? 'Editar lançamento' : 'Novo lançamento'}
            </Text>
            <View style={styles.headerDivider} />
          </View>
          {(isEditing || isDuplicateDraft) && (
            <TouchableOpacity
              onPress={() => {
                resetForm();
                onCancelEdit();
              }}
              style={styles.cancelEditButton}
              accessibilityLabel={isDuplicateDraft ? 'Cancelar duplicação' : 'Cancelar edição'}
            >
              <Ionicons name="close" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      ) : (isEditing || isDuplicateDraft) ? (
        <View style={styles.embeddedFormBar}>
          <Text style={styles.embeddedFormBarTitle}>
            {isDuplicateDraft ? 'Duplicar lançamento' : 'Editar lançamento'}
          </Text>
          <TouchableOpacity
            onPress={() => {
              resetForm();
              onCancelEdit();
            }}
            style={styles.cancelEditButton}
            accessibilityLabel={isDuplicateDraft ? 'Cancelar duplicação' : 'Cancelar edição'}
          >
            <Ionicons name="close" size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
      ) : null}
      {isEditing && (
        <Text style={styles.editingHint}>
          Você está editando uma transação. Cancele para voltar ao modo Novo lançamento.
        </Text>
      )}
      {isDuplicateDraft && !isEditing && (
        <Text style={styles.editingHint}>
          Ajuste os dados e salve para criar uma cópia, ou cancele para descartar.
        </Text>
      )}

      <View style={styles.segmentTrack}>
        <TouchableOpacity
          onPress={() => setTipo('entrada')}
          style={[styles.segmentOption, tipo === 'entrada' && styles.segmentOptionActiveIn]}
          accessibilityRole="button"
          accessibilityState={{ selected: tipo === 'entrada' }}
        >
          <Ionicons
            name="arrow-down-outline"
            size={14}
            color={tipo === 'entrada' ? theme.success : theme.textSecondary}
          />
          <Text
            style={[
              styles.segmentOptionText,
              tipo === 'entrada' && styles.segmentOptionTextActive,
            ]}
          >
            Entrada
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setTipo('saida')}
          style={[styles.segmentOption, tipo === 'saida' && styles.segmentOptionActiveOut]}
          accessibilityRole="button"
          accessibilityState={{ selected: tipo === 'saida' }}
        >
          <Ionicons
            name="arrow-up-outline"
            size={14}
            color={tipo === 'saida' ? theme.error : theme.textSecondary}
          />
          <Text
            style={[
              styles.segmentOptionText,
              tipo === 'saida' && styles.segmentOptionTextActiveOut,
            ]}
          >
            Saída
          </Text>
        </TouchableOpacity>
      </View>

      <View style={useCompactFields ? styles.fieldRow : undefined}>
        <View style={useCompactFields ? styles.fieldCol : undefined}>
          <Text style={styles.label}>Valor</Text>
          <TextInput
            style={styles.input}
            value={valor}
            onChangeText={(t: string) => setValor(formatCurrencyInput(t))}
            placeholder="R$ 0,00"
            placeholderTextColor={theme.placeholder}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={useCompactFields ? styles.fieldCol : undefined}>
          <Text style={styles.label}>Categoria</Text>
          <TouchableOpacity
            onPress={() => setCategoriaDropdownVisible((v) => !v)}
            style={[styles.input, styles.inputPicker]}
          >
            <Text
              style={[styles.inputPickerText, !classificacao && { color: theme.placeholder }]}
              numberOfLines={1}
            >
              {classificacao || 'Selecione...'}
            </Text>
            <Ionicons
              name={categoriaDropdownVisible ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>
      {categoriaDropdownVisible ? (
        <View style={styles.categoryListExpand}>
          {categoriasFiltradas.length === 0 ? (
            <Text style={styles.dropdownEmpty}>Nenhuma categoria. Cadastre em Configurações.</Text>
          ) : (
            categoriasFiltradas.map((cat, index) => {
              const selected = classificacao === cat.nome;
              const isLast = index === categoriasFiltradas.length - 1;
              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => {
                    setClassificacao(cat.nome);
                    setCategoriaDropdownVisible(false);
                  }}
                  style={[
                    styles.dropdownItem,
                    selected && styles.dropdownItemSelected,
                    isLast && styles.dropdownItemLast,
                  ]}
                >
                  <Text
                    style={[styles.dropdownItemText, selected && styles.dropdownItemTextSelected]}
                    numberOfLines={1}
                  >
                    {cat.nome}
                  </Text>
                  {selected ? (
                    <Ionicons name="checkmark" size={16} color={theme.primary} />
                  ) : null}
                </TouchableOpacity>
              );
            })
          )}
        </View>
      ) : null}

      <ContaPickerField
        theme={theme}
        contas={contasAtivas}
        value={contaId}
        onChange={setContaId}
      />

      <View style={useCompactFields ? styles.fieldRow : undefined}>
        <View style={useCompactFields ? styles.fieldColWide : undefined}>
          <Text style={styles.label}>Data</Text>
          <View style={styles.dateInputRow}>
            {inlineDataWeekdayAbbr ? (
              <Text style={styles.dateWeekdayPrefix}>{inlineDataWeekdayAbbr}</Text>
            ) : null}
            <TextInput
              style={[styles.input, styles.dateInputField]}
              value={dataFormatada}
              selection={inlineDataDateSelection}
              onSelectionChange={(e) => {
                inlineDataDateSelectionRef.current = e.nativeEvent.selection;
              }}
              onChangeText={(t: string) => {
                const prev = inlineDataFormatadaRef.current;
                const caret = inlineDataDateSelectionRef.current.start;
                const { formatted: cleaned, caret: nextCaret } = computeBrDateInputUpdate(prev, t, caret);
                setDataFormatada(cleaned);
                inlineDataFormatadaRef.current = cleaned;
                inlineDataDateSelectionRef.current = { start: nextCaret, end: nextCaret };
                setInlineDataDateSelection({ start: nextCaret, end: nextCaret });
                setTimeout(() => setInlineDataDateSelection(undefined), 0);
                if (cleaned.length === 10) {
                  const iso = parseBRDateToIso(cleaned);
                  if (iso) setData(iso);
                } else {
                  setData('');
                }
              }}
              placeholder="dd/mm/aaaa"
              placeholderTextColor={theme.placeholder}
              keyboardType="numeric"
              maxLength={10}
            />
            <TouchableOpacity
              style={styles.dateCalendarBtn}
              onPress={() => setCalendarVisible(true)}
              accessibilityLabel="Abrir calendário"
            >
              <Ionicons name="calendar-outline" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={useCompactFields ? styles.fieldCol : undefined}>
          <Text style={styles.label}>Status</Text>
          <View style={styles.segmentTrack}>
            <TouchableOpacity
              onPress={() => setStatus('pago')}
              style={[styles.segmentOption, status === 'pago' && styles.segmentOptionActiveSuccess]}
              accessibilityRole="button"
              accessibilityState={{ selected: status === 'pago' }}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={12}
                color={status === 'pago' ? theme.success : theme.textSecondary}
              />
              <Text
                style={[styles.segmentOptionText, status === 'pago' && styles.segmentOptionTextActive]}
                numberOfLines={1}
              >
                {tipo === 'entrada' ? 'Recebido' : 'Pago'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setStatus('a_pagar')}
              style={[styles.segmentOption, status === 'a_pagar' && styles.segmentOptionActiveWarning]}
              accessibilityRole="button"
              accessibilityState={{ selected: status === 'a_pagar' }}
            >
              <Ionicons
                name="time-outline"
                size={12}
                color={status === 'a_pagar' ? theme.warning : theme.textSecondary}
              />
              <Text
                style={[
                  styles.segmentOptionText,
                  status === 'a_pagar' && styles.segmentOptionTextOnWarning,
                ]}
                numberOfLines={1}
              >
                {tipo === 'entrada' ? 'A receber' : 'A pagar'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <Text style={styles.label}>Observação (opcional)</Text>
      <TextInput
        style={styles.inputObs}
        value={obs}
        onChangeText={setObs}
        placeholder="Ex: Mercado da semana"
        placeholderTextColor={theme.placeholder}
        numberOfLines={1}
      />

      {/* Recorrência */}
      <TouchableOpacity
        onPress={() => {
          if (vinculadaARecorrencia) return; // não permite destogglar em vinculada
          setRecorrente((v) => !v);
        }}
        activeOpacity={vinculadaARecorrencia ? 1 : 0.8}
        style={[styles.recurrenceRow, recorrente && styles.recurrenceRowActive]}
      >
        <Ionicons
          name="repeat"
          size={14}
          color={recorrente ? theme.primary : theme.textSecondary}
        />
        <Text style={[styles.recurrenceText, recorrente && { color: theme.primary }]}>
          {vinculadaARecorrencia ? 'Faz parte de uma recorrência' : 'Repetir todo mês'}
        </Text>
        <View style={[styles.checkbox, recorrente && styles.checkboxActive]}>
          {recorrente && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
        </View>
      </TouchableOpacity>
      {recorrente && (
        <View>
          {vinculadaARecorrencia ? (
            <Text style={styles.durationHint}>
              A duração vale a partir deste mês. Lançamentos anteriores não são afetados.
            </Text>
          ) : null}
          <View style={styles.durationRow}>
            {[
              { label: 'Indefinido', value: null as number | null, custom: false },
              { label: vinculadaARecorrencia ? 'Mais 3 meses' : '3 meses', value: 3, custom: false },
              { label: vinculadaARecorrencia ? 'Mais 6 meses' : '6 meses', value: 6, custom: false },
              { label: vinculadaARecorrencia ? 'Mais 12 meses' : '12 meses', value: 12, custom: false },
              { label: 'Personalizar', value: null as number | null, custom: true },
            ].map((opt) => {
              const active = opt.custom ? isCustomMode : !isCustomMode && maxOcorrencias === opt.value;
              return (
                <TouchableOpacity
                  key={opt.label}
                  onPress={() => {
                    if (opt.custom) {
                      setIsCustomMode(true);
                      setMaxOcorrencias(null);
                    } else {
                      setIsCustomMode(false);
                      setMaxOcorrencias(opt.value);
                      setCustomMesesInput('');
                    }
                  }}
                  style={[styles.durationPill, active && styles.durationPillActive]}
                >
                  <Text style={[styles.durationPillText, active && { color: theme.primary }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {isCustomMode && (
            <View style={styles.customMesesRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={customMesesInput}
                onChangeText={(t: string) => setCustomMesesInput(t.replace(/[^\d]/g, ''))}
                placeholder="Ex: 24"
                placeholderTextColor={theme.placeholder}
                keyboardType="number-pad"
                maxLength={4}
              />
              <Text style={styles.customMesesLabel}>meses</Text>
            </View>
          )}
        </View>
      )}

      {isDuplicateDraft ? (
        <View style={styles.submitActionsRow}>
          <TouchableOpacity
            onPress={() => {
              resetForm();
              onCancelEdit();
            }}
            disabled={submitting}
            style={[styles.submitCancelButton, submitting && { opacity: 0.6 }]}
          >
            <Text style={styles.submitCancelButtonText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            style={[styles.submitButtonFlex, submitting && { opacity: 0.6 }]}
          >
            <Ionicons
              name={submitting ? 'sync-outline' : 'checkmark'}
              size={18}
              color="#FFFFFF"
            />
            <Text style={styles.submitButtonText}>
              {submitting ? 'Salvando…' : 'Salvar'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting}
          style={[styles.submitButton, submitting && { opacity: 0.6 }]}
        >
          <Ionicons
            name={submitting ? 'sync-outline' : isEditing ? 'checkmark' : 'add-circle-outline'}
            size={18}
            color="#FFFFFF"
          />
          <Text style={styles.submitButtonText}>
            {submitting ? 'Salvando…' : isEditing ? 'Salvar alterações' : 'Adicionar lançamento'}
          </Text>
        </TouchableOpacity>
      )}
    </View>

      <Modal
        visible={calendarVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCalendarVisible(false)}
      >
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Pressable
            style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}
            onPress={() => setCalendarVisible(false)}
          />
          <View style={{ width: '100%', maxWidth: 400, paddingHorizontal: 16, zIndex: 1 }} pointerEvents="box-none">
            <View style={modalPickStyles.calendarContainer} onStartShouldSetResponder={() => true}>
              <View style={modalPickStyles.calendarHeader}>
                <Text style={modalPickStyles.calendarTitle}>Selecione a data</Text>
                <TouchableOpacity onPress={() => setCalendarVisible(false)}>
                  <Ionicons name="close" size={24} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
              <Calendar
                current={
                  data && /^\d{4}-\d{2}-\d{2}$/.test(String(data))
                    ? String(data)
                    : new Date().toISOString().split('T')[0]
                }
                onDayPress={(day: DateData) => {
                  const selectedDate = day.dateString;
                  setData(selectedDate);
                  setDataFormatada(formatBRDate(selectedDate));
                  setCalendarVisible(false);
                }}
                markedDates={
                  (() => {
                    const d =
                      data && /^\d{4}-\d{2}-\d{2}$/.test(String(data)) ? String(data).slice(0, 10) : null;
                    return d
                      ? {
                          [d]: {
                            selected: true,
                            selectedColor: theme.primary,
                            selectedTextColor: '#FFFFFF',
                          },
                        }
                      : {};
                  })()
                }
                theme={{
                  backgroundColor: theme.surface,
                  calendarBackground: theme.surface,
                  textSectionTitleColor: theme.textSecondary,
                  selectedDayBackgroundColor: theme.primary,
                  selectedDayTextColor: '#FFFFFF',
                  todayTextColor: theme.primary,
                  dayTextColor: theme.text,
                  textDisabledColor: theme.textTertiary,
                  arrowColor: theme.primary,
                  monthTextColor: theme.text,
                  textDayFontWeight: '600',
                  textMonthFontWeight: 'bold',
                  textDayHeaderFontWeight: '600',
                  textDayFontSize: 16,
                  textMonthFontSize: 18,
                  textDayHeaderFontSize: 13,
                }}
                enableSwipeMonths
                firstDay={0}
              />
              <View style={modalPickStyles.calendarFooter}>
                <TouchableOpacity
                  style={modalPickStyles.calendarButton}
                  onPress={() => {
                    const today = new Date().toISOString().split('T')[0];
                    setData(today);
                    setDataFormatada(formatBRDate(today));
                    setCalendarVisible(false);
                  }}
                >
                  <Text style={modalPickStyles.calendarButtonText}>Hoje</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[modalPickStyles.calendarButton, modalPickStyles.calendarButtonClear]}
                  onPress={() => {
                    setDataFormatada('');
                    setData('');
                  }}
                >
                  <Text style={[modalPickStyles.calendarButtonText, modalPickStyles.calendarButtonTextClear]}>
                    Limpar
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const createInlineFormStyles = (
  theme: ReturnType<typeof getTheme>,
  embeddedInPanel = false,
) => {
  const f = webUiFont();
  const fieldBg = theme.card;
  const softShadow =
    Platform.OS === 'web'
      ? ({ boxShadow: '0 1px 2px rgba(0,0,0,0.12)' } as object)
      : {
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 3,
          shadowOffset: { width: 0, height: 1 },
          elevation: 1,
        };
  return StyleSheet.create({
    container: {
      width: '100%',
      alignSelf: 'stretch',
      backgroundColor: 'transparent',
      borderRadius: 0,
      padding: 0,
      borderWidth: 0,
      gap: 0,
    },
    fieldRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    fieldCol: {
      flex: 1,
      minWidth: 0,
    },
    fieldColWide: {
      flex: 1.2,
      minWidth: 0,
    },
    containerEditing: {
      borderRadius: 10,
      padding: 8,
      borderWidth: 1,
      borderColor: theme.primary,
      backgroundColor: theme.primaryLight,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    headerTitleBlock: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      ...f,
      fontSize: 13,
      fontWeight: '700',
      color: theme.text,
      letterSpacing: 0.2,
    },
    headerDivider: {
      height: 2,
      width: 28,
      borderRadius: 999,
      backgroundColor: theme.primary,
      marginTop: 6,
      opacity: 0.85,
    },
    cancelEditButton: {
      width: 24,
      height: 24,
      borderRadius: 999,
      backgroundColor: theme.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    editingHint: {
      ...f,
      fontSize: 12,
      lineHeight: 16,
      color: theme.primary,
      fontStyle: 'italic',
      marginBottom: 4,
    },
    durationHint: {
      ...f,
      fontSize: 11,
      lineHeight: 15,
      fontStyle: 'italic',
      color: theme.warning,
      marginTop: 4,
      marginBottom: 2,
    },
    label: embeddedInPanel
      ? {
          ...f,
          fontSize: 12,
          fontWeight: '500',
          color: theme.textSecondary,
          marginTop: 8,
          marginBottom: 4,
        }
      : {
          ...f,
          fontSize: 10,
          fontWeight: '600',
          color: theme.textTertiary,
          letterSpacing: 0.55,
          textTransform: 'uppercase',
          marginTop: 5,
          marginBottom: 3,
        },
    input: {
      ...f,
      backgroundColor: fieldBg,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      fontSize: 14,
      fontWeight: '500',
      color: theme.inputText,
      minHeight: 34,
      ...softShadow,
    },
    inputPicker: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 4,
    },
    inputPickerText: {
      ...f,
      flex: 1,
      fontSize: 13,
      color: theme.inputText,
    },
    inputObs: {
      ...f,
      backgroundColor: fieldBg,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      fontSize: 13,
      fontWeight: '500',
      color: theme.inputText,
      minHeight: 34,
      ...softShadow,
    },
    dateInputRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      overflow: 'hidden',
      backgroundColor: fieldBg,
      ...softShadow,
    },
    dateWeekdayPrefix: {
      ...f,
      alignSelf: 'center',
      paddingLeft: 6,
      paddingRight: 2,
      fontSize: 11,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    dateInputField: {
      flex: 1,
      borderWidth: 0,
      borderRadius: 0,
      marginTop: 0,
    },
    dateCalendarBtn: {
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 8,
      borderLeftWidth: 1,
      borderLeftColor: theme.border,
      minWidth: 36,
      backgroundColor: theme.surface,
    },
  /** Lista de categorias no fluxo do scroll do painel (sem scroll interno). */
    categoryListExpand: {
      marginTop: 4,
      marginBottom: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      overflow: 'hidden',
    },
    dropdownItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      paddingVertical: 9,
      paddingHorizontal: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    dropdownItemLast: {
      borderBottomWidth: 0,
    },
    dropdownItemSelected: {
      backgroundColor: theme.primaryLight,
    },
    dropdownItemText: {
      ...f,
      flex: 1,
      fontSize: 13,
      color: theme.text,
    },
    dropdownItemTextSelected: {
      fontWeight: '700',
      color: theme.primary,
    },
    dropdownEmpty: {
      padding: 12,
      ...f,
      fontSize: 13,
      lineHeight: 18,
      color: theme.textSecondary,
      fontStyle: 'italic',
    },
    embeddedFormBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    embeddedFormBarTitle: {
      ...f,
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
    },
    segmentTrack: {
      flexDirection: 'row',
      gap: 4,
      padding: 4,
      borderRadius: 12,
      backgroundColor: theme.backgroundMuted,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 4,
    },
    segmentOption: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingVertical: 8,
      paddingHorizontal: 6,
      borderRadius: 9,
      minHeight: 36,
      backgroundColor: 'transparent',
    },
    segmentOptionActiveIn: {
      backgroundColor: theme.successLight,
      borderWidth: 1,
      borderColor: theme.success + '55',
    },
    segmentOptionActiveOut: {
      backgroundColor: theme.errorLight,
      borderWidth: 1,
      borderColor: theme.error + '55',
    },
    segmentOptionActiveSuccess: {
      backgroundColor: theme.successLight,
      borderWidth: 1,
      borderColor: theme.success + '55',
    },
    segmentOptionActiveWarning: {
      backgroundColor: theme.warning + '22',
      borderWidth: 1,
      borderColor: theme.warning + '55',
    },
    segmentOptionText: {
      ...f,
      fontSize: 12,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    segmentOptionTextActive: {
      color: theme.success,
      fontWeight: '700',
    },
    segmentOptionTextActiveOut: {
      color: theme.error,
      fontWeight: '700',
    },
    segmentOptionTextOnWarning: {
      color: theme.warning,
      fontWeight: '700',
    },
    recurrenceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: fieldBg,
      marginTop: 5,
      ...softShadow,
    },
    recurrenceRowActive: {
      borderColor: theme.primary,
      backgroundColor: theme.primaryLight,
    },
    recurrenceText: {
      ...f,
      flex: 1,
      fontSize: 12,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    checkbox: {
      width: 16,
      height: 16,
      borderRadius: 4,
      borderWidth: 1.5,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    durationRow: {
      flexDirection: 'row',
      gap: 4,
      flexWrap: 'wrap',
      marginTop: 4,
    },
    durationPill: {
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.background,
    },
    durationPillActive: {
      borderColor: theme.primary,
      backgroundColor: theme.primaryLight,
    },
    durationPillText: {
      ...f,
      fontSize: 11,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    customMesesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 6,
    },
    customMesesLabel: {
      ...f,
      fontSize: 14,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    submitActionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 6,
    },
    submitCancelButton: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitCancelButtonText: {
      ...f,
      fontSize: 15,
      fontWeight: '700',
      color: theme.textSecondary,
    },
    submitButtonFlex: {
      flex: 1,
      backgroundColor: theme.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: 9,
      borderRadius: 6,
    },
    submitButton: {
      marginTop: 8,
      backgroundColor: theme.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 9,
      borderRadius: 10,
      minHeight: 40,
      ...(Platform.OS === 'web'
        ? ({ boxShadow: '0 4px 14px rgba(59, 130, 246, 0.35)' } as object)
        : {
            shadowColor: theme.primary,
            shadowOpacity: 0.35,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 3 },
            elevation: 3,
          }),
    },
    submitButtonText: {
      ...f,
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
  });
};

function SkeletonCard({ theme }: { theme: ReturnType<typeof getTheme> }) {
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const block = (w: number | string, h: number) => (
    <Animated.View
      style={{
        width: w as any,
        height: h,
        backgroundColor: theme.border,
        borderRadius: 4,
        opacity: pulse,
      }}
    />
  );
  return (
    <View
      style={{
        backgroundColor: theme.card,
        marginHorizontal: 20,
        marginVertical: 6,
        padding: 16,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <View style={{ flex: 1, gap: 6 }}>
        {block('60%', 14)}
        {block('40%', 12)}
      </View>
      {block(70, 18)}
    </View>
  );
}

export default function TransactionsScreen() {
  const { transactions, fetchTransactions, addTransaction, updateTransaction, deleteTransaction, loading, googleAuthRequired, clearGoogleAuthRequired } =
    useTransactionStore();
  const { recorrencias, fetchRecorrencias, skips, fetchSkips, updateRecorrencia, deleteRecorrencia } =
    useRecorrenciaStore();
  const { userId } = useAuthStore();
  const {
    contasAtivas,
    contaNameById,
    defaultContaId,
    refetch: refetchContas,
  } = useUserContasFinanceiras(userId, transactions);
  const [contaFilter, setContaFilter] = useState<ContaFilterValue>('all');
  const { isDarkMode } = useThemeStore();
  const { openDrawer, hasGlobalNav } = useNavigationDrawer();
  const { isWebDesktop } = useShellLayout();
  const theme = useMemo(() => getTheme(isDarkMode), [isDarkMode]);
  const useShellCanvas = hasGlobalNav || Platform.OS === 'web';
  const showPanelHeader = isWebDesktop && hasGlobalNav;
  const shellBg = useShellCanvas
    ? isDarkMode
      ? SHELL_CANVAS_DARK
      : SHELL_CANVAS_LIGHT
    : theme.background;
  const styles = useMemo(
    () => createStyles(theme, showPanelHeader, isDarkMode),
    [theme, showPanelHeader, isDarkMode],
  );
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode]);
  const unifiedPanelChrome = useMemo(() => mfTechPanelChrome(isDarkMode, 'surface'), [isDarkMode]);
  const commandWellSurface = useMemo(() => mfTechInsetSurface(isDarkMode, false), [isDarkMode]);
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 1024;
  const isNativeMobile = Platform.OS !== 'web' && !showPanelHeader;
  /** Painel lateral só em desktop sem navbar global; no shell usa modal. */
  const useSidePanelForm = isDesktop && !showPanelHeader;
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'entrada' | 'saida'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pago' | 'pendente'>('all');
  const [markingId, setMarkingId] = useState<string | null>(null);
  // Card sob hover (apenas web — mobile não tem hover).
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  // Sheet de ações (mobile) — abre quando usuário toca no "⋯" do card.
  const [actionSheetTx, setActionSheetTx] = useState<any | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteScopeTx, setDeleteScopeTx] = useState<any | null>(null);
  const [deletingScope, setDeletingScope] = useState(false);
  const [deleteConfirmTx, setDeleteConfirmTx] = useState<{ id: string; classificacao?: string } | null>(
    null,
  );
  const [deleteConfirmLoading, setDeleteConfirmLoading] = useState(false);

  const nowT = new Date();
  const [selectedMonth, setSelectedMonth] = useState({ year: nowT.getFullYear(), month: nowT.getMonth() + 1 });
  const [periodPreset, setPeriodPreset] = useState<TransactionPeriodPreset>('Esse mês');
  const [dateRange, setDateRange] = useState<TransactionDateRange>({ start: '', end: '' });
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [exporting, setExporting] = useState(false);

  const MONTH_NAMES_T = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];

  const goToPrevMonthT = () => setSelectedMonth(({ year, month }) => {
    const prev = new Date(year, month - 2, 1);
    return { year: prev.getFullYear(), month: prev.getMonth() + 1 };
  });
  const goToNextMonthT = () => setSelectedMonth(({ year, month }) => {
    const next = new Date(year, month, 1);
    return { year: next.getFullYear(), month: next.getMonth() + 1 };
  });
  const goToCurrentMonth = () => {
    const now = new Date();
    setSelectedMonth({ year: now.getFullYear(), month: now.getMonth() + 1 });
  };

  const monthLabel = `${MONTH_NAMES_T[selectedMonth.month - 1]} ${selectedMonth.year}`;
  const periodLabel = periodToolbarLabel(
    periodPreset,
    selectedMonth,
    MONTH_NAMES_T,
    useCustomRange,
    dateRange,
  );

  useEffect(() => {
    if (dateRange.start && dateRange.end) {
      setUseCustomRange(true);
    } else if (!dateRange.start && !dateRange.end) {
      setUseCustomRange(false);
    }
  }, [dateRange.start, dateRange.end]);

  const openNewTransaction = () => {
    setEditingTransaction(null);
    setModalVisible(true);
  };

  useEffect(() => {
    fetchTransactions();
    fetchRecorrencias();
    fetchSkips();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // fetchTransactions é estável, não precisa estar nas dependências

  // Monitorar quando autenticação Google é necessária
  useEffect(() => {
    if (googleAuthRequired) {
      promptGoogleAuth().then((success) => {
        clearGoogleAuthRequired();
        if (success) {
          Alert.alert('Sucesso', 'Google Calendar conectado com sucesso! Os próximos eventos serão criados automaticamente.');
        }
      });
    }
  }, [googleAuthRequired, clearGoogleAuthRequired]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchTransactions(),
      fetchRecorrencias(),
      fetchSkips(),
      refetchContas(),
    ]);
    setRefreshing(false);
  };

  const handleSave = async (data: any) => {
    try {
      if (data.id) {
        await updateTransaction(data.id, data);
      } else {
        await addTransaction(data);
      }
      setModalVisible(false);
      setEditingTransaction(null);
    } catch (error: any) {
      Alert.alert('Erro', error.message);
    }
  };

  const handleEdit = (transaction: any) => {
    setEditingTransaction(transaction);
    if (!useSidePanelForm) {
      setModalVisible(true);
    }
  };

  const handleDuplicate = (transaction: any) => {
    const draft = buildDuplicateTransactionDraft(transaction);
    if (!draft) return;
    setEditingTransaction(draft);
    if (!useSidePanelForm) {
      setModalVisible(true);
    }
  };

  /** Marca uma transação pendente como paga/recebida sem abrir o modal. */
  const handleQuickMark = async (transaction: any) => {
    if (!transaction?.id || markingId) return;
    const isEntrada = String(transaction.tipo).toLowerCase() === 'entrada';
    const newStatus = isEntrada ? 'recebido' : 'pago';
    setMarkingId(transaction.id);
    try {
      await updateTransaction(transaction.id, { ...transaction, status: newStatus });
    } catch (error: any) {
      const msg = error?.message || 'Falha ao atualizar status';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Erro', msg);
    } finally {
      setMarkingId(null);
    }
  };

  /** Tocar numa projeção materializa e abre o modal de edição. */
  const handleProjectionTap = (proj: ProjectedTransaction) => {
    const statusAPagar = proj.tipo === 'entrada' ? 'a_receber' : 'a_pagar';
    const payload = buildMaterializationPayload(proj);
    setEditingTransaction({ ...payload, status: statusAPagar });
    setModalVisible(true);
  };

  const requestDelete = (transaction: { id?: string; classificacao?: string }) => {
    const id = transaction?.id;
    if (!id || typeof id !== 'string' || id.trim() === '') {
      showErr('ID da transação inválido');
      return;
    }
    setDeleteConfirmTx({ id, classificacao: transaction.classificacao });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmTx?.id || deleteConfirmLoading) return;
    setDeleteConfirmLoading(true);
    try {
      const result = await deleteTransaction(deleteConfirmTx.id);
      if (result.error) {
        showErr(result.error || 'Não foi possível excluir a transação');
        return;
      }
      setDeleteConfirmTx(null);
    } catch (error: any) {
      showErr(error?.message || error?.toString() || 'Não foi possível excluir a transação');
    } finally {
      setDeleteConfirmLoading(false);
    }
  };

  /** Roteador de exclusão: se a transação tem recorrência, abre modal de escopo. */
  const handleDeleteTransaction = (transaction: any) => {
    if (transaction?.recorrencia_id) {
      setDeleteScopeTx(transaction);
    } else {
      requestDelete(transaction);
    }
  };

  const showErr = (msg: string) => {
    if (Platform.OS === 'web') window.alert(msg);
    else Alert.alert('Erro', msg);
  };

  /** Apaga apenas o lançamento em questão; recorrência e outros meses ficam intactos. */
  const handleDeleteOnlyThis = async () => {
    if (!deleteScopeTx || deletingScope) return;
    setDeletingScope(true);
    try {
      const result = await deleteTransaction(deleteScopeTx.id);
      if (result.error) showErr(result.error);
      setDeleteScopeTx(null);
    } catch (error: any) {
      showErr(error?.message || 'Falha ao excluir o lançamento');
    } finally {
      setDeletingScope(false);
    }
  };

  /** Apaga este lançamento + os lançamentos futuros vinculados; desativa a recorrência. */
  const handleDeleteFromHere = async () => {
    if (!deleteScopeTx || deletingScope) return;
    const recId = deleteScopeTx.recorrencia_id;
    const fromDate = deleteScopeTx.data;
    if (!recId || !fromDate || !userId) {
      showErr('Dados insuficientes para excluir os futuros.');
      return;
    }
    setDeletingScope(true);
    try {
      if (isLocalApiAuthMode()) {
        const toDelete = transactions.filter(
          (t) =>
            t.recorrencia_id === recId &&
            String(t.data || '') >= String(fromDate) &&
            !isProjecao(t),
        );
        for (const tx of toDelete) {
          await apiClient.delete(`/transactions?id=${encodeURIComponent(tx.id)}`);
        }
        await updateRecorrencia(recId, { ativo: false });
      } else {
        const { error: delErr } = await supabase
          .from('lancamentos_id')
          .delete()
          .eq('user_id', userId)
          .eq('recorrencia_id', recId)
          .gte('data', fromDate);
        if (delErr) throw delErr;
        const { error: updErr } = await supabase
          .from('recorrencias')
          .update({ ativo: false })
          .eq('id', recId)
          .eq('user_id', userId);
        if (updErr) throw updErr;
      }
      await Promise.all([fetchTransactions(), fetchRecorrencias(), fetchSkips()]);
      setDeleteScopeTx(null);
    } catch (error: any) {
      showErr(error?.message || 'Falha ao excluir os futuros');
    } finally {
      setDeletingScope(false);
    }
  };

  /** Apaga TODOS os lançamentos vinculados e o template da recorrência. */
  const handleDeleteEntireRecurrence = async () => {
    if (!deleteScopeTx || deletingScope) return;
    const recId = deleteScopeTx.recorrencia_id;
    if (!recId || !userId) {
      showErr('Recorrência não identificada.');
      return;
    }
    setDeletingScope(true);
    try {
      if (isLocalApiAuthMode()) {
        const toDelete = transactions.filter(
          (t) => t.recorrencia_id === recId && !isProjecao(t),
        );
        for (const tx of toDelete) {
          await apiClient.delete(`/transactions?id=${encodeURIComponent(tx.id)}`);
        }
        const result = await deleteRecorrencia(recId);
        if (!result.ok) throw new Error(result.error || 'Falha ao excluir a recorrência');
      } else {
        const { error: delErr } = await supabase
          .from('lancamentos_id')
          .delete()
          .eq('user_id', userId)
          .eq('recorrencia_id', recId);
        if (delErr) throw delErr;
        const { error: recErr } = await supabase
          .from('recorrencias')
          .delete()
          .eq('id', recId)
          .eq('user_id', userId);
        if (recErr) throw recErr;
      }
      await Promise.all([fetchTransactions(), fetchRecorrencias(), fetchSkips()]);
      setDeleteScopeTx(null);
    } catch (error: any) {
      showErr(error?.message || 'Falha ao excluir a recorrência');
    } finally {
      setDeletingScope(false);
    }
  };

  const searchLower = search.toLowerCase();
  const matchesSearch = (item: { classificacao?: string; obs?: string | null }) => {
    if (!searchLower) return true;
    const inClass = (item.classificacao || '').toLowerCase().includes(searchLower);
    const inObs = (item.obs || '').toLowerCase().includes(searchLower);
    return inClass || inObs;
  };

  const periodMatchOpts = useMemo(
    () => ({
      period: periodPreset,
      selectedMonth,
      dateRange,
      useCustomRange,
    }),
    [periodPreset, selectedMonth, dateRange, useCustomRange],
  );

  const realFilteredByPeriod = useMemo(
    () =>
      transactions.filter(
        (t) => matchesTransactionPeriod(t, periodMatchOpts) && matchesSearch(t),
      ),
    [transactions, periodMatchOpts, searchLower],
  );

  const realFiltered = useMemo(
    () => filterTransactionsByConta(realFilteredByPeriod, contaFilter),
    [realFilteredByPeriod, contaFilter],
  );

  const projectionMonthRange = useMemo(() => {
    if (useCustomRange && dateRange.start && dateRange.end) {
      const start = new Date(`${dateRange.start}T12:00:00`);
      const end = new Date(`${dateRange.end}T12:00:00`);
      return {
        startYear: start.getFullYear(),
        startMonth: start.getMonth() + 1,
        endYear: end.getFullYear(),
        endMonth: end.getMonth() + 1,
      };
    }
    if (periodPreset === 'Esse mês') {
      return {
        startYear: selectedMonth.year,
        startMonth: selectedMonth.month,
        endYear: selectedMonth.year,
        endMonth: selectedMonth.month,
      };
    }
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    return { startYear: y, startMonth: m, endYear: y, endMonth: m };
  }, [useCustomRange, dateRange, periodPreset, selectedMonth]);

  // Distância (em meses) entre o mês selecionado e o mês atual. <=0 = atual ou passado.
  const monthsAhead = useMemo(() => {
    const now = new Date();
    return (selectedMonth.year - now.getFullYear()) * 12 + (selectedMonth.month - (now.getMonth() + 1));
  }, [selectedMonth.year, selectedMonth.month]);

  // Projeções aparecem em todos os meses — a deduplicação por `recorrencia_id + ano_mes`
  // já remove projeções de meses cuja transação real foi materializada.
  const projections = useMemo(
    () =>
      projectRecurrences(recorrencias, transactions, projectionMonthRange, skips)
        .filter(
          (p) => matchesTransactionPeriod(p, periodMatchOpts) && matchesSearch(p),
        ),
    [recorrencias, transactions, skips, projectionMonthRange, periodMatchOpts, searchLower],
  );

  // Lista combinada: reais + projeções, ordenada por data (mais recente primeiro).
  const filtered = useMemo(() => {
    const combined: any[] = [...realFiltered, ...projections];
    combined.sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
    return combined;
  }, [realFiltered, projections]);

  // Aplica filtros de tipo, status e conta sobre filtered.
  const filteredWithPills = useMemo(() => {
    const byConta = filterTransactionsByConta(filtered, contaFilter);
    return byConta.filter((t: any) => {
      const isEntrada = String(t.tipo).toLowerCase() === 'entrada';
      if (typeFilter === 'entrada' && !isEntrada) return false;
      if (typeFilter === 'saida' && isEntrada) return false;
      if (statusFilter !== 'all') {
        const s = String(t.status || '').toLowerCase();
        const isPago = s === 'pago' || s === 'recebido';
        if (statusFilter === 'pago' && !isPago) return false;
        if (statusFilter === 'pendente' && isPago) return false;
      }
      return true;
    });
  }, [filtered, typeFilter, statusFilter, contaFilter]);

  // Agrupa por data — formato SectionList.
  const sections = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const t of filteredWithPills) {
      const date = String(t.data || t.criado_em || '').slice(0, 10);
      if (!groups[date]) groups[date] = [];
      groups[date].push(t);
    }
    const todayStr = new Date().toISOString().slice(0, 10);
    return Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map((date) => {
        const d = new Date(date + 'T00:00:00-03:00');
        const isToday = date === todayStr;
        const w = weekdayAbbrFromYmd(date);
        const dayMonthShort = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
        const label = isToday ? `Hoje, ${w}, ${dayMonthShort}` : `${w}, ${dayMonthShort}`;
        return { title: label, data: groups[date] };
      });
  }, [filteredWithPills]);

  // KPIs do mês — lançamentos reais (sem projeções), respeitando filtro de conta.
  const kpis = useMemo(() => computeMonthFlowKpis(realFiltered), [realFiltered]);

  const hasActiveFilters =
    Boolean(search) ||
    typeFilter !== 'all' ||
    statusFilter !== 'all' ||
    contaFilter !== 'all' ||
    useCustomRange ||
    periodPreset !== 'Esse mês';

  const clearAllFilters = () => {
    setSearch('');
    setTypeFilter('all');
    setStatusFilter('all');
    setContaFilter('all');
    setPeriodPreset('Esse mês');
    setDateRange({ start: '', end: '' });
    setUseCustomRange(false);
  };

  const handlePeriodPresetChange = (p: TransactionPeriodPreset) => {
    setPeriodPreset(p);
    setDateRange({ start: '', end: '' });
    setUseCustomRange(false);
  };

  const handleExportExcel = async () => {
    const rows = filteredWithPills.filter((t) => !isProjecao(t));
    setExporting(true);
    try {
      await exportTransactionsToExcel(rows);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Falha ao exportar';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Exportar Excel', msg);
    } finally {
      setExporting(false);
    }
  };

  const mobileHeaderSubtitle =
    filteredWithPills.length === 1
      ? '1 movimentação no período'
      : `${filteredWithPills.length} movimentações no período`;

  const headerActions = (
    <TransactionsHeaderActions
      theme={theme}
      exporting={exporting}
      onExport={() => void handleExportExcel()}
      onAddTransaction={openNewTransaction}
    />
  );

  const showInflationBanner = monthsAhead > 24;

  // Mapeamento de status → label/cor para o badge.
  const statusMeta = (status: string, isProj: boolean): { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap } => {
    if (isProj) return { label: 'virtual', color: theme.textSecondary, bg: theme.background, icon: 'ellipse-outline' };
    const s = String(status || '').toLowerCase();
    if (s === 'pago' || s === 'recebido') {
      return { label: s === 'pago' ? 'pago' : 'recebido', color: theme.success, bg: theme.success + '20', icon: 'checkmark-circle' };
    }
    if (s === 'a_pagar') {
      return { label: 'a pagar', color: theme.warning, bg: theme.warning + '20', icon: 'time-outline' };
    }
    if (s === 'a_receber') {
      return { label: 'a receber', color: theme.warning, bg: theme.warning + '20', icon: 'time-outline' };
    }
    return { label: s || '—', color: theme.textSecondary, bg: theme.background, icon: 'ellipse-outline' };
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: shellBg }]} edges={['top', 'bottom']}>
      {!showPanelHeader ? (
        <MfAppHeader
          title="Transações"
          subtitle={isNativeMobile ? mobileHeaderSubtitle : periodLabel}
          onMenuPress={openDrawer}
          right={headerActions}
        />
      ) : null}

      {!showPanelHeader && Platform.OS === 'web' ? (
        <>
          <View style={styles.monthNavMobile}>
            <MfPeriodNav
              label={periodPreset === 'Esse mês' && !useCustomRange ? monthLabel : periodLabel}
              onPrevious={periodPreset === 'Esse mês' && !useCustomRange ? goToPrevMonthT : undefined}
              onNext={periodPreset === 'Esse mês' && !useCustomRange ? goToNextMonthT : undefined}
              variant="tech"
            />
            {periodPreset === 'Esse mês' && !useCustomRange && monthsAhead !== 0 ? (
              <TouchableOpacity
                onPress={goToCurrentMonth}
                style={styles.todayChip}
                accessibilityRole="button"
                accessibilityLabel="Voltar para o mês atual"
              >
                <Ionicons name="return-up-back-outline" size={14} color={tokens.accent} />
                <Text style={styles.todayChipText}>Voltar para hoje</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <TransactionsPeriodToolbar
            theme={theme}
            period={periodPreset}
            dateRange={dateRange}
            useCustomRange={useCustomRange}
            onPeriodChange={handlePeriodPresetChange}
            onDateRangeChange={setDateRange}
            onClearRange={() => {
              setDateRange({ start: '', end: '' });
              setUseCustomRange(false);
            }}
          />
        </>
      ) : null}

      {!(isDesktop && showPanelHeader) && Platform.OS === 'web' ? (
        <View style={[styles.searchContainer, isDesktop && styles.searchContainerDesktop]}>
          <Ionicons name="search-outline" size={20} color={theme.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Pesquisar receitas ou gastos"
            placeholderTextColor={theme.placeholder}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      ) : null}

      {showInflationBanner && (
        <View style={styles.inflationBanner}>
          <Ionicons name="information-circle-outline" size={18} color={theme.warning} />
          <Text style={styles.inflationBannerText}>
            Você está vendo um mês distante. Os valores projetados de recorrências não consideram inflação — o preço real pode ser diferente.
          </Text>
        </View>
      )}

      <View
        style={[
          isDesktop && !showPanelHeader ? styles.desktopRow : { flex: 1 },
          showPanelHeader && styles.shellMainColumn,
        ]}
      >
        <View style={showPanelHeader ? [styles.unifiedPanel, unifiedPanelChrome] : { flex: 1, minHeight: 0 }}>
        {showPanelHeader ? (
            <TransactionsPageChrome
              bare
              theme={theme}
              monthLabel={periodPreset === 'Esse mês' && !useCustomRange ? monthLabel : periodLabel}
              movementCount={filteredWithPills.length}
              monthsAhead={monthsAhead}
              onPrevMonth={
                periodPreset === 'Esse mês' && !useCustomRange ? goToPrevMonthT : undefined
              }
              onNextMonth={
                periodPreset === 'Esse mês' && !useCustomRange ? goToNextMonthT : undefined
              }
              onGoToCurrentMonth={goToCurrentMonth}
              onAddTransaction={openNewTransaction}
              onExport={() => void handleExportExcel()}
              exporting={exporting}
            />
        ) : null}
        {!showPanelHeader && useSidePanelForm ? (
          <View style={styles.desktopFormShell}>
            <ScrollView
              style={styles.desktopFormPanel}
              contentContainerStyle={styles.desktopFormScrollContent}
              showsVerticalScrollIndicator
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              {...(Platform.OS === 'web' ? { className: WEB_SCROLL_Y_CLASS } : {})}
            >
              <InlineTransactionForm
                theme={theme}
                userId={userId}
                editingTransaction={editingTransaction}
                contasAtivas={contasAtivas}
                defaultContaId={defaultContaId}
                onCreated={() => {
                  void Promise.all([fetchTransactions(), fetchRecorrencias(), refetchContas()]);
                }}
                onUpdated={() => {
                  setEditingTransaction(null);
                  void Promise.all([fetchTransactions(), fetchRecorrencias(), refetchContas()]);
                }}
                onCancelEdit={() => setEditingTransaction(null)}
              />
            </ScrollView>
          </View>
        ) : null}
        <ListPanelWrap
          isDesktop={isDesktop}
          showPanelHeader={showPanelHeader}
          shellPanelStyle={styles.desktopListPanelShell}
          legacyPanelStyle={isDesktop ? styles.desktopListPanel : styles.mobileListPanel}
          bare={showPanelHeader}
        >
      {loading && transactions.length === 0 ? (
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator
          {...(Platform.OS === 'web' ? { className: WEB_SCROLL_Y_CLASS } : {})}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }
        >
          <TransactionsMonthMetrics
            entradas={kpis.entradas}
            saidas={kpis.saidas}
            saldo={kpis.saldo}
            countEntradas={kpis.countEntradas}
            countSaidas={kpis.countSaidas}
          />
          {[0, 1, 2, 3, 4].map((i) => (
            <SkeletonCard key={`sk-${i}`} theme={theme} />
          ))}
        </ScrollView>
      ) : (
        <SectionList
          style={styles.scrollView}
          sections={sections}
          keyExtractor={(t: any) => String(t.id)}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator
          {...(Platform.OS === 'web' ? { className: WEB_SCROLL_Y_CLASS } : {})}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }
          ListHeaderComponent={
            (isNativeMobile ? (
              <TransactionsMobileListHeader
                theme={theme}
                pillStyles={styles}
                monthLabel={monthLabel}
                periodLabel={periodLabel}
                periodPreset={periodPreset}
                useCustomRange={useCustomRange}
                dateRange={dateRange}
                monthsAhead={monthsAhead}
                search={search}
                typeFilter={typeFilter}
                statusFilter={statusFilter}
                contaFilter={contaFilter}
                contasAtivas={contasAtivas}
                entradas={kpis.entradas}
                saidas={kpis.saidas}
                saldo={kpis.saldo}
                countEntradas={kpis.countEntradas}
                countSaidas={kpis.countSaidas}
                onSearchChange={setSearch}
                onPeriodChange={handlePeriodPresetChange}
                onDateRangeChange={setDateRange}
                onClearRange={() => {
                  setDateRange({ start: '', end: '' });
                  setUseCustomRange(false);
                }}
                onPrevMonth={
                  periodPreset === 'Esse mês' && !useCustomRange ? goToPrevMonthT : undefined
                }
                onNextMonth={
                  periodPreset === 'Esse mês' && !useCustomRange ? goToNextMonthT : undefined
                }
                onGoToCurrentMonth={goToCurrentMonth}
                onTypeChange={setTypeFilter}
                onStatusChange={setStatusFilter}
                onContaChange={setContaFilter}
                onClearAllFilters={clearAllFilters}
              />
            ) : (
            <View style={showPanelHeader ? styles.commandStack : undefined}>
              {showPanelHeader ? (
                <View style={[styles.commandWell, commandWellSurface]}>
                  <TransactionsPeriodToolbar
                    theme={theme}
                    period={periodPreset}
                    dateRange={dateRange}
                    useCustomRange={useCustomRange}
                    compact
                    embedded
                    onPeriodChange={handlePeriodPresetChange}
                    onDateRangeChange={setDateRange}
                    onClearRange={() => {
                      setDateRange({ start: '', end: '' });
                      setUseCustomRange(false);
                    }}
                  />
                  <View style={styles.searchContainerInPanel}>
                    <Ionicons name="search-outline" size={18} color={theme.textSecondary} style={styles.searchIcon} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Pesquisar receitas ou gastos"
                      placeholderTextColor={theme.placeholder}
                      value={search}
                      onChangeText={setSearch}
                    />
                  </View>
                </View>
              ) : null}
              {isDesktop && !showPanelHeader ? (
                <View style={styles.historyHeaderRow}>
                  <View style={styles.historyHeader}>
                    <Text style={styles.historyTitle}>Histórico de lançamentos</Text>
                    <Text style={styles.historySubtitle}>
                      {filteredWithPills.length}{' '}
                      {filteredWithPills.length === 1 ? 'movimentação' : 'movimentações'} · {monthLabel}
                    </Text>
                  </View>
                  <TransactionsHeaderActions
                    theme={theme}
                    exporting={exporting}
                    onExport={() => void handleExportExcel()}
                    onAddTransaction={openNewTransaction}
                  />
                </View>
              ) : null}
              <View style={isDesktop ? styles.historySummaryBlock : undefined}>
                <TransactionsMonthMetrics
                  entradas={kpis.entradas}
                  saidas={kpis.saidas}
                  saldo={kpis.saldo}
                  countEntradas={kpis.countEntradas}
                  countSaidas={kpis.countSaidas}
                />
              </View>
              {showPanelHeader ? (
                <View style={[styles.filtersWell, commandWellSurface]}>
              <FilterGroup label="Tipo" styles={styles}>
              <ScrollView
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                style={styles.pillsScrollView}
                contentContainerStyle={styles.pillsRowContent}
                {...(Platform.OS === 'web' ? { className: WEB_HIDE_X_SCROLL_CLASS } : {})}
              >
                {(
                  [
                    { key: 'all', label: 'Todos', icon: 'apps-outline' as const },
                    { key: 'entrada', label: 'Entradas', icon: 'arrow-down-outline' as const },
                    { key: 'saida', label: 'Saídas', icon: 'arrow-up-outline' as const },
                  ]
                ).map((opt) => {
                  const active = typeFilter === opt.key;
                  const typePill =
                    !active
                      ? { box: undefined as object | undefined, label: undefined as object | undefined, icon: theme.textSecondary }
                      : opt.key === 'entrada'
                        ? { box: styles.pillActiveEntrada, label: styles.pillTextActiveEntrada, icon: theme.success }
                        : opt.key === 'saida'
                          ? { box: styles.pillActiveSaida, label: styles.pillTextActiveSaida, icon: theme.error }
                          : { box: styles.pillActive, label: styles.pillTextActive, icon: theme.primary };
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      onPress={() => setTypeFilter(opt.key as any)}
                      style={[styles.pill, typePill.box]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Ionicons name={opt.icon} size={13} color={typePill.icon} />
                      <Text style={[styles.pillText, typePill.label]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              </FilterGroup>
              <FilterGroup label="Status" styles={styles}>
              <ScrollView
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                style={styles.pillsScrollView}
                contentContainerStyle={styles.pillsRowContent}
                {...(Platform.OS === 'web' ? { className: WEB_HIDE_X_SCROLL_CLASS } : {})}
              >
                {(
                  [
                    { key: 'all', label: 'Todos status', icon: 'ellipse-outline' as const },
                    { key: 'pago', label: 'Pagas', icon: 'checkmark-circle-outline' as const },
                    { key: 'pendente', label: 'Pendentes', icon: 'time-outline' as const },
                  ]
                ).map((opt) => {
                  const active = statusFilter === opt.key;
                  const statusPill =
                    !active
                      ? { box: undefined as object | undefined, label: undefined as object | undefined, icon: theme.textSecondary }
                      : opt.key === 'pago'
                        ? { box: styles.pillActivePago, label: styles.pillTextActivePago, icon: theme.success }
                        : opt.key === 'pendente'
                          ? { box: styles.pillActivePendente, label: styles.pillTextActivePendente, icon: theme.warning }
                          : { box: styles.pillActive, label: styles.pillTextActive, icon: theme.primary };
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      onPress={() => setStatusFilter(opt.key as any)}
                      style={[styles.pill, statusPill.box]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Ionicons name={opt.icon} size={13} color={statusPill.icon} />
                      <Text style={[styles.pillText, statusPill.label]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              </FilterGroup>
              <ContaFilterPillsRow
                contasAtivas={contasAtivas}
                contaFilter={contaFilter}
                onChange={setContaFilter}
                styles={styles}
                theme={theme}
              />
                </View>
              ) : (
                <TransactionsFilterPills
                  theme={theme}
                  styles={styles}
                  typeFilter={typeFilter}
                  statusFilter={statusFilter}
                  contaFilter={contaFilter}
                  contasAtivas={contasAtivas}
                  onTypeChange={setTypeFilter}
                  onStatusChange={setStatusFilter}
                  onContaChange={setContaFilter}
                />
              )}
            </View>
            ))
          }
          renderSectionHeader={({ section }: { section: { title: string } }) => (
            <TransactionsDateSectionHeader label={section.title} />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name={hasActiveFilters ? 'search-outline' : 'document-text-outline'}
                size={40}
                color={theme.textTertiary}
                style={{ marginBottom: 8 }}
              />
              <Text style={styles.emptyText}>
                {search
                  ? `Nenhum resultado para "${search}"`
                  : hasActiveFilters
                  ? 'Nenhuma transação com esses filtros'
                  : 'Nenhuma transação neste período'}
              </Text>
              {hasActiveFilters ? (
                <TouchableOpacity
                  onPress={clearAllFilters}
                  style={{
                    marginTop: 12,
                    paddingVertical: 8,
                    paddingHorizontal: 16,
                    borderRadius: 999,
                    backgroundColor: theme.primaryLight,
                  }}
                >
                  <Text style={{ color: theme.primary, fontWeight: '600' }}>Limpar filtros</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => {
                    setEditingTransaction(null);
                    setModalVisible(true);
                  }}
                  style={{
                    marginTop: 12,
                    paddingVertical: 10,
                    paddingHorizontal: 18,
                    borderRadius: 999,
                    backgroundColor: theme.primary,
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>+ Adicionar primeira transação</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={({ item: t }: { item: any }) => {
            const isProj = isProjecao(t);
            const meta = statusMeta(t.status, isProj);
            const isEntrada = String(t.tipo).toLowerCase() === 'entrada';
            const status = String(t.status || '').toLowerCase();
            const isPendente = !isProj && (status === 'a_pagar' || status === 'a_receber');
            const isMarking = markingId === t.id;
            const isHovered = Platform.OS === 'web' && hoveredCardId === t.id;
            const hoverProps =
              Platform.OS === 'web'
                ? ({
                    onMouseEnter: () => setHoveredCardId(t.id),
                    onMouseLeave: () => setHoveredCardId((prev) => (prev === t.id ? null : prev)),
                  } as any)
                : {};
            const categoryIcon = getCategoryIcon(t.classificacao, t.tipo);
            const accentBg = isEntrada ? theme.successLight : theme.errorLight;
            const accentFg = isEntrada ? theme.success : theme.error;
            const contaLabel = t.conta_id ? contaNameById[String(t.conta_id)] : null;
            const secondaryLine =
              (t.obs && String(t.obs).trim()) ||
              (t.data ? formatYmdToBrShort(String(t.data).slice(0, 10)) : '');
            return (
              <TouchableOpacity
                activeOpacity={isProj ? 0.7 : 1}
                onPress={isProj ? () => handleProjectionTap(t as ProjectedTransaction) : () => handleEdit(t)}
                style={[
                  styles.transactionCard,
                  isProj && styles.transactionCardProjected,
                  isHovered && styles.transactionCardHovered,
                ]}
                {...hoverProps}
              >
                <View
                  style={[
                    styles.categoryIconBox,
                    { backgroundColor: accentBg, opacity: isProj ? 0.55 : 1 },
                  ]}
                >
                  <Ionicons name={categoryIcon} size={22} color={accentFg} />
                </View>
                <View style={styles.transactionInfo}>
                  <Text
                    style={[styles.transactionDescription, isProj && styles.transactionTextProjected]}
                    numberOfLines={1}
                  >
                    {t.classificacao}
                  </Text>
                  {secondaryLine ? (
                    <Text
                      style={[styles.transactionObs, isProj && styles.transactionTextProjected]}
                      numberOfLines={1}
                    >
                      {secondaryLine}
                    </Text>
                  ) : null}
                  <View style={styles.transactionMetaRow}>
                    <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
                      <Ionicons name={meta.icon} size={11} color={meta.color} />
                      <Text style={[styles.statusBadgeText, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                    {contaLabel ? (
                      <View style={[styles.statusBadge, styles.contaBadge]}>
                        <Ionicons name="wallet-outline" size={11} color={theme.primary} />
                        <Text style={[styles.statusBadgeText, { color: theme.primary }]} numberOfLines={1}>
                          {contaLabel}
                        </Text>
                      </View>
                    ) : null}
                    {isPendente ? (
                      <TouchableOpacity
                        onPress={() => handleQuickMark(t)}
                        disabled={isMarking}
                        style={[styles.quickMarkButton, isMarking && { opacity: 0.5 }]}
                        accessibilityLabel={`Marcar como ${isEntrada ? 'recebido' : 'pago'}`}
                      >
                        <Ionicons
                          name={isMarking ? 'sync-outline' : 'checkmark-circle'}
                          size={13}
                          color={theme.success}
                        />
                        <Text style={styles.quickMarkText}>
                          {isMarking ? 'Salvando…' : `Marcar como ${isEntrada ? 'recebido' : 'pago'}`}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
                <View style={styles.transactionDetails}>
                  <Text
                    style={[
                      styles.transactionValue,
                      isEntrada ? styles.incomeValue : styles.expenseValue,
                      isProj && styles.transactionValueProjected,
                      !isProj && Platform.OS === 'web' && styles.transactionValueWithWebActions,
                    ]}
                  >
                    {isEntrada ? '+ ' : ''}
                    {formatCurrencyBR(typeof t.valor === 'number' ? t.valor : parseFloat(String(t.valor)))}
                  </Text>
                  {!isProj && Platform.OS === 'web' && (
                    <View
                      style={[
                        styles.actionButtons,
                        { opacity: isHovered ? 1 : 0, transition: 'opacity 0.12s ease' } as any,
                      ]}
                      pointerEvents={isHovered ? 'auto' : 'none'}
                    >
                      <TouchableOpacity
                        onPress={(e: any) => {
                          e?.stopPropagation?.();
                          handleEdit(t);
                        }}
                        style={styles.editButton}
                        accessibilityLabel="Editar transação"
                      >
                        <Ionicons name="pencil" size={16} color={theme.textSecondary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={(e: any) => {
                          e?.stopPropagation?.();
                          handleDuplicate(t);
                        }}
                        style={styles.editButton}
                        accessibilityLabel="Duplicar transação"
                      >
                        <Ionicons name="copy-outline" size={16} color={theme.textSecondary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={(e: any) => {
                          e?.stopPropagation?.();
                          handleDeleteTransaction(t);
                        }}
                        style={styles.deleteButton}
                        accessibilityLabel="Excluir transação"
                      >
                        <Ionicons name="trash-outline" size={16} color={theme.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  )}
                  {!isProj && Platform.OS !== 'web' && (
                    <TouchableOpacity
                      onPress={(e: any) => {
                        e?.stopPropagation?.();
                        setActionSheetTx(t);
                      }}
                      style={styles.moreButton}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      accessibilityLabel="Mais ações"
                    >
                      <Ionicons name="ellipsis-horizontal" size={18} color={theme.textTertiary} />
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
          ListFooterComponent={Platform.OS === 'web' ? AppLegalFooter : undefined}
          contentContainerStyle={sections.length === 0 ? { flexGrow: 1 } : { paddingBottom: 16 }}
          initialNumToRender={12}
          windowSize={7}
          removeClippedSubviews={Platform.OS !== 'web'}
        />
      )}
        </ListPanelWrap>
        </View>
      </View>

      <TransactionModal
        visible={modalVisible}
        useDialogLayout={showPanelHeader}
        contasAtivas={contasAtivas}
        defaultContaId={defaultContaId}
        onClose={() => {
          setModalVisible(false);
          setEditingTransaction(null);
        }}
        transaction={editingTransaction}
        onSave={async (data) => {
          await handleSave(data);
          void refetchContas();
        }}
      />

      <MfConfirmDialog
        visible={deleteConfirmTx != null}
        title="Excluir transação"
        message={
          deleteConfirmTx?.classificacao
            ? `Excluir "${deleteConfirmTx.classificacao}"?`
            : 'Excluir esta transação?'
        }
        detail="Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        confirmIntent="danger"
        loading={deleteConfirmLoading}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          if (!deleteConfirmLoading) setDeleteConfirmTx(null);
        }}
      />

      <Modal
        visible={!!deleteScopeTx}
        transparent
        animationType="fade"
        onRequestClose={() => !deletingScope && setDeleteScopeTx(null)}
      >
        <View style={styles.scopeOverlay}>
          <View style={styles.scopeDialog}>
            <View style={styles.scopeHeader}>
              <Ionicons name="repeat" size={20} color={theme.primary} />
              <Text style={styles.scopeTitle}>Excluir lançamento recorrente</Text>
            </View>
            <Text style={styles.scopeMessage}>
              Esta transação faz parte de uma recorrência. O que deseja excluir?
            </Text>

            <TouchableOpacity
              style={[styles.scopeOption, deletingScope && styles.scopeOptionDisabled]}
              onPress={handleDeleteOnlyThis}
              disabled={deletingScope}
              activeOpacity={0.8}
            >
              <Ionicons name="document-text-outline" size={18} color={theme.text} />
              <View style={{ flex: 1 }}>
                <Text style={styles.scopeOptionTitle}>Apenas este lançamento</Text>
                <Text style={styles.scopeOptionHint}>
                  Outros meses (passados e futuros) continuam.
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.scopeOption, deletingScope && styles.scopeOptionDisabled]}
              onPress={handleDeleteFromHere}
              disabled={deletingScope}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-forward-circle-outline" size={18} color={theme.warning} />
              <View style={{ flex: 1 }}>
                <Text style={styles.scopeOptionTitle}>Este e os futuros</Text>
                <Text style={styles.scopeOptionHint}>
                  Remove esta data em diante e desativa a recorrência.
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.scopeOption, styles.scopeOptionDanger, deletingScope && styles.scopeOptionDisabled]}
              onPress={handleDeleteEntireRecurrence}
              disabled={deletingScope}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={18} color={theme.error} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.scopeOptionTitle, { color: theme.error }]}>
                  Toda a recorrência
                </Text>
                <Text style={styles.scopeOptionHint}>
                  Apaga todos os lançamentos vinculados e a recorrência.
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.scopeCancel}
              onPress={() => setDeleteScopeTx(null)}
              disabled={deletingScope}
              activeOpacity={0.7}
            >
              <Text style={styles.scopeCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Action sheet mobile — abre ao tocar "⋯" do card */}
      <Modal
        visible={!!actionSheetTx}
        transparent
        animationType="slide"
        onRequestClose={() => setActionSheetTx(null)}
      >
        <TouchableOpacity
          style={styles.actionSheetOverlay}
          activeOpacity={1}
          onPress={() => setActionSheetTx(null)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.actionSheet}>
            <View style={styles.actionSheetGrabber} />
            <View style={styles.actionSheetHeader}>
              <Text style={styles.actionSheetTitle}>{actionSheetTx?.classificacao || 'Transação'}</Text>
              {actionSheetTx?.obs ? (
                <Text style={styles.actionSheetSubtitle} numberOfLines={1}>{actionSheetTx.obs}</Text>
              ) : null}
            </View>
            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => {
                const tx = actionSheetTx;
                setActionSheetTx(null);
                if (tx) handleEdit(tx);
              }}
            >
              <Ionicons name="pencil-outline" size={20} color={theme.text} />
              <Text style={styles.actionSheetItemText}>Editar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => {
                const tx = actionSheetTx;
                setActionSheetTx(null);
                if (tx) handleDuplicate(tx);
              }}
            >
              <Ionicons name="copy-outline" size={20} color={theme.text} />
              <Text style={styles.actionSheetItemText}>Duplicar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => {
                const tx = actionSheetTx;
                setActionSheetTx(null);
                if (tx) handleDeleteTransaction(tx);
              }}
            >
              <Ionicons name="trash-outline" size={20} color={theme.error} />
              <Text style={[styles.actionSheetItemText, { color: theme.error }]}>Excluir</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionSheetCancel} onPress={() => setActionSheetTx(null)}>
              <Text style={styles.actionSheetCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (
  theme: ReturnType<typeof getTheme>,
  insideShellPanel = false,
  isDarkMode = false,
) => {
  const tokens = getTechTokens(isDarkMode);
  const webScroll = getWebScrollbarStyle(theme);
  const cardMarginH = insideShellPanel ? 8 : 20;
  const insetSurface = mfTechInsetSurface(isDarkMode, false);
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  monthNavMobile: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 20,
    gap: 8,
  },
  todayChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: tokens.accentSoft,
    borderWidth: 1,
    borderColor: tokens.insetBorder,
  },
  todayChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: tokens.accent,
  },
  shellMainColumn: {
    flex: 1,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    minHeight: 0,
    gap: mfSpacing.md,
  },
  unifiedPanel: {
    flex: 1,
    minHeight: 0,
    padding: mfSpacing.md,
    gap: mfSpacing.sm,
  },
  commandStack: {
    gap: mfSpacing.sm,
    marginBottom: mfSpacing.sm,
  },
  commandWell: {
    gap: mfSpacing.sm,
    padding: mfSpacing.sm,
  },
  filtersWell: {
    gap: mfSpacing.xs,
    padding: mfSpacing.sm,
    marginBottom: mfSpacing.xs,
  },
  searchContainerInPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    borderRadius: mfRadius.sm,
    borderWidth: 1,
    borderColor: tokens.insetBorder,
    backgroundColor: isDarkMode ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.35)',
  },
  pillsRowCombined: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 10,
    paddingRight: 8,
  },
  filterPillDivider: {
    width: 1,
    height: 22,
    backgroundColor: tokens.divider,
    marginHorizontal: 4,
  },
  desktopListPanelShell: {
    flex: 1,
    minWidth: 0,
    minHeight: 420,
    width: '100%',
  },
  mobileListPanel: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.text,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: theme.primaryLight,
  },
  addButton: {
    backgroundColor: theme.primary,
    borderRadius: 8,
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 20,
    marginBottom: 10,
    paddingLeft: 12,
    ...insetSurface,
  },
  searchContainerDesktop: {
    maxWidth: 1600,
    width: '100%',
    alignSelf: 'center',
    marginHorizontal: 20,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    padding: 12,
    paddingLeft: 0,
    fontSize: 16,
    color: theme.text,
  },
  scrollView: {
    flex: 1,
    ...webScroll,
  },
  desktopRow: {
    flex: 1,
    flexDirection: 'row',
    maxWidth: 1600,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 20,
  },
  desktopFormShell: {
    width: DESKTOP_FORM_PANEL_WIDTH,
    maxHeight: '88vh' as unknown as number,
    flexShrink: 0,
    overflow: 'hidden',
    ...mfTechPanelChrome(isDarkMode, 'surface'),
  },
  desktopFormPanel: {
    width: DESKTOP_FORM_PANEL_WIDTH,
    maxHeight: '88vh' as unknown as number,
    flexGrow: 0,
    flexShrink: 0,
    ...webScroll,
  },
  desktopFormScrollContent: {
    flexGrow: 1,
    paddingTop: 14,
    paddingBottom: 12,
    paddingHorizontal: 14,
  },
  // Painel direito: card único do histórico (visibilidade tipo dashboard).
  desktopListPanel: {
    flex: 1,
    minWidth: 0,
    ...(insideShellPanel ? {} : mfTechPanelChrome(isDarkMode, 'surface')),
    overflow: 'hidden',
  },
  historySummaryBlock: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
    paddingBottom: 4,
    marginBottom: 4,
  },
  filterGroup: {
    marginBottom: 8,
  },
    filterGroupLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: tokens.accent,
      letterSpacing: 1,
      textTransform: 'uppercase',
      paddingHorizontal: mfSpacing.xs,
      marginBottom: 6,
      marginTop: 2,
    },
  historyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  historyHeader: {
    flex: 1,
    minWidth: 0,
  },
  historyTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.text,
    letterSpacing: -0.6,
  },
  historySubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.textSecondary,
    marginTop: 4,
  },
  transactionCard: {
    backgroundColor: tokens.insetFill,
    marginHorizontal: cardMarginH,
    marginVertical: 4,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: mfRadius.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderColor: tokens.insetBorder,
  },
  categoryIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  transactionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  pillsScrollView: {
    flexGrow: 0,
  },
    pillsRowContent: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'nowrap',
      gap: Platform.OS === 'web' ? 6 : 8,
      paddingHorizontal: mfSpacing.xs,
      paddingVertical: 2,
    },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: Platform.OS === 'web' ? 4 : 6,
    paddingHorizontal: Platform.OS === 'web' ? 10 : 14,
    paddingVertical: Platform.OS === 'web' ? 6 : 10,
    minHeight: Platform.OS === 'web' ? undefined : 40,
    borderRadius: 999,
    backgroundColor: tokens.insetFill,
    borderWidth: 1,
    borderColor: tokens.insetBorder,
  },
  pillActive: {
    backgroundColor: tokens.accentSoft,
    borderColor: tokens.accent,
  },
  pillActiveEntrada: {
    backgroundColor: theme.successLight,
    borderColor: theme.success,
  },
  pillActiveSaida: {
    backgroundColor: theme.errorLight,
    borderColor: theme.error,
  },
  pillActivePago: {
    backgroundColor: theme.successLight,
    borderColor: theme.success,
  },
  pillActivePendente: {
    backgroundColor: theme.warning + '22',
    borderColor: theme.warning,
  },
  pillText: {
    fontSize: Platform.OS === 'web' ? 12 : 14,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  pillTextActive: {
    color: tokens.accent,
  },
  pillTextActiveEntrada: {
    color: theme.success,
  },
  pillTextActiveSaida: {
    color: theme.error,
  },
  pillTextActivePago: {
    color: theme.success,
  },
  pillTextActivePendente: {
    color: theme.warning,
  },
  dateSeparator: {
    marginHorizontal: cardMarginH,
    marginTop: 14,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  dateSeparatorTextLarge: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.text,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginHorizontal: 4,
  },
  dateSeparatorLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.border,
  },
  dateSeparatorText: {
    fontSize: 10,
    fontWeight: '700',
    color: tokens.accent,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    backgroundColor: tokens.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: mfRadius.sm,
    overflow: 'hidden',
  },
  quickMarkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 0,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: theme.success + '15',
    borderWidth: 1,
    borderColor: theme.success + '40',
  },
  quickMarkText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.success,
  },
  transactionCardProjected: {
    backgroundColor: theme.card,
    opacity: 0.65,
    borderWidth: 1,
    borderColor: theme.borderLight,
    borderStyle: 'dashed',
    shadowOpacity: 0,
    elevation: 0,
  },
  transactionCardHovered: {
    backgroundColor: tokens.accentSoft,
    borderColor: tokens.accentMuted,
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  confirmCard: {
    marginHorizontal: 20,
    marginVertical: 6,
    borderRadius: 12,
    flexDirection: 'row',
    overflow: 'hidden',
    minHeight: 80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  confirmHalfGreen: {
    flex: 1,
    backgroundColor: theme.success,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  confirmHalfRed: {
    flex: 1,
    backgroundColor: theme.error,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  confirmHalfText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  transactionTextProjected: {
    color: theme.textSecondary,
  },
  transactionValueProjected: {
    fontWeight: '600',
    opacity: 0.85,
  },
  virtualBadge: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: theme.background,
    borderWidth: 1,
    borderColor: theme.borderLight,
    alignSelf: 'flex-end',
  },
  virtualBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.textSecondary,
    letterSpacing: 0.3,
  },
  inflationBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: theme.warning + '15',
    borderLeftWidth: 3,
    borderLeftColor: theme.warning,
  },
  inflationBannerText: {
    flex: 1,
    fontSize: 12,
    color: theme.text,
    lineHeight: 17,
  },
  scopeOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  scopeDialog: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
  },
  scopeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  scopeTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.text,
  },
  scopeMessage: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 16,
    lineHeight: 19,
  },
  scopeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: theme.background,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 8,
  },
  scopeOptionDanger: {
    borderColor: theme.error + '55',
    backgroundColor: theme.error + '0D',
  },
  scopeOptionDisabled: {
    opacity: 0.5,
  },
  scopeOptionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },
  scopeOptionHint: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  scopeCancel: {
    marginTop: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  scopeCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    letterSpacing: -0.2,
  },
  transactionObs: {
    fontSize: 13,
    fontWeight: '400',
    color: theme.textSecondary,
    marginTop: 2,
  },
  transactionDate: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'lowercase',
  },
  contaBadge: {
    backgroundColor: theme.primaryLight,
    maxWidth: 140,
  },
  transactionDetails: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minHeight: 44,
    paddingTop: 2,
  },
  transactionValue: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: -0.3,
    textAlign: 'right',
  },
  /** Web: espaço fixo acima da faixa de ícones (sempre montada) para não saltar o layout no hover. */
  transactionValueWithWebActions: {
    marginBottom: 4,
  },
  incomeValue: {
    color: theme.success,
  },
  expenseValue: {
    color: theme.error,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  editButton: {
    padding: 4,
  },
  deleteButton: {
    padding: 4,
  },
  moreButton: {
    padding: 6,
    marginLeft: 4,
    opacity: 0.6,
  },
  actionSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 8,
    paddingBottom: 20,
  },
  actionSheetGrabber: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: theme.border,
    alignSelf: 'center',
    marginBottom: 10,
  },
  actionSheetHeader: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  actionSheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.text,
  },
  actionSheetSubtitle: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  actionSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  actionSheetItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
  },
  actionSheetCancel: {
    marginTop: 8,
    marginHorizontal: 20,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: theme.background,
  },
  actionSheetCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: theme.textSecondary,
  },
});
};

const createModalStyles = (theme: ReturnType<typeof getTheme>, useDialogLayout = false) => {
  const f = webUiFont();
  return StyleSheet.create({
  dialogOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    ...(Platform.OS === 'web'
      ? ({
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 10000,
        } as object)
      : {}),
  },
  dialogBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  dialogCard: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90vh' as unknown as number,
    zIndex: 1,
  },
  dialogCardInner: {
    flex: 1,
    maxHeight: '90vh' as unknown as number,
    borderRadius: mfRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 24px 48px rgba(0,0,0,0.35)' } as object)
      : {}),
  },
  dialogSafeArea: {
    flex: 1,
    maxHeight: '90vh' as unknown as number,
    backgroundColor: theme.card,
  },
  dialogContent: {
    flex: 1,
    minHeight: 0,
  },
  dialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: mfSpacing.lg,
    paddingTop: mfSpacing.lg,
    paddingBottom: mfSpacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  dialogTitle: {
    ...f,
    ...mfTypography.subtitle,
    fontSize: 18,
    color: theme.text,
    flex: 1,
  },
  dialogCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: mfRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.backgroundMuted,
  },
  dialogScroll: {
    flex: 1,
    minHeight: 0,
  },
  dialogBodyContent: {
    paddingHorizontal: mfSpacing.lg,
    paddingTop: mfSpacing.md,
    paddingBottom: mfSpacing.sm,
  },
  dialogFooter: {
    paddingHorizontal: mfSpacing.lg,
    paddingTop: mfSpacing.md,
    paddingBottom: mfSpacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    backgroundColor: theme.card,
  },
  modalFooterRow: {
    flexDirection: 'row',
    gap: mfSpacing.sm,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.surface,
    ...(useDialogLayout ? { borderRadius: mfRadius.lg } : {}),
  },
  modalContent: {
    flex: 1,
    backgroundColor: theme.surface,
  },
  modalBodyContent: {
    paddingBottom: 40,
    flexGrow: 1,
  },
  fieldSurface: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: mfRadius.md,
    paddingHorizontal: mfSpacing.md,
    paddingVertical: 12,
    backgroundColor: theme.backgroundMuted,
  },
  fieldInput: {
    ...f,
    fontSize: 15,
    fontWeight: '500',
    color: theme.inputText,
  },
  fieldTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
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
    ...f,
    fontSize: 22,
    fontWeight: '600',
    color: theme.text,
    textAlign: 'center',
  },
  modalBody: {
    flex: 1,
    padding: 20,
  },
  inputGroup: {
    marginBottom: mfSpacing.md,
  },
  label: {
    ...f,
    fontSize: 13,
    fontWeight: '500',
    color: theme.textSecondary,
    marginBottom: 6,
  },
  input: {
    ...f,
    borderWidth: 1,
    borderColor: theme.inputBorder,
    borderRadius: 8,
    padding: 14,
    fontSize: 17,
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
    ...f,
    fontSize: 17,
    fontWeight: '600',
    color: theme.text,
    marginRight: 4,
  },
  currencyInput: {
    ...f,
    flex: 1,
    padding: 14,
    fontSize: 17,
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
  typeButtonEntradaActive: {
    backgroundColor: theme.success,
    borderColor: theme.success,
  },
  typeButtonSaidaActive: {
    backgroundColor: theme.error,
    borderColor: theme.error,
  },
  typeButtonRealizadoActive: {
    backgroundColor: theme.success,
    borderColor: theme.success,
  },
  typeButtonPendenteActive: {
    backgroundColor: theme.warning,
    borderColor: theme.warning,
  },
  typeButtonText: {
    ...f,
    fontSize: 16,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  typeButtonTextActive: {
    color: '#FFFFFF',
  },
  recurrenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: mfSpacing.md,
    borderRadius: mfRadius.md,
    backgroundColor: theme.backgroundMuted,
    borderWidth: 1,
    borderColor: theme.border,
  },
  recurrenceRowOn: {
    borderColor: theme.primary + '66',
    backgroundColor: theme.primaryLight,
  },
  recurrenceIconWrap: {
    width: 32,
    height: 32,
    borderRadius: mfRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.card,
  },
  recurrenceIconWrapOn: {
    backgroundColor: theme.card,
  },
  recurrenceToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  recurrenceToggleTitle: {
    ...f,
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },
  recurrenceToggleHint: {
    ...f,
    fontSize: 12,
    lineHeight: 17,
    color: theme.textSecondary,
    marginTop: 2,
  },
  recurrenceCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  recurrenceCheckboxOn: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  recurrenceDurationBox: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: theme.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  recurrenceDurationLabel: {
    ...f,
    fontSize: 15,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 8,
  },
  recurrenceHintInline: {
    ...f,
    fontSize: 14,
    lineHeight: 21,
    fontStyle: 'italic',
    color: theme.warning,
    marginBottom: 8,
    marginTop: -4,
  },
  recurrencePillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  recurrencePill: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: theme.background,
    borderWidth: 1,
    borderColor: theme.border,
  },
  recurrencePillActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  recurrencePillText: {
    ...f,
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
  },
  recurrencePillTextActive: {
    color: '#FFFFFF',
  },
  recurrenceCustomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  recurrenceCustomLabel: {
    ...f,
    fontSize: 15,
    color: theme.text,
  },
  recurrenceCustomInput: {
    width: 80,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    backgroundColor: theme.background,
    color: theme.text,
    ...f,
    fontSize: 16,
    textAlign: 'center',
  },
  recurrenceSummary: {
    ...f,
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: theme.textSecondary,
    fontStyle: 'italic',
  },
  inflationNote: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: theme.warning + '15', // tinta translúcida
    borderLeftWidth: 3,
    borderLeftColor: theme.warning,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  inflationNoteText: {
    ...f,
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: theme.text,
  },
  saveButton: {
    backgroundColor: theme.primary,
    paddingVertical: 14,
    borderRadius: mfRadius.md,
    alignItems: 'center',
    marginTop: useDialogLayout ? 0 : 10,
  },
  saveButtonText: {
    ...f,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  duplicateFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
  },
  modalCancelOutline: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
  },
  modalCancelOutlineText: {
    ...f,
    fontSize: 17,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  saveButtonPrimaryFlex: {
    flex: 1,
    backgroundColor: theme.primary,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoriaSelector: {
    borderWidth: 1,
    borderColor: theme.inputBorder,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.inputBackground,
  },
  categoriaText: {
    ...f,
    flex: 1,
    fontSize: 17,
    color: theme.inputText,
  },
  categoriaPlaceholder: {
    color: theme.placeholder,
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownContainer: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    width: '90%',
    maxHeight: '70%',
    overflow: 'hidden',
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  dropdownTitle: {
    ...f,
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
  },
  dropdownList: {
    maxHeight: 400,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.background,
  },
  dropdownItemSelected: {
    backgroundColor: theme.primaryLight,
  },
  dropdownItemText: {
    ...f,
    fontSize: 17,
    color: theme.text,
  },
  dropdownItemTextSelected: {
    ...f,
    color: theme.primary,
    fontWeight: '600',
  },
  dropdownEmpty: {
    padding: 40,
    alignItems: 'center',
  },
  dropdownEmptyText: {
    ...f,
    fontSize: 15,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  dateInputContainer: {
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  dateWeekdayPrefix: {
    ...f,
    paddingLeft: 4,
    paddingRight: 4,
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  dateInput: {
    ...f,
    flex: 1,
    paddingVertical: 0,
    paddingHorizontal: 0,
    fontSize: 15,
    color: theme.inputText,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  calendarIconButton: {
    padding: 8,
    marginLeft: 4,
    borderLeftWidth: 1,
    borderLeftColor: theme.border,
  },
  calendarOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarContainer: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    width: '90%',
    maxWidth: 400,
    overflow: 'hidden',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  calendarTitle: {
    ...f,
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
  },
  calendarFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    gap: 10,
  },
  calendarButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: theme.primary,
    alignItems: 'center',
  },
  calendarButtonClear: {
    backgroundColor: theme.background,
  },
  calendarButtonText: {
    ...f,
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  calendarButtonTextClear: {
    ...f,
    color: theme.text,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
    paddingBottom: 12,
  },
  characterCount: {
    ...f,
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'right',
    marginTop: 4,
  },
  });
};

