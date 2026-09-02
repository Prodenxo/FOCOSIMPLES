import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar, DateData } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { useTransactionStore } from '../store/transactionStore';
import { useThemeStore } from '../store/themeStore';
import { getTheme, mfRadius, mfSpacing, mfTypography } from '../lib/theme';
import { getCategorySliceColorForId } from '../lib/categoryColors';
import {
  getGoogleEventColorHex,
} from '../lib/googleCalendarColors';
import {
  checkGoogleAuth,
  formatGoogleEventTimeRange,
  getGoogleEvents,
  eventHasAppMeetEnabled,
  getGoogleMeetLink,
  stripMeetMarkerFromDescription,
  type GoogleCalendarEvent,
} from '../lib/google-calendar';
import CreateGoogleEventModal from '../components/CreateGoogleEventModal';
import { initMeetEventsCache } from '../lib/google-meet-events';
import { useGoogleCalendarStore } from '../store/googleCalendarStore';
import { useNavigationDrawer } from '../lib/navigationContext';
import { formatCurrencyBR } from '../lib/numberFormat';
import { promptGoogleAuth } from '../lib/google-auth-flow';
import { ensureCalendarLocalePtBR } from '../lib/calendarLocale';
import {
  getWebAgendaEventsScrollStyle,
  getWebScrollbarStyle,
  WEB_AGENDA_EVENTS_SCROLL_CLASS,
  WEB_SCROLL_Y_CLASS,
} from '../lib/webScrollbar';
import { MfAppHeader, MfScrollView } from '../components/ui';
import { useShellLayout } from '../components/shell';
import { SHELL_CANVAS_DARK, SHELL_CANVAS_LIGHT } from '../components/shell/shellTokens';
import { useMfTheme } from '../components/ui/useMfTheme';
import { getTechTokens, mfTechPanelChrome } from '../lib/techDesign';
import { MfCalendarGrid } from './Agenda/MfCalendarGrid';
import { AgendaEventRow, type CombinedEvent } from './Agenda/AgendaEventRow';
import { AgendaPageChrome } from './Agenda/agendaPageChrome';

ensureCalendarLocalePtBR();

type ViewMode = 'month' | 'week' | 'day';

const DESKTOP_LAYOUT_MIN = 1100;
const AGENDA_CALENDAR_WIDTH = 900;
const AGENDA_CALENDAR_HEIGHT = 720;
/** Ajuste fino na base do bloco calendário + anotações (desktop). */
const AGENDA_DESKTOP_BOTTOM_OFFSET = 8;

/** Interpreta `YYYY-MM-DD` no fuso local (evita `new Date('YYYY-MM-DD')` em UTC). */
function parseLocalYmd(dateString: string): Date {
  const [y, m, d] = dateString.split('-').map(Number);
  return new Date(y, m - 1, d || 1);
}

function getLocalMonthBounds(dateString: string): { start: Date; end: Date } {
  const [y, m] = dateString.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export default function AgendaScreen() {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [currentMonth, setCurrentMonth] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const calendarRef = useRef<{ animateToMonth?: (dateString: string) => void } | null>(null);
  const { transactions, fetchTransactions } = useTransactionStore();
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEvent[]>([]);
  const [googleLoading, setGoogleLoading] = useState<boolean>(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [googleIntegrated, setGoogleIntegrated] = useState<boolean>(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingGoogleEvent, setEditingGoogleEvent] = useState<GoogleCalendarEvent | null>(null);
  const [meetCacheTick, setMeetCacheTick] = useState(0);
  const [eventsHeaderHeight, setEventsHeaderHeight] = useState(88);
  const calendarHeightRef = useRef(0);
  const { isDarkMode } = useThemeStore();
  const { isDarkMode: mfDark } = useMfTheme();
  const googleConnectionVersion = useGoogleCalendarStore((s) => s.connectionVersion);
  const { openDrawer, hasGlobalNav } = useNavigationDrawer();
  const { isWebDesktop } = useShellLayout();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktopLayout = windowWidth >= DESKTOP_LAYOUT_MIN;
  const showPanelHeader = isWebDesktop && hasGlobalNav;

  const theme = useMemo(() => getTheme(isDarkMode), [isDarkMode]);
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode]);
  const unifiedPanelChrome = useMemo(
    () => mfTechPanelChrome(mfDark, 'surface'),
    [mfDark],
  );
  const calendarPanelChrome = useMemo(
    () => mfTechPanelChrome(mfDark, 'inset'),
    [mfDark],
  );
  const eventsPanelChrome = useMemo(
    () => mfTechPanelChrome(mfDark, 'surface'),
    [mfDark],
  );

  const shellBg =
    hasGlobalNav || Platform.OS === 'web'
      ? isDarkMode
        ? SHELL_CANVAS_DARK
        : SHELL_CANVAS_LIGHT
      : theme.background;

  const styles = useMemo(
    () => createStyles(theme, tokens, isDesktopLayout, showPanelHeader),
    [theme, tokens, isDesktopLayout, showPanelHeader],
  );
  const webScrollStyle = useMemo(() => getWebScrollbarStyle(theme), [theme]);

  const getMonthRange = (dateString: string) => {
    const { start, end } = getLocalMonthBounds(dateString);
    return {
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
    };
  };

  useEffect(() => {
    fetchTransactions();
    initMeetEventsCache().then(() => setMeetCacheTick((t) => t + 1));
  }, []);

  const loadGoogleEvents = async () => {
    setGoogleLoading(true);
    setGoogleError(null);
    try {
      await initMeetEventsCache();
      const integrated = await checkGoogleAuth();
      setGoogleIntegrated(integrated);
      if (!integrated) {
        setGoogleEvents([]);
        return;
      }
      const { timeMin, timeMax } = getMonthRange(currentMonth);
      const events = await getGoogleEvents({ timeMin, timeMax });
      setGoogleEvents(events);
      setMeetCacheTick((t) => t + 1);
    } catch (error: any) {
      setGoogleError(error?.message || 'Erro ao carregar eventos do Google Calendar');
    } finally {
      setGoogleLoading(false);
    }
  };

  useEffect(() => {
    loadGoogleEvents();
  }, [currentMonth, googleConnectionVersion]);

  useEffect(() => {
    calendarHeightRef.current = 0;
  }, [viewMode, currentMonth, selectedDate]);

  const onDayPress = (day: DateData) => {
    setSelectedDate(day.dateString);
  };

  const goToToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setCurrentMonth(today);
    setSelectedDate(today);
    calendarRef.current?.animateToMonth?.(today);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    let newDate: Date;
    
    if (viewMode === 'week') {
      // Para semana, navegar por semanas
      const current = parseLocalYmd(selectedDate);
      newDate = new Date(current);
      newDate.setDate(current.getDate() + (direction === 'next' ? 7 : -7));
      const newDateString = newDate.toISOString().split('T')[0];
      setSelectedDate(newDateString);
      setCurrentMonth(newDateString);
    } else if (viewMode === 'day') {
      // Para dia, navegar por dias
      const current = parseLocalYmd(selectedDate);
      newDate = new Date(current);
      newDate.setDate(current.getDate() + (direction === 'next' ? 1 : -1));
      const newDateString = newDate.toISOString().split('T')[0];
      setSelectedDate(newDateString);
      setCurrentMonth(newDateString);
    } else {
      // Parse manual para evitar bug de timezone (new Date('YYYY-MM-DD') é UTC)
      const [y, m] = currentMonth.split('-').map(Number);
      const delta = direction === 'next' ? 1 : -1;
      const target = new Date(y, m - 1 + delta, 1); // local timezone
      const pad = (n: number) => String(n).padStart(2, '0');
      const newDateString = `${target.getFullYear()}-${pad(target.getMonth() + 1)}-01`;
      setCurrentMonth(newDateString);
      calendarRef.current?.animateToMonth?.(newDateString);
    }
  };

  const formatMonthYear = (dateString: string) => {
    const date = parseLocalYmd(dateString);
    if (viewMode === 'week') {
      // Para semana, mostrar o intervalo de datas
      const startOfWeek = getStartOfWeek(date);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      
      const startMonth = startOfWeek.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' });
      const endMonth = endOfWeek.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' });
      return `${startMonth} - ${endMonth}`;
    } else if (viewMode === 'day') {
      // Para dia, mostrar o dia completo
      return date.toLocaleDateString('pt-BR', { weekday: 'long', month: 'short', day: 'numeric' });
    }
    const [y, m] = dateString.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
    });
  };

  // Formata Date → 'YYYY-MM-DD' em timezone local (evita bug UTC)
  const localDateStr = (date: Date): string => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  };

  const getStartOfWeek = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajuste para segunda-feira
    return new Date(d.setDate(diff));
  };

  const getWeekDays = (dateString: string): Date[] => {
    const date = parseLocalYmd(dateString);
    const startOfWeek = getStartOfWeek(date);
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const getHours = (): string[] => {
    const hours: string[] = [];
    for (let i = 0; i < 24; i++) {
      hours.push(`${String(i).padStart(2, '0')}:00`);
    }
    return hours;
  };

  const getCurrentTimePosition = (): number => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    return hours + minutes / 60;
  };

  const getEventDate = (event: GoogleCalendarEvent): Date | null => {
    if (event.start?.date) {
      // Evento de dia inteiro: "2026-05-09" — sem sufixo de fuso para interpretar como horário local
      const date = new Date(event.start.date + 'T00:00:00');
      return isNaN(date.getTime()) ? null : date;
    }
    const raw = event.start?.dateTime;
    if (!raw) return null;
    const date = new Date(raw);
    return isNaN(date.getTime()) ? null : date;
  };

  // Filtrar transações do mês atual
  const monthEvents = useMemo(() => {
    const { start: startOfMonth, end: endOfMonth } = getLocalMonthBounds(currentMonth);

    return transactions.filter(t => {
      const transactionDate = t.data 
        ? new Date(t.data + 'T00:00:00-03:00')
        : new Date(t.criado_em);
      return transactionDate >= startOfMonth && transactionDate <= endOfMonth;
    }).sort((a, b) => {
      const dateA = a.data ? new Date(a.data + 'T00:00:00-03:00') : new Date(a.criado_em);
      const dateB = b.data ? new Date(b.data + 'T00:00:00-03:00') : new Date(b.criado_em);
      return dateA.getTime() - dateB.getTime();
    });
  }, [transactions, currentMonth]);

  const googleMonthEvents = useMemo(() => {
    const { start: startOfMonth, end: endOfMonth } = getLocalMonthBounds(currentMonth);

    return googleEvents
      .map((event) => ({ event, date: getEventDate(event) }))
      .filter((item) => item.date && item.date >= startOfMonth && item.date <= endOfMonth)
      .sort((a, b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0));
  }, [googleEvents, currentMonth]);

  const combinedMonthEvents = useMemo<CombinedEvent[]>(() => {
    const transactionItems: CombinedEvent[] = monthEvents.map((event) => {
      const eventDate = event.data
        ? new Date(event.data + 'T00:00:00-03:00')
        : new Date(event.criado_em);
      return {
        id: event.id,
        source: 'transaction',
        date: eventDate,
        title: event.classificacao || 'Sem descrição',
        subtitle: event.obs || undefined,
        amount: event.valor,
        isIncome: event.tipo === 'entrada',
        status: event.status,
        cor: event.categoria
          ? getCategorySliceColorForId(event.categoria, isDarkMode)
          : theme.primary,
      };
    });

    const googleItems: CombinedEvent[] = googleMonthEvents
      .map(({ event, date }) => {
        if (!date) return null;
        const meetLink = getGoogleMeetLink(event);
        return {
          id: event.id,
          source: 'google',
          date,
          title: event.summary || 'Evento Google',
          subtitle: stripMeetMarkerFromDescription(event.description),
          isAllDay: !!event.start?.date,
          colorId: event.colorId,
          cor: getGoogleEventColorHex(event.colorId, theme.primary),
          meetLink: meetLink ?? undefined,
          showMeetIntent: eventHasAppMeetEnabled(event),
          htmlLink: event.htmlLink,
          timeLabel: formatGoogleEventTimeRange(event) ?? undefined,
        } as CombinedEvent;
      })
      .filter(Boolean) as CombinedEvent[];

    return [...transactionItems, ...googleItems].sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [monthEvents, googleMonthEvents, isDarkMode, theme.primary, meetCacheTick]);

  const markedDates = useMemo(() => {
    const dotsByDate: Record<string, { key: string; color: string }[]> = {};
    monthEvents.forEach((event) => {
      const eventDate = event.data
        ? new Date(event.data + 'T00:00:00-03:00')
        : new Date(event.criado_em);
      const dateKey = eventDate.toISOString().split('T')[0];
      if (!dotsByDate[dateKey]) dotsByDate[dateKey] = [];
      const cor = event.categoria
        ? getCategorySliceColorForId(event.categoria, isDarkMode)
        : theme.primary;
      dotsByDate[dateKey].push({ key: `transaction-${event.id}`, color: cor });
    });

    googleMonthEvents.forEach(({ event, date }) => {
      if (!date) return;
      const dateKey = date.toISOString().split('T')[0];
      if (!dotsByDate[dateKey]) dotsByDate[dateKey] = [];
      dotsByDate[dateKey].push({
        key: `google-${event.id}`,
        color: getGoogleEventColorHex(event.colorId, theme.primary),
      });
    });

    const result: Record<string, any> = {};
    Object.entries(dotsByDate).forEach(([date, dots]) => {
      result[date] = { dots };
    });

    result[selectedDate] = {
      ...(result[selectedDate] || {}),
      selected: true,
      selectedColor: tokens.accent,
      selectedTextColor: isDarkMode ? '#041018' : '#FFFFFF',
    };

    return result;
  }, [monthEvents, googleMonthEvents, selectedDate, theme.primary, tokens.accent, isDarkMode]);

  const periodLabel = useMemo(() => {
    const raw = formatMonthYear(viewMode === 'month' ? currentMonth : selectedDate);
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, [viewMode, currentMonth, selectedDate]);

  const visibleEvents = useMemo(() => {
    if (viewMode === 'week') {
      const weekDays = getWeekDays(selectedDate);
      const start = new Date(weekDays[0]);
      start.setHours(0, 0, 0, 0);
      const end = new Date(weekDays[6]);
      end.setHours(23, 59, 59, 999);
      return combinedMonthEvents.filter((e) => e.date >= start && e.date <= end);
    }
    const dayKey = selectedDate;
    return combinedMonthEvents.filter(
      (e) => e.date.toISOString().split('T')[0] === dayKey
    );
  }, [combinedMonthEvents, viewMode, selectedDate]);

  const eventsSectionTitle = useMemo(() => {
    if (viewMode === 'week') {
      return 'Eventos da semana';
    }
    if (viewMode === 'day') {
      const d = new Date(`${selectedDate}T12:00:00`);
      const label = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
      return `Eventos · ${label.charAt(0).toUpperCase()}${label.slice(1)}`;
    }
    const d = new Date(`${selectedDate}T12:00:00`);
    const label = d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
    return `Eventos · ${label}`;
  }, [viewMode, selectedDate]);

  /** Painel direito (desktop): sempre o dia selecionado no calendário. */
  const dayEvents = useMemo(() => {
    return combinedMonthEvents.filter(
      (e) => e.date.toISOString().split('T')[0] === selectedDate
    );
  }, [combinedMonthEvents, selectedDate]);

  const dayPanelTitle = useMemo(() => {
    const d = new Date(`${selectedDate}T12:00:00`);
    const label = d.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    return `Anotações · ${label.charAt(0).toUpperCase()}${label.slice(1)}`;
  }, [selectedDate]);

  const panelEvents = isDesktopLayout ? dayEvents : visibleEvents;
  const panelTitle = isDesktopLayout ? dayPanelTitle : eventsSectionTitle;

  const calendarSizeStyle = isDesktopLayout
    ? { width: AGENDA_CALENDAR_WIDTH }
    : undefined;

  const renderEventsStatusBlocks = () => (
    <>
      {googleLoading ? (
        <View style={styles.googleStatusRow}>
          <ActivityIndicator size="small" color={theme.primary} />
          <Text style={styles.googleStatusText}>Carregando eventos do Google…</Text>
        </View>
      ) : null}

      {googleError ? (
        <View style={styles.googleErrorRow}>
          <Text style={styles.googleErrorText}>{googleError}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadGoogleEvents}>
            <Text style={styles.retryButtonText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {!googleLoading && !googleError && !googleIntegrated ? (
        <Text style={styles.googleStatusText}>
          Google Calendar não conectado — apenas lançamentos locais.
        </Text>
      ) : null}
    </>
  );

  const renderEventsListBody = () => {
    if (panelEvents.length === 0) {
      return (
        <View style={styles.emptyEvents}>
          <Ionicons name="calendar-outline" size={40} color={theme.textTertiary} />
          <Text style={styles.emptyEventsText}>Nenhum compromisso neste dia</Text>
          <Text style={styles.emptyEventsSubtext}>
            Selecione outro dia no calendário ou crie um evento no Google
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.eventsList}>
        {panelEvents.map((event) => (
          <AgendaEventRow
            key={`${event.source}-${event.id}`}
            event={event}
            onEditGoogle={
              event.source === 'google' && googleIntegrated
                ? (eventId) => {
                    const raw = googleEvents.find((e) => e.id === eventId);
                    if (!raw) return;
                    setEditingGoogleEvent(raw);
                    setShowCreateModal(true);
                  }
                : undefined
            }
          />
        ))}
      </View>
    );
  };

  const renderEventsPanel = () => (
    <>
      <Text style={styles.eventsTitle}>{panelTitle}</Text>
      {renderEventsStatusBlocks()}
      {renderEventsListBody()}
    </>
  );

  const webEventsScrollClass =
    Platform.OS === 'web' ? `${WEB_SCROLL_Y_CLASS} ${WEB_AGENDA_EVENTS_SCROLL_CLASS}` : undefined;

  const eventsListContent = renderEventsListBody();

  const renderCalendar = () => {
    switch (viewMode) {
      case 'month':
        // Desktop: calendário customizado com flex (preenche o card)
        if (isDesktopLayout) {
          return (
            <MfCalendarGrid
              currentMonth={currentMonth}
              selectedDate={selectedDate}
              markedDates={markedDates}
              onDayPress={(dateStr) => onDayPress({ dateString: dateStr } as DateData)}
              fillHeight
            />
          );
        }
        // Mobile: calendário da biblioteca (comportamento original)
        return (
          <Calendar
            // @ts-expect-error ref interno da lib
            ref={calendarRef}
            current={currentMonth}
            onDayPress={onDayPress}
            onMonthChange={(month) => setCurrentMonth(month.dateString)}
            markedDates={markedDates}
            markingType="multi-dot"
            theme={{
              backgroundColor: 'transparent',
              calendarBackground: 'transparent',
              textSectionTitleColor: theme.textSecondary,
              selectedDayBackgroundColor: tokens.accent,
              selectedDayTextColor: isDarkMode ? '#041018' : '#FFFFFF',
              todayTextColor: tokens.accent,
              dayTextColor: theme.text,
              textDisabledColor: theme.textTertiary,
              dotColor: tokens.accent,
              selectedDotColor: isDarkMode ? '#041018' : '#FFFFFF',
              arrowColor: tokens.accent,
              monthTextColor: theme.text,
              textDayFontWeight: '600',
              textMonthFontWeight: 'bold',
              textDayHeaderFontWeight: '600',
              textDayFontSize: 16,
              textMonthFontSize: 18,
              textDayHeaderFontSize: 13,
            }}
            style={styles.calendar}
            enableSwipeMonths={true}
            firstDay={1}
            showWeekNumbers={false}
            hideExtraDays={true}
          />
        );
      case 'week':
        const weekDays = getWeekDays(selectedDate);
        const hours = getHours();
        const selectedDateObj = parseLocalYmd(selectedDate);
        const selectedDayIndex = weekDays.findIndex(
          (day) => day.toDateString() === selectedDateObj.toDateString()
        );

        return (
          <ScrollView
            style={[
              styles.weekViewContainer,
              isDesktopLayout && { width: AGENDA_CALENDAR_WIDTH, maxHeight: AGENDA_CALENDAR_HEIGHT },
            ]}
            nestedScrollEnabled
          >
            <View style={styles.weekGrid}>
              {/* Cabeçalho com dias da semana */}
              <View style={styles.weekHeader}>
                <View style={styles.timeColumnHeader} />
                {weekDays.map((day, index) => {
                  const isSelected = index === selectedDayIndex;
                  const dayNumber = day.getDate();
                  const dayNamesPt = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
                  const dayNamePt = dayNamesPt[day.getDay()];
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[styles.weekDayHeader, isSelected && styles.weekDayHeaderSelected]}
                      onPress={() => {
                        const dateStr = localDateStr(day);
                        setSelectedDate(dateStr);
                        onDayPress({ dateString: dateStr } as DateData);
                      }}
                    >
                      <Text style={[styles.weekDayNumber, isSelected && styles.weekDayNumberSelected]}>
                        {dayNumber}
                      </Text>
                      <Text style={[styles.weekDayName, isSelected && styles.weekDayNameSelected]}>
                        {dayNamePt}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Faixa de eventos por dia */}
              <View style={styles.weekEventsRow}>
                <View style={styles.timeColumnHeader} />
                {weekDays.map((day, dayIndex) => {
                  const dateStr = localDateStr(day);
                  const dayEvts = combinedMonthEvents.filter(
                    (e) => localDateStr(e.date) === dateStr
                  );
                  const isSelected = dayIndex === selectedDayIndex;
                  return (
                    <View
                      key={dayIndex}
                      style={[styles.weekEventsCell, isSelected && { backgroundColor: tokens.accentSoft }]}
                    >
                      {dayEvts.slice(0, 3).map((evt, ei) => (
                        <View key={ei} style={[styles.weekEventPill, { backgroundColor: evt.cor + '33' }]}>
                          <Text style={[styles.weekEventPillText, { color: evt.cor }]} numberOfLines={1}>
                            {evt.title}
                          </Text>
                        </View>
                      ))}
                      {dayEvts.length > 3 && (
                        <Text style={styles.weekEventMore}>+{dayEvts.length - 3}</Text>
                      )}
                    </View>
                  );
                })}
              </View>

              {/* Grade de horários */}
              {hours.map((hour, hourIndex) => (
                <View key={hourIndex} style={styles.weekRow}>
                  <View style={styles.timeColumn}>
                    <Text style={styles.timeText}>{hour}</Text>
                  </View>
                  {weekDays.map((day, dayIndex) => {
                    const isSelected = dayIndex === selectedDayIndex;
                    return (
                      <TouchableOpacity
                        key={dayIndex}
                        style={[styles.weekCell, isSelected && styles.weekCellSelected]}
                        onPress={() => {
                          const dateStr = localDateStr(day);
                          setSelectedDate(dateStr);
                          onDayPress({ dateString: dateStr } as DateData);
                        }}
                      />
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        );
      case 'day':
        const dayHours = getHours();
        const currentTimePos = getCurrentTimePosition();
        const selectedDay = parseLocalYmd(selectedDate);
        const isToday = selectedDay.toDateString() === new Date().toDateString();
        // Eventos do dia selecionado — transações sem hora ficam em slot especial (hora 0)
        const dayViewEvents = combinedMonthEvents.filter(
          (e) => localDateStr(e.date) === selectedDate
        );

        return (
          <ScrollView
            style={[
              styles.dayViewContainer,
              isDesktopLayout && { width: AGENDA_CALENDAR_WIDTH, maxHeight: AGENDA_CALENDAR_HEIGHT },
            ]}
            nestedScrollEnabled
          >
            {/* Faixa de eventos sem horário */}
            {dayViewEvents.length > 0 && (
              <View style={styles.dayAllDayRow}>
                <View style={[styles.timeColumn, { justifyContent: 'center' }]}>
                  <Text style={[styles.timeText, { color: theme.textTertiary }]}>eventos</Text>
                </View>
                <View style={styles.dayAllDayEvents}>
                  {dayViewEvents.map((evt, ei) => (
                    <View key={ei} style={[styles.weekEventPill, { backgroundColor: evt.cor + '33' }]}>
                      <Text style={[styles.weekEventPillText, { color: evt.cor }]} numberOfLines={1}>
                        {evt.title}
                        {evt.source === 'transaction' ? ` · ${evt.isIncome ? '+' : '−'} ${formatCurrencyBR(Math.abs(evt.amount))}` : ''}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.dayGrid}>
              {dayHours.map((hour, hourIndex) => {
                const showCurrentTime = isToday && hourIndex <= currentTimePos && hourIndex + 1 > currentTimePos;
                return (
                  <View key={hourIndex} style={styles.dayRow}>
                    <View style={styles.timeColumn}>
                      <Text style={styles.timeText}>{hour}</Text>
                    </View>
                    <View style={styles.dayCellContainer}>
                      {showCurrentTime && (
                        <View style={styles.currentTimeLine}>
                          <View style={styles.currentTimeDot} />
                        </View>
                      )}
                      <View style={styles.dayCell} />
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        );
      default:
        return null;
    }
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    if (mode === 'week' || mode === 'day') {
      setCurrentMonth(selectedDate);
    }
  };

  const insets = useSafeAreaInsets();

  const handleNewEvent = useCallback(async () => {
    if (!googleIntegrated) {
      const connected = await promptGoogleAuth();
      if (!connected) return;
      setGoogleIntegrated(true);
      await loadGoogleEvents();
    }
    setEditingGoogleEvent(null);
    setShowCreateModal(true);
  }, [googleIntegrated]);

  const pageChrome = (
    <AgendaPageChrome
      bare={showPanelHeader}
      compact={!showPanelHeader}
      theme={theme}
      periodLabel={periodLabel}
      viewMode={viewMode}
      onViewModeChange={handleViewModeChange}
      onPrevious={() => navigateMonth('prev')}
      onNext={() => navigateMonth('next')}
      onToday={goToToday}
      onNewEvent={() => void handleNewEvent()}
      googleIntegrated={googleIntegrated}
      eventCount={panelEvents.length}
    />
  );

  const calendarPanel = (
    <View
      style={[styles.calendarPanel, calendarPanelChrome]}
      testID="agenda-calendar-card"
      onLayout={(e) => {
        calendarHeightRef.current = Math.round(e.nativeEvent.layout.height);
      }}
    >
      <View style={styles.calendarInner}>{renderCalendar()}</View>
    </View>
  );

  const eventsPanel = (
    <View style={[styles.eventsPanel, eventsPanelChrome]}>
      <View
        style={styles.eventsPanelHeader}
        onLayout={(e) => {
          const h = Math.round(e.nativeEvent.layout.height);
          if (h > 0 && Math.abs(h - eventsHeaderHeight) > 1) {
            setEventsHeaderHeight(h);
          }
        }}
      >
        <Text style={styles.eventsTitle}>{panelTitle}</Text>
        {renderEventsStatusBlocks()}
      </View>
      {Platform.OS === 'web' && isDesktopLayout ? (
        <View
          style={[styles.eventsPanelScroll, styles.eventsPanelWebScroll, webScrollStyle]}
          {...({ className: webEventsScrollClass } as object)}
        >
          <View style={styles.eventsPanelScrollList}>{eventsListContent}</View>
        </View>
      ) : (
        <ScrollView
          style={[styles.eventsPanelScroll, webScrollStyle, getWebAgendaEventsScrollStyle()]}
          contentContainerStyle={styles.eventsPanelScrollList}
          showsVerticalScrollIndicator
          nestedScrollEnabled
          bounces={false}
          {...(Platform.OS === 'web' ? { className: webEventsScrollClass } : {})}
        >
          {eventsListContent}
        </ScrollView>
      )}
    </View>
  );

  const agendaBody = isDesktopLayout ? (
    <View style={styles.desktopSplit}>
      {calendarPanel}
      {eventsPanel}
    </View>
  ) : (
    <MfScrollView
      style={[styles.scrollView, webScrollStyle]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator
    >
      {calendarPanel}
      <View style={[styles.eventsPanelMobile, eventsPanelChrome]}>
        {renderEventsPanel()}
      </View>
    </MfScrollView>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: shellBg }]} edges={['top', 'bottom']}>
      {!showPanelHeader ? (
        <MfAppHeader title="Agenda" onMenuPress={openDrawer} />
      ) : null}

      <View style={styles.body}>
        {showPanelHeader ? (
          <View style={styles.shellColumn}>
            <View style={[styles.unifiedPanel, unifiedPanelChrome]}>
              {pageChrome}
              <View style={styles.agendaContent}>{agendaBody}</View>
            </View>
          </View>
        ) : (
          <View style={styles.mobilePad}>
            {pageChrome}
            <View style={styles.agendaContent}>{agendaBody}</View>
          </View>
        )}
      </View>

      {!showPanelHeader && Platform.OS !== 'web' ? (
        <TouchableOpacity
          style={[
            styles.fab,
            { backgroundColor: tokens.accent, bottom: Math.max(insets.bottom, mfSpacing.lg) },
          ]}
          onPress={() => void handleNewEvent()}
          activeOpacity={0.85}
          accessibilityLabel="Criar compromisso"
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      ) : null}

      <CreateGoogleEventModal
        visible={showCreateModal}
        initialDate={selectedDate}
        eventToEdit={editingGoogleEvent}
        useDialogLayout={showPanelHeader}
        onClose={() => {
          setShowCreateModal(false);
          setEditingGoogleEvent(null);
        }}
        onSuccess={() => {
          setShowCreateModal(false);
          setEditingGoogleEvent(null);
          loadGoogleEvents();
        }}
      />
    </SafeAreaView>
  );
}

const createStyles = (
  theme: ReturnType<typeof getTheme>,
  tokens: ReturnType<typeof getTechTokens>,
  isDesktopLayout: boolean,
  shell: boolean,
) => {
  const isNative = Platform.OS !== 'web';

  return StyleSheet.create({
  safe: {
    flex: 1,
  },
  body: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  shellColumn: {
    flex: 1,
    maxWidth: 1320,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: shell ? 20 : mfSpacing.md,
    paddingTop: mfSpacing.md,
    paddingBottom: mfSpacing.sm,
    minHeight: 0,
  },
  unifiedPanel: {
    flex: 1,
    minHeight: 0,
    padding: mfSpacing.md,
    gap: mfSpacing.md,
    overflow: 'hidden',
  },
  mobilePad: {
    flex: 1,
    paddingHorizontal: isNative ? mfSpacing.md : mfSpacing.lg,
    paddingTop: mfSpacing.sm,
    paddingBottom: mfSpacing.md,
    minHeight: 0,
    gap: mfSpacing.md,
  },
  agendaContent: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  calendarPanel: {
    flex: isDesktopLayout ? 1.55 : undefined,
    minWidth: isDesktopLayout ? 0 : undefined,
    minHeight: 0,
    overflow: 'hidden',
  },
  calendarInner: {
    flex: isDesktopLayout ? 1 : undefined,
    minHeight: 0,
    overflow: 'hidden',
  },
  eventsPanel: {
    flex: 1,
    minWidth: isDesktopLayout ? 280 : undefined,
    minHeight: 0,
    overflow: 'hidden',
    flexDirection: 'column',
    ...(Platform.OS === 'web'
      ? ({ display: 'flex', height: '100%' } as object)
      : {}),
  },
  eventsPanelMobile: {
    padding: mfSpacing.md,
    marginBottom: mfSpacing.xl,
  },
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  eventsPanelHeader: {
    flexShrink: 0,
    paddingHorizontal: mfSpacing.md,
    paddingTop: mfSpacing.md,
    paddingBottom: mfSpacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.insetBorder,
  },
  eventsPanelScroll: {
    flex: 1,
    minHeight: 0,
  },
  eventsPanelWebScroll: {
    overflow: 'auto',
    ...(Platform.OS === 'web'
      ? ({ WebkitOverflowScrolling: 'touch' } as object)
      : {}),
  },
  eventsPanelScrollList: {
    paddingHorizontal: mfSpacing.md,
    paddingTop: mfSpacing.sm,
    paddingBottom: mfSpacing.xxl,
  },
  eventsPanelScrollContent: {
    padding: mfSpacing.md,
    paddingBottom: mfSpacing.lg,
    flexGrow: 1,
  },
  fab: {
    position: 'absolute',
    bottom: mfSpacing.lg,
    right: mfSpacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 8px 24px rgba(34, 211, 238, 0.35)' } as object)
      : {
          shadowColor: tokens.accent,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 8,
          elevation: 8,
        }),
  },
  desktopSplit: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: mfSpacing.md,
    minHeight: 0,
  },
  scrollView: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    paddingBottom: mfSpacing.xxl + 48,
    gap: mfSpacing.md,
  },
  eventsTitle: {
    ...mfTypography.subtitle,
    fontSize: 15,
    fontWeight: '700',
    color: theme.text,
    marginBottom: mfSpacing.sm,
    letterSpacing: -0.2,
  },
  weekViewContainer: {
    maxHeight: isDesktopLayout ? AGENDA_CALENDAR_HEIGHT : 600,
  },
  weekGrid: {
    flexDirection: 'column',
  },
  weekEventsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    minHeight: 36,
  },
  weekEventsCell: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: theme.border,
    padding: 4,
    gap: 2,
  },
  weekEventPill: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  weekEventPillText: {
    fontSize: 10,
    fontWeight: '600',
  },
  weekEventMore: {
    fontSize: 9,
    color: theme.textTertiary,
    fontWeight: '600',
    paddingHorizontal: 2,
  },
  dayAllDayRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    minHeight: 40,
  },
  dayAllDayEvents: {
    flex: 1,
    padding: 6,
    gap: 3,
  },
  weekHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  timeColumnHeader: {
    width: 60,
    borderRightWidth: 1,
    borderRightColor: theme.border,
  },
  weekDayHeader: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: theme.border,
    backgroundColor: theme.card,
  },
  weekDayHeaderSelected: {
    backgroundColor: tokens.accentSoft,
  },
  weekDayNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 4,
  },
  weekDayNumberSelected: {
    color: tokens.accent,
  },
  weekDayName: {
    fontSize: 12,
    color: theme.textSecondary,
    textTransform: 'lowercase',
  },
  weekDayNameSelected: {
    color: tokens.accent,
    fontWeight: '600',
  },
  weekRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    minHeight: 60,
  },
  timeColumn: {
    width: 60,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: theme.border,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  timeText: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  weekCell: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: theme.border,
    backgroundColor: theme.card,
    minHeight: 60,
  },
  weekCellSelected: {
    backgroundColor: tokens.accentSoft,
  },
  dayViewContainer: {
    maxHeight: isDesktopLayout ? AGENDA_CALENDAR_HEIGHT : 600,
  },
  dayGrid: {
    flexDirection: 'column',
  },
  dayRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    minHeight: 60,
  },
  dayCellContainer: {
    flex: 1,
    position: 'relative',
  },
  dayCell: {
    flex: 1,
    backgroundColor: theme.background,
    minHeight: 60,
  },
  currentTimeLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: tokens.accent,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentTimeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: tokens.accent,
    marginLeft: -4,
  },
  emptyAgenda: {
    padding: 20,
    alignItems: 'center',
  },
  emptyAgendaText: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  calendar: {
    borderRadius: mfRadius.md,
    backgroundColor: 'transparent',
  },
  googleStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  googleStatusText: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  googleErrorRow: {
    paddingVertical: 8,
    gap: 8,
  },
  googleErrorText: {
    fontSize: 13,
    color: theme.error,
  },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: tokens.accent,
    paddingVertical: mfSpacing.sm,
    paddingHorizontal: mfSpacing.md,
    borderRadius: mfRadius.md,
  },
  retryButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyEvents: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyEventsText: {
    fontSize: 16,
    color: theme.textSecondary,
    marginTop: 16,
    fontWeight: '600',
  },
  emptyEventsSubtext: {
    fontSize: 14,
    color: theme.textTertiary,
    marginTop: 4,
  },
  eventsList: {
    marginTop: mfSpacing.sm,
    gap: mfSpacing.sm,
    paddingBottom: mfSpacing.sm,
  },
  });
};

