import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Pressable,
  KeyboardAvoidingView,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMfTheme } from '../../components/ui/useMfTheme';
import { mfRadius, mfSpacing, mfTypography } from '../../lib/theme';
import { getCategorySliceColorForId } from '../../lib/categoryColors';
import { getCategoryIconName } from '../../lib/categoryIcons';
import { getTechTokens, mfTechInsetSurface, mfTechPanelChrome } from '../../lib/techDesign';
import { getWebScrollbarStyle, WEB_SCROLL_Y_CLASS } from '../../lib/webScrollbar';

function formatCentsDisplay(digits: string): string {
  if (!digits) return '';
  const numeric = Number(digits);
  if (Number.isNaN(numeric)) return '';
  const value = numeric / 100;
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

type Categoria = {
  id: number;
  nome: string;
  tipo: string;
  user_id: string | null;
};

type Props = {
  visible: boolean;
  categorias: Categoria[];
  currentCategoria?: Categoria | null;
  currentValue?: number | null;
  onClose: () => void;
  onSave: (data: { categorias_id: number; valor_orcado: number | null }) => void;
  useDialogLayout?: boolean;
};

export function BudgetModal({
  visible,
  categorias,
  currentCategoria,
  currentValue,
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

  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [valorOrcadoDigits, setValorOrcadoDigits] = useState('');

  const styles = useMemo(
    () => createStyles(theme, tokens, isDarkMode, isNative, width),
    [theme, tokens, isDarkMode, isNative, width],
  );
  const fieldInset = useMemo(() => mfTechInsetSurface(isDarkMode, false), [isDarkMode]);
  const panelChrome = useMemo(() => mfTechPanelChrome(isDarkMode, 'surface'), [isDarkMode]);
  const listInset = useMemo(() => mfTechInsetSurface(isDarkMode, true), [isDarkMode]);

  const isEditing = !!currentCategoria;
  const title = isEditing ? 'Editar orçamento' : 'Novo orçamento';
  const eyebrow = isEditing ? 'Orçamento' : 'Planejamento';

  useEffect(() => {
    if (!visible) return;
    setSelectedCategoryId(currentCategoria ? currentCategoria.id : null);
    if (typeof currentValue === 'number') {
      const cents = Math.round(currentValue * 100);
      setValorOrcadoDigits(cents > 0 ? String(cents) : '0');
    } else {
      setValorOrcadoDigits('');
    }
  }, [visible, currentCategoria, currentValue]);

  const handleValorChange = (text: string) => {
    setValorOrcadoDigits(text.replace(/\D/g, ''));
  };

  const handleSave = () => {
    if (!selectedCategoryId) {
      Alert.alert('Erro', 'Selecione uma categoria');
      return;
    }
    if (!valorOrcadoDigits) {
      Alert.alert('Erro', 'Informe um valor orçado');
      return;
    }
    const parsed = Number(valorOrcadoDigits) / 100;
    if (Number.isNaN(parsed)) {
      Alert.alert('Erro', 'Informe um valor numérico válido');
      return;
    }
    onSave({ categorias_id: selectedCategoryId, valor_orcado: parsed });
    onClose();
  };

  const saveButton = (
    <TouchableOpacity
      style={styles.saveBtn}
      onPress={handleSave}
      accessibilityRole="button"
      accessibilityLabel="Salvar orçamento"
    >
      <Text style={styles.saveBtnText}>Salvar orçamento</Text>
    </TouchableOpacity>
  );

  const categorySection = (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>Categoria</Text>
      {isEditing && currentCategoria ? (
        <View style={[styles.selectedCategory, fieldInset]}>
          <View
            style={[
              styles.catIcon,
              {
                backgroundColor: `${getCategorySliceColorForId(currentCategoria.id, isDarkMode)}22`,
                borderColor: `${getCategorySliceColorForId(currentCategoria.id, isDarkMode)}44`,
              },
            ]}
          >
            <Ionicons
              name={getCategoryIconName(currentCategoria.nome)}
              size={16}
              color={getCategorySliceColorForId(currentCategoria.id, isDarkMode)}
            />
          </View>
          <Text style={styles.selectedCategoryText}>{currentCategoria.nome}</Text>
        </View>
      ) : (
        <View style={[styles.categoryListWrap, listInset]}>
          <ScrollView
            style={styles.categoryList}
            contentContainerStyle={styles.categoryListContent}
            nestedScrollEnabled
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
            {...(Platform.OS === 'web' ? { className: WEB_SCROLL_Y_CLASS } : {})}
          >
            {categorias.map((cat) => {
              const isSelected = selectedCategoryId === cat.id;
              const accent = getCategorySliceColorForId(cat.id, isDarkMode);
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryItem,
                    isSelected && {
                      borderColor: accent,
                      backgroundColor: `${accent}18`,
                    },
                  ]}
                  onPress={() => setSelectedCategoryId(cat.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                >
                  <View
                    style={[
                      styles.catIcon,
                      { backgroundColor: `${accent}22`, borderColor: `${accent}44` },
                    ]}
                  >
                    <Ionicons name={getCategoryIconName(cat.nome)} size={16} color={accent} />
                  </View>
                  <Text
                    style={[
                      styles.categoryItemText,
                      isSelected && { color: accent, fontWeight: '700' },
                    ]}
                    numberOfLines={1}
                  >
                    {cat.nome}
                  </Text>
                  {isSelected ? (
                    <Ionicons name="checkmark-circle" size={18} color={accent} />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );

  const formBody = (
    <>
      {categorySection}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Valor orçado</Text>
        <TextInput
          style={[styles.fieldInput, fieldInset]}
          placeholder="Ex: R$ 1.500,00"
          placeholderTextColor={theme.placeholder}
          keyboardType="numeric"
          value={formatCentsDisplay(valorOrcadoDigits)}
          onChangeText={handleValorChange}
        />
      </View>
    </>
  );

  const header = (
    <View style={styles.header}>
      {!isWebDialog ? (
        <TouchableOpacity
          onPress={onClose}
          style={styles.headerIconBtn}
          accessibilityLabel="Voltar"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
      ) : (
        <View style={styles.headerSpacer} />
      )}
      <View style={styles.headerTextCol}>
        {isWebDialog ? (
          <View style={styles.eyebrowRow}>
            <View style={[styles.dot, { backgroundColor: tokens.accent }]} />
            <Text style={[styles.eyebrow, { color: tokens.accent }]}>{eyebrow}</Text>
          </View>
        ) : null}
        <Text style={styles.headerTitle}>{title}</Text>
      </View>
      {isWebDialog ? (
        <TouchableOpacity
          onPress={onClose}
          style={styles.headerIconBtn}
          accessibilityLabel="Fechar"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={22} color={theme.textSecondary} />
        </TouchableOpacity>
      ) : (
        <View style={styles.headerSpacer} />
      )}
    </View>
  );

  const scrollBody = (
    <ScrollView
      style={[styles.scroll, Platform.OS === 'web' ? getWebScrollbarStyle(theme) : null]}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={!isWebDialog}
      {...(Platform.OS === 'web' ? { className: WEB_SCROLL_Y_CLASS } : {})}
    >
      {formBody}
      {!isWebDialog ? saveButton : null}
    </ScrollView>
  );

  if (isWebDialog) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
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
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.fullRoot} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.fullFlex}
        >
          {header}
          {scrollBody}
          <View style={[styles.fullFooter, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            {saveButton}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
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
  const dialogMaxWidth = windowWidth >= 640 ? 480 : '100%';

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
      maxHeight: '85vh' as unknown as number,
      overflow: 'hidden',
      ...(Platform.OS === 'web'
        ? ({ boxShadow: '0 24px 48px rgba(0, 0, 0, 0.45)' } as object)
        : {}),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: mfSpacing.sm,
      paddingHorizontal: mfSpacing.lg,
      paddingTop: mfSpacing.md,
      paddingBottom: mfSpacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tokens.insetBorder,
    },
    headerSpacer: {
      width: 40,
      height: 40,
    },
    headerIconBtn: {
      width: 40,
      height: 40,
      borderRadius: mfRadius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tokens.insetFill,
      borderWidth: 1,
      borderColor: tokens.insetBorder,
      flexShrink: 0,
    },
    headerTextCol: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
    },
    eyebrowRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
      alignSelf: 'flex-start',
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
      fontSize: isNative ? 18 : 17,
      fontWeight: '700',
      color: theme.text,
      textAlign: 'center',
      letterSpacing: -0.3,
    },
    fullRoot: {
      flex: 1,
      backgroundColor: isDarkMode ? '#0a0f16' : theme.background,
    },
    fullFlex: {
      flex: 1,
    },
    scroll: {
      flex: 1,
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
      paddingHorizontal: mfSpacing.lg,
      paddingTop: mfSpacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: tokens.insetBorder,
      backgroundColor: isDarkMode ? '#0a0f16' : theme.surface,
    },
    inputGroup: {
      gap: 8,
    },
    label: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.textSecondary,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    categoryListWrap: {
      maxHeight: isNative ? 280 : 240,
      overflow: 'hidden',
    },
    categoryList: {
      flexGrow: 0,
    },
    categoryListContent: {
      padding: mfSpacing.sm,
      gap: mfSpacing.xs,
    },
    categoryItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: mfSpacing.sm,
      paddingVertical: mfSpacing.sm,
      paddingHorizontal: mfSpacing.sm,
      borderRadius: mfRadius.sm,
      borderWidth: 1,
      borderColor: tokens.insetBorder,
      backgroundColor: 'transparent',
    },
    categoryItemText: {
      flex: 1,
      fontSize: 14,
      color: theme.text,
      minWidth: 0,
    },
    catIcon: {
      width: 32,
      height: 32,
      borderRadius: mfRadius.sm,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    selectedCategory: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: mfSpacing.sm,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    selectedCategoryText: {
      ...mfTypography.bodyStrong,
      color: theme.text,
      flex: 1,
    },
    fieldInput: {
      paddingHorizontal: 14,
      paddingVertical: isNative ? 13 : 11,
      fontSize: isNative ? 16 : 15,
      color: theme.text,
      minHeight: isNative ? 48 : 44,
      ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
    },
    saveBtn: {
      backgroundColor: tokens.accent,
      paddingVertical: isNative ? 15 : 14,
      borderRadius: mfRadius.sm,
      alignItems: 'center',
      minHeight: isNative ? 50 : 48,
      justifyContent: 'center',
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : {}),
    },
    saveBtnText: {
      color: isDarkMode ? '#041018' : '#FFFFFF',
      fontWeight: '700',
      fontSize: isNative ? 16 : 15,
    },
  });
}
