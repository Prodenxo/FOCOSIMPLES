import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  Pressable,
  StyleSheet,
  Platform,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Calendar, type DateData } from 'react-native-calendars';
import {
  computeBrDateInputUpdate,
  formatBRDate,
  parseBRDateToIso,
  todayIsoDate,
} from '../../lib/brDate';
import { ensureCalendarLocalePtBR } from '../../lib/calendarLocale';
import { mfRadius } from '../../lib/theme';
import { getTechTokens } from '../../lib/techDesign';
import { useMfTheme } from './useMfTheme';

ensureCalendarLocalePtBR();

type Props = {
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  accessibilityLabel?: string;
  style?: ViewStyle;
  /** Ocupa 100% da linha (toolbar mobile / coluna empilhada). */
  fullWidth?: boolean;
};

export function MfDateField({
  value,
  onChange,
  placeholder = 'dd/mm/aaaa',
  accessibilityLabel = 'Data',
  style,
  fullWidth = false,
}: Props) {
  const { theme, isDarkMode } = useMfTheme();
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode]);
  const isNative = Platform.OS !== 'web';
  const styles = useMemo(
    () => createStyles(theme, tokens, isDarkMode, isNative, fullWidth),
    [theme, tokens, isDarkMode, isNative, fullWidth],
  );

  const [display, setDisplay] = useState(() => formatBRDate(value));
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [selection, setSelection] = useState<{ start: number; end: number } | undefined>();
  const displayRef = useRef(display);
  const selectionRef = useRef({ start: 0, end: 0 });

  useEffect(() => {
    const next = formatBRDate(value);
    setDisplay(next);
    displayRef.current = next;
  }, [value]);

  const handleTextChange = useCallback(
    (text: string) => {
      const prev = displayRef.current;
      const caret = selectionRef.current.start;
      const { formatted, caret: nextCaret } = computeBrDateInputUpdate(prev, text, caret);
      setDisplay(formatted);
      displayRef.current = formatted;
      selectionRef.current = { start: nextCaret, end: nextCaret };
      setSelection({ start: nextCaret, end: nextCaret });
      setTimeout(() => setSelection(undefined), 0);

      if (formatted.length === 10) {
        const iso = parseBRDateToIso(formatted);
        onChange(iso);
      } else if (formatted.length === 0) {
        onChange('');
      }
    },
    [onChange],
  );

  const currentIso = useMemo(() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    if (display.length === 10) {
      const parsed = parseBRDateToIso(display);
      if (parsed) return parsed;
    }
    return todayIsoDate();
  }, [value, display]);

  const markedDates = useMemo(() => {
    const d = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
    return d
      ? {
          [d]: {
            selected: true,
            selectedColor: theme.primary,
            selectedTextColor: '#FFFFFF',
          },
        }
      : {};
  }, [value, theme.primary]);

  const pickDate = useCallback(
    (iso: string) => {
      onChange(iso);
      const formatted = formatBRDate(iso);
      setDisplay(formatted);
      displayRef.current = formatted;
      setCalendarVisible(false);
    },
    [onChange],
  );

  return (
    <>
      <View
        style={[styles.wrap, style]}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="none"
      >
        <TextInput
          style={styles.input}
          value={display}
          selection={selection}
          onSelectionChange={(e) => {
            selectionRef.current = e.nativeEvent.selection;
          }}
          onChangeText={handleTextChange}
          placeholder={placeholder}
          placeholderTextColor={theme.placeholder}
          keyboardType="numeric"
          maxLength={10}
          accessibilityLabel={accessibilityLabel}
        />
        <TouchableOpacity
          style={styles.calendarBtn}
          onPress={() => setCalendarVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={`Abrir calendário — ${accessibilityLabel}`}
          hitSlop={isNative ? { top: 8, bottom: 8, left: 8, right: 8 } : { top: 6, bottom: 6, left: 4, right: 6 }}
        >
          <Ionicons name="calendar-outline" size={isNative ? 20 : 18} color={tokens.accent} />
        </TouchableOpacity>
      </View>

      <Modal
        visible={calendarVisible}
        transparent
        animationType={isNative ? 'slide' : 'fade'}
        onRequestClose={() => setCalendarVisible(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setCalendarVisible(false)} />
          <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecione a data</Text>
              <TouchableOpacity
                onPress={() => setCalendarVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Fechar calendário"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <Calendar
              current={currentIso}
              onDayPress={(day: DateData) => pickDate(day.dateString)}
              markedDates={markedDates}
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
                textDayFontSize: isNative ? 17 : 16,
                textMonthFontSize: isNative ? 19 : 18,
                textDayHeaderFontSize: 13,
              }}
              enableSwipeMonths
              firstDay={0}
            />
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalBtnPrimary}
                onPress={() => pickDate(todayIsoDate())}
              >
                <Text style={styles.modalBtnPrimaryText}>Hoje</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalBtnSecondary}
                onPress={() => {
                  onChange('');
                  setDisplay('');
                  displayRef.current = '';
                  setCalendarVisible(false);
                }}
              >
                <Text style={styles.modalBtnSecondaryText}>Limpar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function createStyles(
  theme: ReturnType<typeof useMfTheme>['theme'],
  tokens: ReturnType<typeof getTechTokens>,
  isDarkMode: boolean,
  isNative: boolean,
  fullWidth: boolean,
) {
  const fieldHeight = isNative ? 44 : 36;

  return StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      width: fullWidth ? '100%' : undefined,
      minWidth: fullWidth ? undefined : isNative ? 148 : 132,
      maxWidth: fullWidth ? undefined : isNative ? undefined : 168,
      flexGrow: fullWidth ? 0 : 1,
      flexShrink: 1,
      flexBasis: fullWidth ? 'auto' : isNative ? '48%' : 0,
      minHeight: fieldHeight,
      borderWidth: 1,
      borderColor: tokens.insetBorder,
      borderRadius: mfRadius.sm,
      backgroundColor: tokens.insetFill,
      overflow: 'hidden',
    },
    input: {
      flex: 1,
      minWidth: 0,
      paddingVertical: isNative ? 10 : 8,
      paddingLeft: isNative ? 12 : 10,
      paddingRight: 4,
      fontSize: isNative ? 15 : 13,
      fontWeight: '600',
      color: theme.text,
      backgroundColor: 'transparent',
      ...(Platform.OS === 'web'
        ? ({ outlineStyle: 'none' } as object)
        : {}),
    },
    calendarBtn: {
      justifyContent: 'center',
      alignItems: 'center',
      alignSelf: 'stretch',
      paddingHorizontal: isNative ? 12 : 10,
      borderLeftWidth: 1,
      borderLeftColor: tokens.insetBorder,
      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(15, 23, 42, 0.03)',
      minWidth: isNative ? 44 : 40,
    },
    modalRoot: {
      flex: 1,
      justifyContent: isNative ? 'flex-end' : 'center',
      alignItems: 'center',
    },
    modalBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
    },
    modalCard: {
      width: isNative ? '100%' : '92%',
      maxWidth: isNative ? undefined : 400,
      backgroundColor: theme.surface,
      borderTopLeftRadius: mfRadius.md,
      borderTopRightRadius: mfRadius.md,
      borderBottomLeftRadius: isNative ? 0 : mfRadius.md,
      borderBottomRightRadius: isNative ? 0 : mfRadius.md,
      overflow: 'hidden',
      zIndex: 1,
      ...(isNative
        ? {
            paddingBottom: Platform.OS === 'ios' ? 24 : 12,
          }
        : {}),
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: isNative ? 20 : 16,
      paddingVertical: isNative ? 16 : 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    modalTitle: {
      fontSize: isNative ? 18 : 17,
      fontWeight: '700',
      color: theme.text,
    },
    modalFooter: {
      flexDirection: 'row',
      gap: 10,
      padding: isNative ? 16 : 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    modalBtnPrimary: {
      flex: 1,
      paddingVertical: isNative ? 13 : 11,
      borderRadius: mfRadius.sm,
      backgroundColor: theme.primary,
      alignItems: 'center',
      minHeight: isNative ? 48 : undefined,
      justifyContent: 'center',
    },
    modalBtnPrimaryText: {
      color: '#FFFFFF',
      fontSize: isNative ? 16 : 15,
      fontWeight: '600',
    },
    modalBtnSecondary: {
      flex: 1,
      paddingVertical: isNative ? 13 : 11,
      borderRadius: mfRadius.sm,
      backgroundColor: theme.backgroundMuted,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      minHeight: isNative ? 48 : undefined,
      justifyContent: 'center',
    },
    modalBtnSecondaryText: {
      color: theme.text,
      fontSize: isNative ? 16 : 15,
      fontWeight: '600',
    },
  });
}
