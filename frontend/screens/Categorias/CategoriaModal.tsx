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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MfSegmented } from '../../components/ui';
import { useMfTheme } from '../../components/ui/useMfTheme';
import { mfRadius, mfSpacing, mfTypography } from '../../lib/theme';
import { getTechTokens, mfTechInsetSurface, mfTechPanelChrome } from '../../lib/techDesign';
import { getWebScrollbarStyle, WEB_SCROLL_Y_CLASS } from '../../lib/webScrollbar';

type Categoria = {
  id: number;
  nome: string;
  tipo: string;
  user_id: string | null;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onSave: (cat: { id?: number; nome: string; tipo: string }) => void;
  categoria?: Categoria | null;
  useDialogLayout?: boolean;
};

export function CategoriaModal({
  visible,
  onClose,
  onSave,
  categoria,
  useDialogLayout = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useMfTheme();
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode]);
  const { width } = useWindowDimensions();
  const isNative = Platform.OS !== 'web';
  const isWebDialog = useDialogLayout && Platform.OS === 'web';

  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<'entrada' | 'saida'>('saida');

  const styles = useMemo(
    () => createStyles(theme, tokens, isDarkMode, isNative, width),
    [theme, tokens, isDarkMode, isNative, width],
  );
  const fieldInset = useMemo(() => mfTechInsetSurface(isDarkMode, false), [isDarkMode]);
  const panelChrome = useMemo(() => mfTechPanelChrome(isDarkMode, 'surface'), [isDarkMode]);

  useEffect(() => {
    if (!visible) return;
    if (categoria) {
      setNome(categoria.nome);
      setTipo(categoria.tipo === 'entrada' ? 'entrada' : 'saida');
    } else {
      setNome('');
      setTipo('saida');
    }
  }, [visible, categoria]);

  const title = categoria ? 'Editar categoria' : 'Nova categoria';
  const eyebrow = categoria ? 'Categoria' : 'Cadastro';

  const handleSave = () => {
    const trimmed = nome.trim();
    if (!trimmed) return;
    onSave({
      ...(categoria?.id ? { id: categoria.id } : {}),
      nome: trimmed,
      tipo,
    });
    onClose();
  };

  const saveButton = (
    <TouchableOpacity
      style={styles.saveBtn}
      onPress={handleSave}
      accessibilityRole="button"
      accessibilityLabel={categoria ? 'Salvar alterações' : 'Criar categoria'}
    >
      <Text style={styles.saveBtnText}>
        {categoria ? 'Salvar alterações' : 'Criar categoria'}
      </Text>
    </TouchableOpacity>
  );

  const formBody = (
    <>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Nome</Text>
        <TextInput
          style={[styles.fieldInput, fieldInset]}
          placeholder="Nome da categoria"
          placeholderTextColor={theme.placeholder}
          value={nome}
          onChangeText={setNome}
          autoFocus={isWebDialog}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Tipo</Text>
        <MfSegmented
          options={[
            { key: 'entrada', label: 'Entrada', tone: 'income' },
            { key: 'saida', label: 'Saída', tone: 'expense' },
          ]}
          value={tipo}
          onChange={setTipo}
          style={styles.segmented}
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
  const dialogMaxWidth = windowWidth >= 640 ? 440 : '100%';

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
    fieldInput: {
      paddingHorizontal: 14,
      paddingVertical: isNative ? 13 : 11,
      fontSize: isNative ? 16 : 15,
      color: theme.text,
      minHeight: isNative ? 48 : 44,
      ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
    },
    segmented: {
      alignSelf: 'stretch',
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
