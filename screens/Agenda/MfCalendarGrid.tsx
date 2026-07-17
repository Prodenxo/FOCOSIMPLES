import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useMfTheme } from '../../components/ui/useMfTheme';
import { mfRadius, mfSpacing } from '../../lib/theme';
import { getTechTokens } from '../../lib/techDesign';

const DAY_NAMES = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

type MarkedDot = { key: string; color: string };

type Props = {
  currentMonth: string;
  selectedDate: string;
  markedDates: Record<
    string,
    {
      selected?: boolean;
      selectedColor?: string;
      dots?: MarkedDot[];
    }
  >;
  onDayPress: (dateString: string) => void;
  /** Preenche a altura disponível do painel (desktop) */
  fillHeight?: boolean;
};

export function MfCalendarGrid({
  currentMonth,
  selectedDate,
  markedDates,
  onDayPress,
  fillHeight = false,
}: Props) {
  const { theme, isDarkMode } = useMfTheme();
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode]);
  const styles = useMemo(
    () => createStyles(theme, tokens, isDarkMode, fillHeight),
    [theme, tokens, isDarkMode, fillHeight],
  );

  const weeks = useMemo(() => {
    const [y, m] = currentMonth.split('-').map(Number);
    const year = y;
    const month = m - 1;
    const firstDow = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const leadingBlanks = firstDow === 0 ? 6 : firstDow - 1;

    const cells: (number | null)[] = [
      ...Array(leadingBlanks).fill(null),
      ...Array.from({ length: totalDays }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);

    const result: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) result.push(cells.slice(i, i + 7));
    return result;
  }, [currentMonth]);

  const today = new Date().toISOString().split('T')[0];
  const monthPrefix = currentMonth.slice(0, 7);

  return (
    <View style={styles.root}>
      <View style={styles.weekHeader}>
        {DAY_NAMES.map((name) => (
          <View key={name} style={styles.dayHeadCell}>
            <Text style={styles.dayHeadText}>{name}</Text>
          </View>
        ))}
      </View>

      <View style={styles.weeksBody}>
        {weeks.map((week, wi) => (
          <View key={wi} style={styles.weekRow}>
          {week.map((day, di) => {
            if (!day) return <View key={di} style={styles.dayCell} />;

            const dateStr = `${monthPrefix}-${String(day).padStart(2, '0')}`;
            const marking = markedDates[dateStr] ?? {};
            const isSelected = marking.selected ?? dateStr === selectedDate;
            const isToday = dateStr === today;
            const dots: MarkedDot[] = marking.dots ?? [];

            return (
              <TouchableOpacity
                key={di}
                style={styles.dayCell}
                onPress={() => onDayPress(dateStr)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={`Dia ${day}`}
                accessibilityState={{ selected: isSelected }}
              >
                <View style={styles.dayInner}>
                  <View
                    style={[
                      styles.dayBubble,
                      isSelected && { backgroundColor: tokens.accent },
                      isToday && !isSelected && styles.dayBubbleToday,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayNumber,
                        isSelected && styles.dayNumberSelected,
                        isToday && !isSelected && { color: tokens.accent },
                      ]}
                    >
                      {day}
                    </Text>
                  </View>
                  {dots.length > 0 ? (
                    <View style={styles.dotsCol}>
                      {dots.slice(0, 4).map((dot, i) => (
                        <View
                          key={dot.key || i}
                          style={[styles.eventBar, { backgroundColor: dot.color }]}
                        />
                      ))}
                      {dots.length > 4 ? (
                        <Text style={styles.dotsMore}>+{dots.length - 4}</Text>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
      </View>
    </View>
  );
}

function createStyles(
  theme: ReturnType<typeof useMfTheme>['theme'],
  tokens: ReturnType<typeof getTechTokens>,
  isDarkMode: boolean,
  fillHeight: boolean,
) {
  return StyleSheet.create({
    root: {
      flex: fillHeight ? 1 : undefined,
      minHeight: fillHeight ? 0 : undefined,
      paddingHorizontal: mfSpacing.sm,
      paddingBottom: mfSpacing.sm,
    },
    weeksBody: {
      flex: fillHeight ? 1 : undefined,
      minHeight: fillHeight ? 0 : undefined,
    },
    weekHeader: {
      flexDirection: 'row',
      flexShrink: 0,
      paddingVertical: mfSpacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tokens.insetBorder,
      marginBottom: mfSpacing.xs,
    },
    dayHeadCell: {
      flex: 1,
      alignItems: 'center',
    },
    dayHeadText: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: theme.textSecondary,
    },
    weekRow: {
      flexDirection: 'row',
      flex: fillHeight ? 1 : undefined,
      minHeight: fillHeight ? 44 : undefined,
      height: fillHeight ? undefined : Platform.OS === 'web' ? 56 : 52,
    },
    dayCell: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayInner: {
      alignItems: 'center',
      width: 48,
    },
    dayBubble: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayBubbleToday: {
      borderWidth: 1,
      borderColor: tokens.accentMuted,
    },
    dayNumber: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.text,
      ...(Platform.OS === 'web'
        ? ({ fontVariant: ['tabular-nums'] } as object)
        : { fontVariant: ['tabular-nums'] }),
    },
    dayNumberSelected: {
      color: isDarkMode ? '#041018' : '#FFFFFF',
      fontWeight: '800',
    },
    dotsCol: {
      flexDirection: 'column',
      gap: 2,
      marginTop: 4,
      width: 40,
    },
    eventBar: {
      width: '100%',
      height: 3,
      borderRadius: mfRadius.pill,
    },
    dotsMore: {
      fontSize: 9,
      fontWeight: '700',
      color: theme.textTertiary,
      textAlign: 'center',
      marginTop: 1,
    },
  });
}
