import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMfTheme } from '../../components/ui/useMfTheme';
import { mfRadius, mfSpacing, mfTypography } from '../../lib/theme';
import { formatCurrencyInput, parseNumberBR } from '../../lib/numberFormat';
import { getTechTokens, mfTechInsetSurface, mfTechPanelChrome } from '../../lib/techDesign';
import { getWebScrollbarStyle, WEB_SCROLL_Y_CLASS } from '../../lib/webScrollbar';
import {
  CONTA_COR_PRESETS,
  CONTA_TIPO_OPTIONS,
  type ContaFinanceira,
  type ContaFinanceiraInput,
  type ContaFinanceiraTipo,
} from '../../lib/contaFinanceiraTypes';
import {
  CUSTOM_BANK_ID,
  findBankById,
  findBankByNome,
  type BankCatalogEntry,
} from '../../lib/bankCatalog';
import { BankPickerGrid } from '../../components/contas/BankPickerGrid';
import { BankIcon } from '../../components/contas/BankIcon';
import { DEFAULT_CONTA_NOME } from '../../lib/contaFinanceiraDefault';

function parseMoneyInput(text: string): number {
  const cleaned = text.replace(/R\$\s?/gi, '').trim();
  return parseNumberBR(cleaned);
}

type Props = {
  visible: boolean;
  conta?: ContaFinanceira | null;
  onClose: () => void;
  onSave: (input: ContaFinanceiraInput, id?: string) => Promise<void>;
  useDialogLayout?: boolean;
};

export function ContaModal({
  visible,
  conta,
  onClose,
  onSave,
  useDialogLayout = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useMfTheme();
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode]);
  const { width } = useWindowDimensions();
  const isNative = Platform.OS !== 'web';
  const isWebDialog = useDialogLayout && Platform.OS === 'web';
  const styles = useMemo(
    () => createStyles(theme, tokens, isDarkMode, isNative, width),
    [theme, tokens, isDarkMode, isNative, width],
  );
  const fieldInset = useMemo(() => mfTechInsetSurface(isDarkMode, false), [isDarkMode]);
  const panelChrome = useMemo(() => mfTechPanelChrome(isDarkMode, 'surface'), [isDarkMode]);

  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<ContaFinanceiraTipo>('corrente');
  const [saldoStr, setSaldoStr] = useState('R$ 0,00');
  const [limiteStr, setLimiteStr] = useState('');
  const [diaFechamento, setDiaFechamento] = useState('');
  const [diaVencimento, setDiaVencimento] = useState('');
  const [cor, setCor] = useState<string>(CONTA_COR_PRESETS[0]);
  const [instituicaoId, setInstituicaoId] = useState<string | null>(null);
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [showBankPicker, setShowBankPicker] = useState(true);
  const [saving, setSaving] = useState(false);

  const isCustomAccount = selectedBankId === CUSTOM_BANK_ID;
  const isCatalogAccount =
    selectedBankId != null && selectedBankId !== CUSTOM_BANK_ID;
  const selectedBank = findBankById(selectedBankId);

  const applyBank = (bank: BankCatalogEntry) => {
    setSelectedBankId(bank.id);
    setInstituicaoId(bank.id);
    setNome(bank.nome);
    setCor(bank.cor);
    if (bank.defaultTipo) setTipo(bank.defaultTipo);
    setShowBankPicker(false);
  };

  const applyCustom = () => {
    setSelectedBankId(CUSTOM_BANK_ID);
    setInstituicaoId(null);
    setNome((prev) => prev.trim() || DEFAULT_CONTA_NOME);
    setTipo('dinheiro');
    setShowBankPicker(false);
  };

  useEffect(() => {
    if (!visible) return;
    if (conta) {
      setNome(conta.nome);
      setTipo(conta.tipo);
      const saldoFmt = conta.saldo_inicial.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      setSaldoStr(`R$ ${saldoFmt}`);
      if (conta.limite_credito != null) {
        const limFmt = conta.limite_credito.toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        setLimiteStr(`R$ ${limFmt}`);
      } else {
        setLimiteStr('');
      }
      setDiaFechamento(conta.dia_fechamento != null ? String(conta.dia_fechamento) : '');
      setDiaVencimento(conta.dia_vencimento != null ? String(conta.dia_vencimento) : '');
      setCor(conta.cor || CONTA_COR_PRESETS[0]);
      const bank =
        findBankById(conta.instituicao_id) ?? findBankByNome(conta.nome);
      if (bank) {
        setSelectedBankId(bank.id);
        setInstituicaoId(bank.id);
        setShowBankPicker(false);
      } else {
        setSelectedBankId(CUSTOM_BANK_ID);
        setInstituicaoId(conta.instituicao_id);
        setShowBankPicker(false);
      }
    } else {
      setNome(DEFAULT_CONTA_NOME);
      setTipo('dinheiro');
      setSaldoStr('R$ 0,00');
      setLimiteStr('');
      setDiaFechamento('');
      setDiaVencimento('');
      setCor(CONTA_COR_PRESETS[0]);
      setInstituicaoId(null);
      setSelectedBankId(null);
      setShowBankPicker(true);
    }
  }, [visible, conta]);

  const isCartao = tipo === 'cartao_credito';
  const title = conta ? 'Editar conta' : 'Nova conta';
  const eyebrow = conta ? 'Conta' : 'Cadastro';

  const handleSave = async () => {
    if (!conta && !selectedBankId) {
      Alert.alert('Atenção', 'Escolha um banco na lista ou toque em "Outra conta".');
      return;
    }
    const nomeTrim = nome.trim();
    if (!nomeTrim) {
      Alert.alert('Atenção', 'Informe um nome para a conta.');
      return;
    }
    const saldo = parseMoneyInput(saldoStr);
    if (saldo == null || Number.isNaN(saldo)) {
      Alert.alert('Atenção', 'Saldo inicial inválido.');
      return;
    }
    let limite: number | null = null;
    if (isCartao && limiteStr.trim()) {
      limite = parseMoneyInput(limiteStr);
      if (limite == null || Number.isNaN(limite)) {
        Alert.alert('Atenção', 'Limite do cartão inválido.');
        return;
      }
    }
    const parseDia = (s: string) => {
      if (!s.trim()) return null;
      const n = parseInt(s, 10);
      if (!Number.isInteger(n) || n < 1 || n > 31) return null;
      return n;
    };
    const payload: ContaFinanceiraInput = {
      nome: nomeTrim,
      tipo,
      saldo_inicial: saldo,
      limite_credito: isCartao ? limite : null,
      dia_fechamento: isCartao ? parseDia(diaFechamento) : null,
      dia_vencimento: isCartao ? parseDia(diaVencimento) : null,
      cor,
      instituicao_id: isCatalogAccount ? instituicaoId : null,
      ativo: true,
    };
    setSaving(true);
    try {
      await onSave(payload, conta?.id);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const saveButton = (
    <TouchableOpacity
      style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
      onPress={handleSave}
      disabled={saving}
      accessibilityRole="button"
      accessibilityLabel="Salvar conta"
    >
      <Text style={styles.saveBtnText}>{saving ? 'Salvando…' : 'Salvar conta'}</Text>
    </TouchableOpacity>
  );

  const body = (
    <>
      {!conta || showBankPicker ? (
        <BankPickerGrid
          selectedBankId={selectedBankId}
          onSelectBank={applyBank}
          onSelectCustom={applyCustom}
        />
      ) : null}

      {selectedBankId && !showBankPicker ? (
        <TouchableOpacity
          style={[styles.selectedBankRow, fieldInset]}
          onPress={() => setShowBankPicker(true)}
          accessibilityRole="button"
          accessibilityLabel="Trocar banco"
        >
          <BankIcon
            instituicaoId={isCatalogAccount ? instituicaoId : null}
            nome={nome}
            cor={cor}
            size={40}
          />
          <View style={styles.selectedBankText}>
            <Text style={styles.selectedBankName} numberOfLines={1}>
              {isCustomAccount ? nome.trim() || 'Conta personalizada' : selectedBank?.nome ?? nome}
            </Text>
            <Text style={styles.selectedBankHint}>Toque para trocar</Text>
          </View>
          <Ionicons name="swap-horizontal" size={18} color={tokens.accent} />
        </TouchableOpacity>
      ) : null}

      {isCustomAccount || (conta && !isCatalogAccount) ? (
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nome da conta</Text>
          <TextInput
            style={[styles.fieldInput, fieldInset]}
            value={nome}
            onChangeText={setNome}
            placeholder="Ex.: Carteira, Cofre, Visa empresa"
            placeholderTextColor={theme.placeholder}
          />
        </View>
      ) : null}

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Tipo</Text>
        <View style={styles.tipoWrap}>
          {CONTA_TIPO_OPTIONS.map((o) => {
            const active = tipo === o.key;
            return (
              <TouchableOpacity
                key={o.key}
                style={[styles.tipoChip, fieldInset, active && styles.tipoChipActive]}
                onPress={() => setTipo(o.key)}
              >
                <Text style={[styles.tipoChipText, active && styles.tipoChipTextActive]}>
                  {o.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>{isCartao ? 'Fatura atual / saldo' : 'Saldo inicial'}</Text>
        <TextInput
          style={[styles.fieldInput, fieldInset]}
          value={saldoStr}
          onChangeText={(t) => setSaldoStr(formatCurrencyInput(t))}
          keyboardType="decimal-pad"
          placeholder="R$ 0,00"
          placeholderTextColor={theme.placeholder}
        />
        <Text style={styles.hint}>
          {isCartao
            ? 'Use valor negativo se a fatura estiver em aberto.'
            : 'Valor no dia em que você passou a usar o app.'}
        </Text>
      </View>

      {isCartao ? (
        <>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Limite (opcional)</Text>
            <TextInput
              style={[styles.fieldInput, fieldInset]}
              value={limiteStr}
              onChangeText={(t) => setLimiteStr(formatCurrencyInput(t))}
              keyboardType="decimal-pad"
              placeholder="R$ 0,00"
              placeholderTextColor={theme.placeholder}
            />
          </View>
          <View style={styles.row2}>
            <View style={[styles.inputGroup, styles.flex1]}>
              <Text style={styles.label}>Fechamento (dia)</Text>
              <TextInput
                style={[styles.fieldInput, fieldInset]}
                value={diaFechamento}
                onChangeText={setDiaFechamento}
                keyboardType="number-pad"
                placeholder="1–31"
                placeholderTextColor={theme.placeholder}
                maxLength={2}
              />
            </View>
            <View style={[styles.inputGroup, styles.flex1]}>
              <Text style={styles.label}>Vencimento (dia)</Text>
              <TextInput
                style={[styles.fieldInput, fieldInset]}
                value={diaVencimento}
                onChangeText={setDiaVencimento}
                keyboardType="number-pad"
                placeholder="1–31"
                placeholderTextColor={theme.placeholder}
                maxLength={2}
              />
            </View>
          </View>
        </>
      ) : null}

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Cor</Text>
        <View style={styles.colorRow}>
          {CONTA_COR_PRESETS.map((c) => (
            <TouchableOpacity
              key={c}
              onPress={() => setCor(c)}
              style={[
                styles.colorDot,
                { backgroundColor: c },
                cor === c && styles.colorDotSelected,
              ]}
              accessibilityLabel={`Cor ${c}`}
              accessibilityState={{ selected: cor === c }}
            />
          ))}
        </View>
      </View>
    </>
  );

  const header = (
    <View style={styles.header}>
      <View style={styles.headerTextCol}>
        <View style={styles.eyebrowRow}>
          <View style={[styles.dot, { backgroundColor: tokens.accent }]} />
          <Text style={[styles.eyebrow, { color: tokens.accent }]}>{eyebrow}</Text>
        </View>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>
      <TouchableOpacity
        onPress={onClose}
        style={styles.closeBtn}
        accessibilityLabel="Fechar"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close" size={22} color={theme.textSecondary} />
      </TouchableOpacity>
    </View>
  );

  const scrollBody = (
    <ScrollView
      style={[styles.scroll, Platform.OS === 'web' ? getWebScrollbarStyle(theme) : null]}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={!isWebDialog}
      nestedScrollEnabled
      {...(Platform.OS === 'web' ? { className: WEB_SCROLL_Y_CLASS } : {})}
    >
      {body}
    </ScrollView>
  );

  if (isWebDialog) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <View style={styles.dialogOverlay}>
          <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fechar" />
          <View style={styles.dialogShell} pointerEvents="box-none">
            <View style={[styles.dialogCard, panelChrome]} pointerEvents="auto">
              {header}
              {scrollBody}
              <View style={styles.dialogFooter}>{saveButton}</View>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType={isNative ? 'slide' : 'fade'}
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={[styles.fullRoot, { paddingTop: insets.top }]}>
        {header}
        {scrollBody}
        <View style={[styles.fullFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {saveButton}
        </View>
      </View>
    </Modal>
  );
}

function createStyles(
  theme: ReturnType<typeof useMfTheme>['theme'],
  tokens: ReturnType<typeof getTechTokens>,
  isDarkMode: boolean,
  isNative: boolean,
  windowWidth: number,
) {
  const dialogMaxWidth = windowWidth >= 640 ? 520 : '100%';

  return StyleSheet.create({
    dialogOverlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: mfSpacing.lg,
      paddingTop: 72,
      paddingBottom: mfSpacing.xl,
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
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.72)' : 'rgba(15, 23, 42, 0.55)',
    },
    dialogShell: {
      width: '100%',
      maxWidth: dialogMaxWidth,
      maxHeight: '85vh' as unknown as number,
      zIndex: 1,
    },
    dialogCard: {
      width: '100%',
      maxHeight: '85vh' as unknown as number,
      overflow: 'hidden',
      flexDirection: 'column',
      ...(Platform.OS === 'web'
        ? ({ boxShadow: '0 24px 48px rgba(0, 0, 0, 0.45)' } as object)
        : {}),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: mfSpacing.md,
      paddingHorizontal: mfSpacing.lg,
      paddingTop: mfSpacing.md,
      paddingBottom: mfSpacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tokens.insetBorder,
    },
    headerTextCol: {
      flex: 1,
      minWidth: 0,
    },
    eyebrowRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
    },
    dot: {
      width: 5,
      height: 5,
      borderRadius: 3,
    },
    eyebrow: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.1,
      textTransform: 'uppercase',
    },
    headerTitle: {
      ...mfTypography.subtitle,
      fontSize: isNative ? 20 : 18,
      color: theme.text,
      fontWeight: '700',
      letterSpacing: -0.3,
    },
    closeBtn: {
      width: isNative ? 40 : 36,
      height: isNative ? 40 : 36,
      borderRadius: mfRadius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tokens.insetFill,
      borderWidth: 1,
      borderColor: tokens.insetBorder,
      flexShrink: 0,
      alignSelf: 'center',
    },
    fullRoot: {
      flex: 1,
      backgroundColor: isDarkMode ? '#0a0f16' : theme.background,
    },
    scroll: {
      flexGrow: 1,
      flexShrink: 1,
      minHeight: 0,
    },
    scrollContent: {
      padding: mfSpacing.lg,
      gap: mfSpacing.md,
      paddingBottom: mfSpacing.xl,
    },
    dialogFooter: {
      paddingHorizontal: mfSpacing.lg,
      paddingTop: mfSpacing.md,
      paddingBottom: mfSpacing.lg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: tokens.insetBorder,
    },
    fullFooter: {
      padding: mfSpacing.lg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: tokens.insetBorder,
      backgroundColor: isDarkMode ? '#0a0f16' : theme.surface,
    },
    inputGroup: { gap: 6 },
    flex1: { flex: 1 },
    row2: { flexDirection: 'row', gap: mfSpacing.md },
    label: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    hint: { fontSize: 12, color: theme.textTertiary, marginTop: 4 },
    fieldInput: {
      paddingHorizontal: 14,
      paddingVertical: isNative ? 13 : 11,
      fontSize: isNative ? 16 : 15,
      color: theme.text,
      minHeight: isNative ? 48 : undefined,
      ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
    },
    colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    colorDot: { width: isNative ? 36 : 32, height: isNative ? 36 : 32, borderRadius: 999 },
    colorDotSelected: { borderWidth: 3, borderColor: tokens.accent },
    tipoWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    tipoChip: {
      paddingHorizontal: 12,
      paddingVertical: isNative ? 10 : 8,
      borderRadius: 999,
      minHeight: isNative ? 40 : undefined,
      justifyContent: 'center',
    },
    tipoChipActive: {
      borderColor: tokens.accent,
      backgroundColor: tokens.accentSoft,
    },
    tipoChipText: { fontSize: 13, color: theme.textSecondary, fontWeight: '500' },
    tipoChipTextActive: { color: tokens.accent, fontWeight: '700' },
    selectedBankRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: isNative ? 14 : 12,
    },
    selectedBankText: { flex: 1, gap: 2, minWidth: 0 },
    selectedBankName: { fontSize: 15, fontWeight: '600', color: theme.text },
    selectedBankHint: { fontSize: 12, color: theme.textTertiary },
    saveBtn: {
      backgroundColor: tokens.accent,
      paddingVertical: isNative ? 15 : 14,
      borderRadius: mfRadius.sm,
      alignItems: 'center',
      minHeight: isNative ? 50 : 48,
      justifyContent: 'center',
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : {}),
    },
    saveBtnDisabled: { opacity: 0.55 },
    saveBtnText: {
      color: isDarkMode ? '#041018' : '#FFFFFF',
      fontWeight: '700',
      fontSize: isNative ? 16 : 15,
    },
  });
}
