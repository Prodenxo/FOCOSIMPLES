import React, { useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Linking,
  Alert,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MfTechKpiCard } from '../../components/ui';
import { useMfTheme } from '../../components/ui/useMfTheme';
import { formatCurrencyBR } from '../../lib/numberFormat';
import { mfRadius, mfSpacing } from '../../lib/theme';
import { getTechTokens } from '../../lib/techDesign';

export type CombinedEvent =
  | {
      id: string;
      source: 'transaction';
      date: Date;
      title: string;
      subtitle?: string;
      amount: number;
      isIncome: boolean;
      status: string;
      cor: string;
    }
  | {
      id: string;
      source: 'google';
      date: Date;
      title: string;
      subtitle?: string;
      isAllDay: boolean;
      cor: string;
      colorId?: string;
      meetLink?: string;
      showMeetIntent?: boolean;
      htmlLink?: string;
      timeLabel?: string;
    };

type Props = {
  event: CombinedEvent;
  onEditGoogle?: (eventId: string) => void;
};

const monoFont = Platform.select({
  web: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  ios: 'Menlo',
  android: 'monospace',
  default: undefined,
}) as ViewStyle['fontFamily'];

export function AgendaEventRow({ event, onEditGoogle }: Props) {
  const { theme, isDarkMode } = useMfTheme();
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode]);
  const styles = useMemo(() => createStyles(theme, tokens), [theme, tokens]);

  const formattedDate = event.date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });

  if (event.source === 'google') {
    return (
      <GoogleEventRow
        event={event}
        formattedDate={formattedDate}
        onEditGoogle={onEditGoogle}
        styles={styles}
        theme={theme}
        tokens={tokens}
      />
    );
  }

  const isPaid = event.status === 'pago' || event.status === 'recebido';
  const statusColor = isPaid ? theme.financeReceived : theme.financeOverdue;

  return (
    <MfTechKpiCard
      level="metric"
      style={[
        styles.cardShell,
        { borderLeftColor: event.cor },
        Platform.OS === 'web'
          ? ({ boxShadow: 'none', filter: 'none', WebkitFilter: 'none' } as object)
          : null,
      ]}
      innerStyle={styles.cardInner}
    >
      <View style={styles.rowTop}>
        <View style={[styles.dateBadge, { backgroundColor: `${event.cor}18`, borderColor: `${event.cor}44` }]}>
          <Text style={[styles.dateText, { color: event.cor }]}>{formattedDate}</Text>
        </View>
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={2}>
            {event.title}
            {event.subtitle ? ` · ${event.subtitle}` : ''}
          </Text>
          <Text
            style={[
              styles.amount,
              { color: event.isIncome ? theme.financeReceived : theme.financeOverdue },
            ]}
          >
            {event.isIncome ? '+' : '−'} {formatCurrencyBR(Math.abs(event.amount))}
          </Text>
        </View>
        <View
          style={[
            styles.statusDot,
            {
              backgroundColor: isPaid ? theme.financeReceivedLight : theme.financeOverdueLight,
              borderColor: statusColor,
            },
          ]}
        >
          <Ionicons
            name={isPaid ? 'checkmark' : 'time-outline'}
            size={14}
            color={statusColor}
          />
        </View>
      </View>
    </MfTechKpiCard>
  );
}

function GoogleEventRow({
  event,
  formattedDate,
  onEditGoogle,
  styles,
  theme,
  tokens,
}: {
  event: Extract<CombinedEvent, { source: 'google' }>;
  formattedDate: string;
  onEditGoogle?: (eventId: string) => void;
  styles: ReturnType<typeof createStyles>;
  theme: ReturnType<typeof useMfTheme>['theme'];
  tokens: ReturnType<typeof getTechTokens>;
}) {
  const accent = event.cor;

  const calendarDayUrl = () => {
    const d = event.date;
    return `https://calendar.google.com/calendar/r/day/${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  };

  const openMeet = () => {
    if (event.meetLink) {
      Linking.openURL(event.meetLink);
      return;
    }
    Alert.alert(
      'Google Meet',
      'O link da videoconferência ainda não está disponível neste evento.',
      [
        { text: 'Ver dia no Calendar', onPress: () => Linking.openURL(calendarDayUrl()) },
        { text: 'OK', style: 'cancel' },
      ],
    );
  };

  const openInCalendar = () => {
    const url = event.htmlLink?.trim();
    if (url && !url.includes('msg=')) {
      Linking.openURL(url);
      return;
    }
    Linking.openURL(calendarDayUrl());
  };

  const showMeet = !!(event.meetLink || event.showMeetIntent);
  const showCalendarLink = !!(event.showMeetIntent || event.htmlLink);
  const hasActions = !!(onEditGoogle || showMeet || showCalendarLink);

  return (
    <MfTechKpiCard
      level="metric"
      style={[
        styles.cardShell,
        { borderLeftColor: accent },
        Platform.OS === 'web'
          ? ({ boxShadow: 'none', filter: 'none', WebkitFilter: 'none' } as object)
          : null,
      ]}
      innerStyle={styles.cardInner}
    >
      <View style={styles.rowTop}>
        <View style={[styles.dateBadge, { backgroundColor: `${accent}18`, borderColor: `${accent}44` }]}>
          <Text style={[styles.dateText, { color: accent }]}>{formattedDate}</Text>
        </View>
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={2}>
            {event.title}
          </Text>
          {event.timeLabel ? (
            <Text style={styles.sub}>{event.timeLabel}</Text>
          ) : null}
          {event.subtitle ? (
            <Text style={styles.sub} numberOfLines={2}>
              {event.subtitle}
            </Text>
          ) : null}
        </View>
        <View style={[styles.googleIcon, { backgroundColor: `${accent}14` }]}>
          <Ionicons name="logo-google" size={14} color={accent} />
        </View>
      </View>

      {hasActions ? (
        <View style={[styles.actionsBar, { borderTopColor: tokens.insetBorder }]}>
          {onEditGoogle ? (
            <Pressable
              style={[styles.actionBtn, styles.actionBtnOutline, { borderColor: tokens.insetBorder }]}
              onPress={() => onEditGoogle(event.id)}
              accessibilityRole="button"
              accessibilityLabel="Editar compromisso"
            >
              <Ionicons name="pencil-outline" size={14} color={theme.textSecondary} />
              <Text style={[styles.actionBtnText, { color: theme.textSecondary }]} numberOfLines={1}>
                Editar
              </Text>
            </Pressable>
          ) : null}
          {showMeet ? (
            <Pressable
              style={[
                styles.actionBtn,
                styles.actionBtnMeet,
                { backgroundColor: event.meetLink ? accent : theme.textTertiary },
              ]}
              onPress={openMeet}
              accessibilityRole="button"
              accessibilityLabel={event.meetLink ? 'Entrar no Google Meet' : 'Meet indisponível'}
            >
              <Ionicons name="videocam" size={14} color="#fff" />
              <Text style={styles.meetBtnText} numberOfLines={1}>
                Meet
              </Text>
            </Pressable>
          ) : null}
          {showCalendarLink ? (
            <Pressable
              style={[styles.actionBtn, styles.actionBtnOutline, { borderColor: tokens.insetBorder }]}
              onPress={openInCalendar}
              accessibilityRole="button"
              accessibilityLabel="Abrir no Google Calendar"
            >
              <Ionicons name="open-outline" size={14} color={theme.textSecondary} />
              <Text style={[styles.actionBtnText, { color: theme.textSecondary }]} numberOfLines={1}>
                Agenda
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </MfTechKpiCard>
  );
}

function createStyles(
  theme: ReturnType<typeof useMfTheme>['theme'],
  tokens: ReturnType<typeof getTechTokens>,
) {
  return StyleSheet.create({
    cardShell: {
      flexGrow: 0,
      flexShrink: 0,
      flexBasis: 'auto',
      marginBottom: mfSpacing.sm,
      borderLeftWidth: 3,
      alignSelf: 'stretch',
      overflow: 'hidden',
      ...(Platform.OS === 'web'
        ? ({ flex: 'none', width: '100%' } as object)
        : {}),
    },
    cardInner: {
      padding: mfSpacing.md,
      gap: mfSpacing.sm,
    },
    rowTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: mfSpacing.sm,
    },
    dateBadge: {
      width: 48,
      paddingVertical: mfSpacing.sm,
      borderRadius: mfRadius.sm,
      borderWidth: 1,
      alignItems: 'center',
      flexShrink: 0,
    },
    dateText: {
      fontSize: 11,
      fontWeight: '800',
      fontFamily: monoFont,
      fontVariant: ['tabular-nums'],
    },
    body: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.text,
      letterSpacing: -0.2,
    },
    sub: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
      lineHeight: 16,
    },
    amount: {
      fontSize: 14,
      fontWeight: '700',
      marginTop: 4,
      fontFamily: monoFont,
      fontVariant: ['tabular-nums'],
    },
    statusDot: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    googleIcon: {
      width: 28,
      height: 28,
      borderRadius: mfRadius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    actionsBar: {
      flexDirection: 'row',
      alignItems: 'stretch',
      width: '100%',
      gap: mfSpacing.xs,
      paddingTop: mfSpacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingVertical: 8,
      paddingHorizontal: 6,
      borderRadius: mfRadius.sm,
      minWidth: 0,
      ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : {}),
    },
    actionBtnOutline: {
      borderWidth: StyleSheet.hairlineWidth,
    },
    actionBtnMeet: {
      borderWidth: 0,
    },
    actionBtnText: {
      fontSize: 11,
      fontWeight: '600',
      flexShrink: 1,
    },
    meetBtnText: {
      color: '#fff',
      fontSize: 11,
      fontWeight: '700',
      flexShrink: 1,
    },
  });
}
