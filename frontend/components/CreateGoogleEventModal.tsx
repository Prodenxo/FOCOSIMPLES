import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  KeyboardAvoidingView,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ToggleSwitch } from './ToggleSwitch';
import { useMfTheme } from '../components/ui/useMfTheme';
import { mfRadius, mfSpacing, mfTypography } from '../lib/theme';
import { getTechTokens, mfTechInsetSurface, mfTechPanelChrome } from '../lib/techDesign';
import { getWebAgendaEventsScrollStyle, getWebScrollbarStyle, WEB_SCROLL_Y_CLASS } from '../lib/webScrollbar';
import {
  createCustomGoogleEvent,
  deleteGoogleCalendarEvent,
  parseGoogleEventForForm,
  updateCustomGoogleEvent,
  type GoogleCalendarEvent,
} from '../lib/google-calendar';
import {
  GOOGLE_CALENDAR_COLORS,
  getGoogleEventColorHex,
} from '../lib/googleCalendarColors';

const MODAL_MAX_WIDTH = 920;
const WIDE_LAYOUT_MIN = 720;

const RECURRENCE_OPTIONS = [
  { label: 'Não se repete', value: null },
  { label: 'Diariamente', value: 'RRULE:FREQ=DAILY' },
  { label: 'Semanalmente', value: 'RRULE:FREQ=WEEKLY' },
  { label: 'Mensalmente', value: 'RRULE:FREQ=MONTHLY' },
  { label: 'Anualmente', value: 'RRULE:FREQ=YEARLY' },
] as const;

const REMINDER_OPTIONS = [
  { label: 'Sem lembrete', value: null as number | null },
  { label: 'Na hora do evento', value: 0 },
  { label: '10 minutos antes', value: 10 },
  { label: '30 minutos antes', value: 30 },
  { label: '1 hora antes', value: 60 },
  { label: '1 dia antes', value: 1440 },
] as const;

const TIME_SLOT_INTERVAL_MIN = 15;
const TIME_SLOT_ROW_HEIGHT = 46;

type TimeSlot = { label: string; hour: number; minute: number };

function buildGoogleStyleTimeSlots(): TimeSlot[] {
  const slots: TimeSlot[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (let minute = 0; minute < 60; minute += TIME_SLOT_INTERVAL_MIN) {
      slots.push({
        label: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
        hour,
        minute,
      });
    }
  }
  return slots;
}

const TIME_SLOTS = buildGoogleStyleTimeSlots();

function findNearestTimeSlotIndex(hour: number, minute: number): number {
  const totalMinutes = hour * 60 + minute;
  const snapped =
    Math.round(totalMinutes / TIME_SLOT_INTERVAL_MIN) * TIME_SLOT_INTERVAL_MIN;
  const snappedHour = Math.floor(snapped / 60) % 24;
  const snappedMinute = snapped % 60;
  const index = TIME_SLOTS.findIndex(
    (slot) => slot.hour === snappedHour && slot.minute === snappedMinute,
  );
  return index >= 0 ? index : 0;
}

interface Props {
  visible: boolean;
  initialDate?: string;
  eventToEdit?: GoogleCalendarEvent | null;
  onClose: () => void;
  onSuccess: () => void;
  useDialogLayout?: boolean;
}

function SectionLabel({
  dotColor,
  title,
  theme,
}: {
  dotColor: string;
  title: string;
  theme: ReturnType<typeof useMfTheme>['theme'];
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: mfSpacing.sm, marginBottom: mfSpacing.md }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dotColor }} />
      <Text
        style={{
          ...mfTypography.caption,
          color: theme.textSecondary,
          letterSpacing: 0.6,
          fontWeight: '600',
        }}
      >
        {title}
      </Text>
    </View>
  );
}

function FieldLabel({ children, theme }: { children: string; theme: ReturnType<typeof useMfTheme>['theme'] }) {
  return (
    <Text
      style={{
        ...mfTypography.caption,
        color: theme.textTertiary,
        marginBottom: mfSpacing.xs,
        letterSpacing: 0.4,
        fontWeight: '600',
      }}
    >
      {children}
    </Text>
  );
}

export default function CreateGoogleEventModal({
  visible,
  initialDate,
  eventToEdit,
  onClose,
  onSuccess,
  useDialogLayout = false,
}: Props) {
  const isEditMode = !!eventToEdit?.id;
  const insets = useSafeAreaInsets();
  const { theme, isDarkMode } = useMfTheme();
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode]);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isWide = windowWidth >= WIDE_LAYOUT_MIN;
  const isWebDialog = useDialogLayout && Platform.OS === 'web';
  const isNativeFullscreen = Platform.OS !== 'web';
  const fieldInset = useMemo(() => mfTechInsetSurface(isDarkMode, false), [isDarkMode]);
  const panelChrome = useMemo(() => mfTechPanelChrome(isDarkMode, 'surface'), [isDarkMode]);
  const s = useMemo(
    () => createStyles(theme, tokens, isDarkMode, isWide, isWebDialog, windowWidth),
    [theme, tokens, isDarkMode, isWide, isWebDialog, windowWidth],
  );
  const webScrollStyle = useMemo(() => getWebScrollbarStyle(theme), [theme]);
  const webModalScrollClass = Platform.OS === 'web' ? WEB_SCROLL_Y_CLASS : undefined;
  const timeListHeight = useMemo(
    () => Math.min(320, Math.max(240, Math.round(windowHeight * 0.34))),
    [windowHeight],
  );
  const bodyScrollMaxHeight = Math.max(280, Math.min(isWide ? 480 : 520, windowHeight * 0.92 - 168));

  const today = initialDate || new Date().toISOString().split('T')[0];

  const [title, setTitle] = useState('');
  const [isAllDay, setIsAllDay] = useState(false);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [startHour, setStartHour] = useState(9);
  const [startMinute, setStartMinute] = useState(0);
  const [endHour, setEndHour] = useState(10);
  const [endMinute, setEndMinute] = useState(0);
  const [recurrence, setRecurrence] = useState<string | null>(null);
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [colorId, setColorId] = useState<string | null>(null);
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(30);
  const [createMeetLink, setCreateMeetLink] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [showDatePicker, setShowDatePicker] = useState<'start' | 'end' | null>(null);
  const [showTimePicker, setShowTimePicker] = useState<'start' | 'end' | null>(null);
  const timeListScrollRef = useRef<ScrollView>(null);
  const [showRecurrencePicker, setShowRecurrencePicker] = useState(false);
  const [showReminderPicker, setShowReminderPicker] = useState(false);

  const reset = () => {
    setTitle('');
    setIsAllDay(false);
    setStartDate(today);
    setEndDate(today);
    setStartHour(9);
    setStartMinute(0);
    setEndHour(10);
    setEndMinute(0);
    setRecurrence(null);
    setRepeatEnabled(false);
    setLocation('');
    setDescription('');
    setColorId(null);
    setReminderMinutes(30);
    setCreateMeetLink(false);
    setSaving(false);
    setDeleting(false);
    setShowDeleteConfirm(false);
    setDeleteError(null);
    setShowDatePicker(null);
    setShowTimePicker(null);
    setShowRecurrencePicker(false);
    setShowReminderPicker(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  useEffect(() => {
    if (!visible) return;
    if (eventToEdit) {
      const f = parseGoogleEventForForm(eventToEdit);
      setTitle(f.title);
      setIsAllDay(f.isAllDay);
      setStartDate(f.startDate || today);
      setEndDate(f.endDate || f.startDate || today);
      setStartHour(f.startHour);
      setStartMinute(f.startMinute);
      setEndHour(f.endHour);
      setEndMinute(f.endMinute);
      setRecurrence(f.recurrence);
      setRepeatEnabled(f.repeatEnabled);
      setLocation(f.location);
      setDescription(f.description);
      setColorId(f.colorId);
      setReminderMinutes(f.reminderMinutes);
      setCreateMeetLink(f.createMeetLink);
    } else {
      reset();
    }
  }, [visible, eventToEdit?.id]);

  useEffect(() => {
    if (!showTimePicker) return;
    const hour = showTimePicker === 'start' ? startHour : endHour;
    const minute = showTimePicker === 'start' ? startMinute : endMinute;
    const index = findNearestTimeSlotIndex(hour, minute);
    const scrollToSelected = () => {
      timeListScrollRef.current?.scrollTo({
        y: Math.max(0, index * TIME_SLOT_ROW_HEIGHT - timeListHeight * 0.35),
        animated: false,
      });
    };
    requestAnimationFrame(() => {
      scrollToSelected();
      if (Platform.OS === 'web') {
        setTimeout(scrollToSelected, 48);
      }
    });
  }, [showTimePicker, startHour, startMinute, endHour, endMinute, timeListHeight]);

  const fmtDate = (d: string) => {
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  };

  const fmtTime = (h: number, m: number) =>
    `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

  /** Duração padrão do compromisso (início → término). */
  const EVENT_DURATION_MS = 60 * 60 * 1000;

  const syncEndAfterStart = (sh: number, sm: number, sd: string) => {
    const pad2 = (n: number) => String(n).padStart(2, '0');
    const start = new Date(`${sd}T${pad2(sh)}:${pad2(sm)}:00`);
    if (Number.isNaN(start.getTime())) return;
    const end = new Date(start.getTime() + EVENT_DURATION_MS);
    const endD = `${end.getFullYear()}-${pad2(end.getMonth() + 1)}-${pad2(end.getDate())}`;
    setEndDate(endD);
    setEndHour(end.getHours());
    setEndMinute(end.getMinutes());
  };

  const applyStartTime = (hour: number, minute: number, dateStr = startDate) => {
    setStartHour(hour);
    setStartMinute(minute);
    if (!isAllDay) syncEndAfterStart(hour, minute, dateStr);
  };

  const recLabel =
    RECURRENCE_OPTIONS.find((o) => o.value === recurrence)?.label ?? 'Não se repete';

  const reminderLabel =
    REMINDER_OPTIONS.find((o) => o.value === reminderMinutes)?.label ?? 'Sem lembrete';

  const buildPayload = () => ({
    title: title.trim(),
    isAllDay,
    startDate,
    endDate,
    startHour,
    startMinute,
    endHour,
    endMinute,
    recurrence: repeatEnabled ? recurrence : null,
    location: location.trim() || undefined,
    description: description.trim() || undefined,
    colorId: colorId ?? undefined,
    reminderMinutes,
    createMeetLink: createMeetLink && !isAllDay,
  });

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Atenção', 'Informe a descrição do compromisso.');
      return;
    }
    setSaving(true);
    try {
      if (isEditMode && eventToEdit?.id) {
        await updateCustomGoogleEvent(eventToEdit.id, buildPayload());
      } else {
        await createCustomGoogleEvent(buildPayload());
      }
      reset();
      onSuccess();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Não foi possível salvar o compromisso.';
      Alert.alert('Erro', message);
    } finally {
      setSaving(false);
    }
  };

  const deleteTargetName =
    title.trim() || eventToEdit?.summary?.trim() || 'este compromisso';

  const handleDeletePress = () => {
    setDeleteError(null);
    setShowDeleteConfirm(true);
  };

  const handleCancelDelete = () => {
    if (deleting) return;
    setShowDeleteConfirm(false);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!eventToEdit?.id || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteGoogleCalendarEvent(eventToEdit.id);
      setShowDeleteConfirm(false);
      reset();
      onSuccess();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Não foi possível excluir o compromisso.';
      setDeleteError(message);
    } finally {
      setDeleting(false);
    }
  };

  const applyTimeSlot = (which: 'start' | 'end', hour: number, minute: number) => {
    if (which === 'start') {
      applyStartTime(hour, minute);
    } else {
      setEndHour(hour);
      setEndMinute(minute);
    }
    setShowTimePicker(null);
  };

  const activeColorHex = getGoogleEventColorHex(colorId, tokens.accent);
  const accentSoft = isDarkMode ? 'rgba(34, 211, 238, 0.12)' : 'rgba(6, 182, 212, 0.12)';

  const closeTimePicker = () => setShowTimePicker(null);

  const timePickerSurface = showTimePicker ? (
    <View style={[s.sheet, s.timeSheet, panelChrome]} accessibilityViewIsModal>
      <View style={s.timeSheetHeader}>
        <View style={s.timeSheetHeaderText}>
          <Text style={s.timeSheetTitle}>
            {showTimePicker === 'start' ? 'Hora de início' : 'Hora de término'}
          </Text>
          <Text style={s.timeSheetHint}>Intervalos de 15 minutos</Text>
        </View>
        <Pressable
          onPress={closeTimePicker}
          style={({ pressed }) => [s.timeSheetClose, pressed && s.pressed]}
          accessibilityLabel="Fechar seletor de horário"
          hitSlop={8}
        >
          <Ionicons name="close" size={18} color={theme.textSecondary} />
        </Pressable>
      </View>

      <View style={[s.timeListWrap, fieldInset]}>
        <ScrollView
          ref={timeListScrollRef}
          style={[
            s.timeListScroll,
            { height: timeListHeight },
            Platform.OS === 'web' ? webScrollStyle : null,
            Platform.OS === 'web' ? getWebAgendaEventsScrollStyle() : null,
          ]}
          contentContainerStyle={s.timeListContent}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          bounces={false}
          showsVerticalScrollIndicator
          {...(Platform.OS === 'web' ? { className: webModalScrollClass } : {})}
        >
          {TIME_SLOTS.map((slot) => {
            const selectedHour = showTimePicker === 'start' ? startHour : endHour;
            const selectedMinute = showTimePicker === 'start' ? startMinute : endMinute;
            const isSelected = slot.hour === selectedHour && slot.minute === selectedMinute;
            return (
              <Pressable
                key={slot.label}
                style={({ pressed }) => [
                  s.timeSlotRow,
                  isSelected && { backgroundColor: accentSoft },
                  pressed && !isSelected && { backgroundColor: tokens.insetFill },
                ]}
                onPress={() => applyTimeSlot(showTimePicker, slot.hour, slot.minute)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${slot.label}${isSelected ? ', selecionado' : ''}`}
              >
                <Text
                  style={[
                    s.timeSlotText,
                    isSelected && { color: tokens.accent, fontWeight: '600' },
                  ]}
                >
                  {slot.label}
                </Text>
                {isSelected ? (
                  <Ionicons name="checkmark-circle" size={16} color={tokens.accent} />
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  ) : null;

  const timePickerInlineOverlay =
    showTimePicker && isWebDialog && Platform.OS === 'web' ? (
      <View style={s.timePickerOverlay} pointerEvents="box-none">
        <Pressable
          style={s.timePickerBackdrop}
          onPress={closeTimePicker}
          accessibilityLabel="Fechar seletor de horário"
        />
        <View style={s.timePickerCenter} pointerEvents="box-none">
          {timePickerSurface}
        </View>
      </View>
    ) : null;

  const basicColumn = (
    <View style={s.column}>
      <SectionLabel dotColor={tokens.accent} title="INFORMAÇÕES BÁSICAS" theme={theme} />

      <View style={s.fieldBlock}>
        <FieldLabel theme={theme}>DESCRIÇÃO</FieldLabel>
        <TextInput
          style={[s.input, fieldInset]}
          placeholder="Ex: Reunião com cliente"
          placeholderTextColor={theme.placeholder}
          value={title}
          onChangeText={setTitle}
          autoFocus={isWebDialog}
        />
      </View>

      <View style={s.fieldBlock}>
        <FieldLabel theme={theme}>DATA</FieldLabel>
        <Pressable
          style={({ pressed }) => [s.inputRow, fieldInset, pressed && s.pressed]}
          onPress={() => setShowDatePicker('start')}
        >
          <Ionicons name="calendar-outline" size={18} color={theme.textSecondary} />
          <Text style={s.inputRowText}>{fmtDate(startDate)}</Text>
        </Pressable>
      </View>

      {!isAllDay ? (
        <View style={s.timeRow}>
          <View style={[s.fieldBlock, { flex: 1 }]}>
            <FieldLabel theme={theme}>INÍCIO</FieldLabel>
            <Pressable
              style={({ pressed }) => [s.inputRow, fieldInset, pressed && s.pressed]}
              onPress={() => setShowTimePicker('start')}
            >
              <Text style={s.inputRowText}>{fmtTime(startHour, startMinute)}</Text>
              <Ionicons name="time-outline" size={18} color={theme.textSecondary} />
            </Pressable>
          </View>
          <View style={[s.fieldBlock, { flex: 1 }]}>
            <FieldLabel theme={theme}>TÉRMINO</FieldLabel>
            <Pressable
              style={({ pressed }) => [s.inputRow, fieldInset, pressed && s.pressed]}
              onPress={() => setShowTimePicker('end')}
            >
              <Text style={s.inputRowText}>{fmtTime(endHour, endMinute)}</Text>
              <Ionicons name="time-outline" size={18} color={theme.textSecondary} />
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={s.fieldBlock}>
          <FieldLabel theme={theme}>ATÉ</FieldLabel>
          <Pressable
            style={({ pressed }) => [s.inputRow, fieldInset, pressed && s.pressed]}
            onPress={() => setShowDatePicker('end')}
          >
            <Ionicons name="calendar-outline" size={18} color={theme.textSecondary} />
            <Text style={s.inputRowText}>{fmtDate(endDate)}</Text>
          </Pressable>
        </View>
      )}

      <View style={[s.optionCard, fieldInset]}>
        <Text style={s.optionTitle}>Dia inteiro</Text>
        <ToggleSwitch value={isAllDay} onValueChange={setIsAllDay} activeColor={tokens.accent} />
      </View>
    </View>
  );

  const optionsSection = (
    <View style={s.optionsSection}>
      <SectionLabel dotColor={tokens.accent} title="OPÇÕES ADICIONAIS" theme={theme} />

      <Pressable
        style={({ pressed }) => [s.optionCard, fieldInset, pressed && s.pressed]}
        onPress={() => setShowReminderPicker(true)}
      >
        <View style={[s.optionIcon, { backgroundColor: accentSoft }]}>
          <Ionicons name="notifications-outline" size={20} color={tokens.accent} />
        </View>
        <View style={s.optionBody}>
          <Text style={s.optionTitle}>Lembrete</Text>
          <Text style={s.optionSub}>{reminderLabel}</Text>
        </View>
        <Ionicons name="chevron-down" size={18} color={theme.textTertiary} />
      </Pressable>

      <View style={[s.optionCard, fieldInset]}>
        <View style={[s.optionIcon, { backgroundColor: accentSoft }]}>
          <Ionicons name="location-outline" size={20} color={tokens.accent} />
        </View>
        <View style={[s.optionBody, { flex: 1 }]}>
          <Text style={s.optionTitle}>Local</Text>
          <TextInput
            style={s.optionInlineInput}
            placeholder="Adicionar local"
            placeholderTextColor={theme.placeholder}
            value={location}
            onChangeText={setLocation}
          />
        </View>
      </View>

      <View style={[s.optionCard, s.colorCard, fieldInset]}>
        <View style={s.colorCardHeader}>
          <View style={[s.optionIcon, { backgroundColor: accentSoft }]}>
            <View style={[s.colorPreview, { backgroundColor: activeColorHex }]} />
          </View>
          <Text style={s.optionTitle}>Cor do evento</Text>
        </View>
        <View style={s.colorGrid}>
          <Pressable
            onPress={() => setColorId(null)}
            style={({ pressed }) => [
              s.colorSwatchWrap,
              !colorId && { borderColor: tokens.accent },
              pressed && s.pressed,
            ]}
          >
            <View style={[s.colorSwatch, { backgroundColor: tokens.accent }]} />
          </Pressable>
          {GOOGLE_CALENDAR_COLORS.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => setColorId(c.id)}
              style={({ pressed }) => [
                s.colorSwatchWrap,
                colorId === c.id && { borderColor: c.hex },
                pressed && s.pressed,
              ]}
            >
              <View style={[s.colorSwatch, { backgroundColor: c.hex }]}>
                {colorId === c.id ? (
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={[s.optionCard, fieldInset]}>
        <View style={[s.optionIcon, { backgroundColor: theme.successLight }]}>
          <Ionicons name="logo-google" size={20} color={theme.success} />
        </View>
        <View style={s.optionBody}>
          <Text style={s.optionTitle}>Google Agenda</Text>
          <Text style={s.optionSub}>Este compromisso será sincronizado automaticamente</Text>
        </View>
        <Ionicons name="checkmark-circle" size={22} color={theme.success} />
      </View>

      <View style={[s.optionCard, fieldInset]}>
        <View style={[s.optionIcon, { backgroundColor: 'rgba(20, 184, 166, 0.15)' }]}>
          <Ionicons name="videocam-outline" size={20} color="#14B8A6" />
        </View>
        <View style={s.optionBody}>
          <Text style={s.optionTitle}>Google Meet</Text>
          <Text style={s.optionSub}>
            {isAllDay ? 'Indisponível em eventos de dia inteiro' : 'Gerar link de reunião'}
          </Text>
        </View>
        <ToggleSwitch
          value={createMeetLink}
          onValueChange={setCreateMeetLink}
          activeColor="#14B8A6"
          disabled={isAllDay}
        />
      </View>

      <View style={[s.optionCard, fieldInset]}>
        <View style={[s.optionIcon, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
          <Ionicons name="repeat-outline" size={20} color="#8B5CF6" />
        </View>
        <View style={s.optionBody}>
          <Text style={s.optionTitle}>Repetir</Text>
          <Text style={s.optionSub}>{repeatEnabled ? recLabel : 'Não se repete'}</Text>
        </View>
        <ToggleSwitch
          value={repeatEnabled}
          onValueChange={(on) => {
            setRepeatEnabled(on);
            if (on && !recurrence) setShowRecurrencePicker(true);
            if (!on) setRecurrence(null);
          }}
          activeColor="#8B5CF6"
        />
      </View>

      {repeatEnabled ? (
        <Pressable
          style={({ pressed }) => [s.optionCard, fieldInset, pressed && s.pressed]}
          onPress={() => setShowRecurrencePicker(true)}
        >
          <Text style={[s.optionSub, { flex: 1, color: theme.text }]}>Frequência: {recLabel}</Text>
          <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
        </Pressable>
      ) : null}

      <View style={s.fieldBlock}>
        <FieldLabel theme={theme}>OBSERVAÇÕES</FieldLabel>
        <TextInput
          style={[s.input, s.textArea, fieldInset]}
          placeholder="Detalhes adicionais (opcional)"
          placeholderTextColor={theme.placeholder}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>
    </View>
  );

  const modalTitle = isEditMode ? 'Editar compromisso' : 'Novo compromisso';
  const modalEyebrow = isEditMode ? 'Agenda' : 'Cronograma';

  const footerActions = (
    <View style={s.footer}>
      {isEditMode ? (
        <Pressable
          onPress={handleDeletePress}
          style={({ pressed }) => [
            s.deleteBtn,
            pressed && s.pressed,
            (saving || deleting) && s.saveBtnDisabled,
          ]}
          disabled={saving || deleting}
          accessibilityLabel="Excluir compromisso"
        >
          {deleting ? (
            <ActivityIndicator size="small" color={theme.error} />
          ) : (
            <>
              <Ionicons name="trash-outline" size={18} color={theme.error} />
              <Text style={s.deleteBtnText}>Excluir</Text>
            </>
          )}
        </Pressable>
      ) : (
        <View style={s.footerSpacer} />
      )}
      <TouchableOpacity
        onPress={() => void handleSave()}
        style={[s.saveBtn, (saving || deleting) && s.saveBtnDisabled]}
        disabled={saving || deleting}
        accessibilityRole="button"
        accessibilityLabel={isEditMode ? 'Salvar alterações' : 'Salvar compromisso'}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={s.saveBtnText}>
            {isEditMode ? 'Salvar alterações' : 'Salvar compromisso'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const header = (
    <View style={s.header}>
      {!isWebDialog ? (
        <TouchableOpacity
          onPress={handleClose}
          style={s.headerIconBtn}
          accessibilityLabel="Voltar"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
      ) : (
        <View style={s.headerSpacer} />
      )}
      <View style={[s.headerTextCol, !isWebDialog && s.headerTextColNative]}>
        {isWebDialog ? (
          <View style={s.eyebrowRow}>
            <View style={[s.dot, { backgroundColor: tokens.accent }]} />
            <Text style={[s.eyebrow, { color: tokens.accent }]}>{modalEyebrow}</Text>
          </View>
        ) : null}
        <Text style={s.headerTitle}>{modalTitle}</Text>
        {!isWebDialog ? (
          <Text style={s.headerSubtitle}>
            {isEditMode ? 'Atualize ou exclua o evento' : 'Agende um novo evento no Google'}
          </Text>
        ) : null}
      </View>
      {isWebDialog ? (
        <TouchableOpacity
          onPress={handleClose}
          style={s.headerIconBtn}
          accessibilityLabel="Fechar"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={22} color={theme.textSecondary} />
        </TouchableOpacity>
      ) : (
        <View style={s.headerSpacer} />
      )}
    </View>
  );

  const formScroll = (
    <ScrollView
      style={[
        isWebDialog ? s.bodyScrollDialog : s.bodyScrollFill,
        Platform.OS === 'web' ? webScrollStyle : null,
        isWebDialog ? { maxHeight: bodyScrollMaxHeight } : null,
      ]}
      contentContainerStyle={isWide ? s.bodyWideContent : s.bodyStackContent}
      showsVerticalScrollIndicator={!isWebDialog}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      bounces={false}
      {...(Platform.OS === 'web' ? { className: webModalScrollClass } : {})}
    >
      <View style={isWide ? s.bodyWide : s.bodyStack}>
        {basicColumn}
        {optionsSection}
      </View>
    </ScrollView>
  );

  const mainModal = isWebDialog ? (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={s.dialogOverlay}>
        <Pressable style={s.backdropPressable} onPress={handleClose} accessibilityLabel="Fechar" />
        <View style={s.dialogShell} pointerEvents="box-none">
          <View style={[s.dialogCard, panelChrome]} pointerEvents="auto">
            {header}
            {formScroll}
            <View style={s.dialogFooter}>{footerActions}</View>
          </View>
        </View>
        {timePickerInlineOverlay}
      </View>
    </Modal>
  ) : isNativeFullscreen ? (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <SafeAreaView style={s.fullRoot} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={s.fullFlex}
        >
          {header}
          {formScroll}
          <View style={[s.fullFooter, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            {footerActions}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  ) : (
    <Modal visible={visible} animationType="fade" onRequestClose={handleClose}>
      <View
        style={[
          s.fullRoot,
          s.fullRootWeb,
          { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        {header}
        {formScroll}
        <View style={s.fullFooter}>{footerActions}</View>
      </View>
    </Modal>
  );

  return (
    <>
      {mainModal}

      {showDatePicker ? (
        <Modal transparent animationType="fade" onRequestClose={() => setShowDatePicker(null)}>
          <Pressable style={s.sheetBackdrop} onPress={() => setShowDatePicker(null)}>
            <Pressable style={s.sheet} onPress={() => {}}>
              <Text style={s.sheetTitle}>
                {showDatePicker === 'start' ? 'Data de início' : 'Data de término'}
              </Text>
              <Calendar
                current={showDatePicker === 'start' ? startDate : endDate}
                minDate={showDatePicker === 'end' ? startDate : undefined}
                onDayPress={(day) => {
                  if (showDatePicker === 'start') {
                    setStartDate(day.dateString);
                    if (!isAllDay) syncEndAfterStart(startHour, startMinute, day.dateString);
                    else if (day.dateString > endDate) setEndDate(day.dateString);
                  } else {
                    setEndDate(day.dateString);
                  }
                  setShowDatePicker(null);
                }}
                markedDates={{
                  [showDatePicker === 'start' ? startDate : endDate]: {
                    selected: true,
                    selectedColor: tokens.accent,
                  },
                }}
                theme={{
                  backgroundColor: theme.card,
                  calendarBackground: theme.card,
                  textSectionTitleColor: theme.textSecondary,
                  selectedDayBackgroundColor: tokens.accent,
                  selectedDayTextColor: isDarkMode ? '#041018' : '#FFFFFF',
                  todayTextColor: tokens.accent,
                  dayTextColor: theme.text,
                  monthTextColor: theme.text,
                  arrowColor: tokens.accent,
                }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      {showTimePicker && !(isWebDialog && Platform.OS === 'web') ? (
        <Modal transparent animationType="fade" onRequestClose={closeTimePicker}>
          <Pressable style={s.sheetBackdrop} onPress={closeTimePicker}>
            <View style={s.timePickerCenter} pointerEvents="box-none">
              {timePickerSurface}
            </View>
          </Pressable>
        </Modal>
      ) : null}

      {showRecurrencePicker ? (
        <Modal transparent animationType="fade" onRequestClose={() => setShowRecurrencePicker(false)}>
          <Pressable style={s.sheetBackdrop} onPress={() => setShowRecurrencePicker(false)}>
            <Pressable style={s.sheet} onPress={() => {}}>
              <Text style={s.sheetTitle}>Repetição</Text>
              {RECURRENCE_OPTIONS.filter((o) => o.value !== null).map((opt) => (
                <Pressable
                  key={opt.label}
                  style={({ pressed }) => [s.sheetRow, pressed && s.pressed]}
                  onPress={() => {
                    setRecurrence(opt.value);
                    setRepeatEnabled(true);
                    setShowRecurrencePicker(false);
                  }}
                >
                  <Text
                    style={[
                      s.sheetRowText,
                      recurrence === opt.value && { color: tokens.accent, fontWeight: '600' },
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {recurrence === opt.value ? (
                    <Ionicons name="checkmark" size={18} color={tokens.accent} />
                  ) : null}
                </Pressable>
              ))}
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      {showReminderPicker ? (
        <Modal transparent animationType="fade" onRequestClose={() => setShowReminderPicker(false)}>
          <Pressable style={s.sheetBackdrop} onPress={() => setShowReminderPicker(false)}>
            <Pressable style={s.sheet} onPress={() => {}}>
              <Text style={s.sheetTitle}>Lembrete</Text>
              {REMINDER_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.label}
                  style={({ pressed }) => [s.sheetRow, pressed && s.pressed]}
                  onPress={() => {
                    setReminderMinutes(opt.value);
                    setShowReminderPicker(false);
                  }}
                >
                  <Text
                    style={[
                      s.sheetRowText,
                      reminderMinutes === opt.value && { color: tokens.accent, fontWeight: '600' },
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {reminderMinutes === opt.value ? (
                    <Ionicons name="checkmark" size={18} color={tokens.accent} />
                  ) : null}
                </Pressable>
              ))}
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      <Modal
        visible={showDeleteConfirm}
        transparent
        animationType="fade"
        onRequestClose={handleCancelDelete}
      >
        <Pressable style={s.confirmBackdrop} onPress={handleCancelDelete}>
          <Pressable style={s.confirmDialog} onPress={() => {}}>
            <View style={[s.confirmIconBox, { backgroundColor: `${theme.error}22` }]}>
              <Ionicons name="trash-outline" size={28} color={theme.error} />
            </View>
            <Text style={s.confirmTitle}>Excluir compromisso?</Text>
            <Text style={s.confirmMessage}>
              {`Tem certeza que deseja excluir "${deleteTargetName}"? Esta ação não pode ser desfeita.`}
            </Text>
            {deleteError ? (
              <Text style={s.confirmError}>{deleteError}</Text>
            ) : null}
            <View style={s.confirmActions}>
              <Pressable
                onPress={handleCancelDelete}
                disabled={deleting}
                style={({ pressed }) => [
                  s.confirmBtn,
                  s.confirmBtnCancel,
                  { borderColor: theme.border },
                  pressed && s.pressed,
                  deleting && s.saveBtnDisabled,
                ]}
              >
                <Text style={[s.confirmBtnCancelText, { color: theme.text }]}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={() => void handleConfirmDelete()}
                disabled={deleting}
                style={({ pressed }) => [
                  s.confirmBtn,
                  s.confirmBtnDanger,
                  { backgroundColor: theme.error },
                  pressed && s.pressed,
                  deleting && s.saveBtnDisabled,
                ]}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={s.confirmBtnDangerText}>Excluir</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function createStyles(
  theme: ReturnType<typeof useMfTheme>['theme'],
  tokens: ReturnType<typeof getTechTokens>,
  isDarkMode: boolean,
  isWide: boolean,
  isWebDialog: boolean,
  windowWidth: number,
) {
  const dialogMaxWidth = Math.min(MODAL_MAX_WIDTH, windowWidth >= 960 ? MODAL_MAX_WIDTH : windowWidth - 32);

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
    backdropPressable: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.72)' : 'rgba(15, 23, 42, 0.55)',
    },
    dialogShell: {
      width: '100%',
      maxWidth: dialogMaxWidth,
      maxHeight: '92vh' as unknown as number,
      zIndex: 1,
    },
    dialogCard: {
      maxHeight: '92vh' as unknown as number,
      overflow: 'hidden',
      ...(Platform.OS === 'web'
        ? ({ boxShadow: '0 24px 48px rgba(0, 0, 0, 0.45)' } as object)
        : {}),
    },
    dialogFooter: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: tokens.insetBorder,
    },
    fullRoot: {
      flex: 1,
      backgroundColor: isDarkMode ? '#0a0f16' : theme.background,
    },
    fullRootWeb: {
      ...(Platform.OS === 'web'
        ? ({
            minHeight: '100vh',
            height: '100%',
            width: '100%',
          } as object)
        : {}),
    },
    fullFlex: {
      flex: 1,
      minHeight: 0,
    },
    fullFooter: {
      paddingHorizontal: mfSpacing.lg,
      paddingTop: mfSpacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: tokens.insetBorder,
      backgroundColor: isDarkMode ? '#0a0f16' : theme.background,
    },
    backdrop: {
      flex: 1,
      backgroundColor: isDarkMode ? 'rgba(0,0,0,0.72)' : 'rgba(15,23,42,0.45)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: mfSpacing.md,
    },
    dialog: {
      width: '100%',
      maxWidth: MODAL_MAX_WIDTH,
      backgroundColor: theme.card,
      borderRadius: mfRadius.xl,
      borderWidth: 1,
      borderColor: tokens.insetBorder,
      overflow: 'hidden',
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
    },
    headerTextColNative: {
      alignItems: 'flex-start',
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
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: mfSpacing.md,
      flex: 1,
    },
    headerIconBox: {
      width: 44,
      height: 44,
      borderRadius: mfRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      ...mfTypography.subtitle,
      fontSize: isWebDialog ? 17 : 18,
      fontWeight: '700',
      color: theme.text,
      letterSpacing: -0.3,
    },
    headerSubtitle: {
      ...mfTypography.body,
      color: theme.textSecondary,
      marginTop: 4,
      fontSize: 13,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: tokens.insetFill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bodyScrollDialog: {
      flexGrow: 0,
      flexShrink: 1,
    },
    bodyScrollFill: {
      flexGrow: 1,
      flexShrink: 1,
      minHeight: 0,
      flex: 1,
    },
    bodyWideContent: {
      flexGrow: 1,
    },
    bodyStackContent: {
      flexGrow: 1,
    },
    bodyWide: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    bodyStack: {
      flexDirection: 'column',
    },
    column: {
      flex: isWide ? 1 : undefined,
      padding: mfSpacing.lg,
      borderRightWidth: isWide ? StyleSheet.hairlineWidth : 0,
      borderRightColor: theme.border,
      borderBottomWidth: isWide ? 0 : StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    optionsSection: {
      flex: isWide ? 1 : undefined,
      padding: mfSpacing.lg,
      paddingBottom: mfSpacing.xl,
    },
    fieldBlock: {
      marginBottom: mfSpacing.md,
    },
    input: {
      ...mfTypography.body,
      color: theme.text,
      borderRadius: mfRadius.sm,
      paddingHorizontal: mfSpacing.md,
      paddingVertical: Platform.OS === 'web' ? mfSpacing.sm : mfSpacing.md,
      minHeight: 44,
    },
    textArea: {
      minHeight: 88,
      textAlignVertical: 'top',
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: mfRadius.sm,
      paddingHorizontal: mfSpacing.md,
      paddingVertical: mfSpacing.sm,
      minHeight: 44,
      gap: mfSpacing.sm,
    },
    inputRowText: {
      ...mfTypography.bodyStrong,
      color: theme.text,
      flex: 1,
    },
    timeRow: {
      flexDirection: 'row',
      gap: mfSpacing.md,
    },
    optionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: mfSpacing.md,
      padding: mfSpacing.md,
      borderRadius: mfRadius.sm,
      marginBottom: mfSpacing.sm,
    },
    optionIcon: {
      width: 40,
      height: 40,
      borderRadius: mfRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionBody: {
      flex: 1,
      minWidth: 0,
    },
    optionTitle: {
      ...mfTypography.bodyStrong,
      color: theme.text,
    },
    optionSub: {
      ...mfTypography.caption,
      color: theme.textSecondary,
      marginTop: 2,
    },
    optionInlineInput: {
      ...mfTypography.body,
      color: theme.text,
      marginTop: mfSpacing.xs,
      padding: 0,
    },
    colorCard: {
      flexDirection: 'column',
      alignItems: 'stretch',
    },
    colorCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: mfSpacing.md,
      marginBottom: mfSpacing.sm,
    },
    colorPreview: {
      width: 18,
      height: 18,
      borderRadius: 9,
    },
    colorGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: mfSpacing.sm,
    },
    colorSwatchWrap: {
      padding: 2,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    colorSwatch: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: mfSpacing.md,
      paddingHorizontal: mfSpacing.lg,
      paddingVertical: mfSpacing.md,
    },
    footerSpacer: {
      flex: 1,
    },
    deleteBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: mfSpacing.xs,
      paddingHorizontal: mfSpacing.md,
      paddingVertical: mfSpacing.sm,
      borderRadius: mfRadius.pill,
      borderWidth: 1,
      borderColor: theme.error,
      minWidth: 120,
      justifyContent: 'center',
    },
    deleteBtnText: {
      ...mfTypography.bodyStrong,
      color: theme.error,
    },
    confirmBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: mfSpacing.lg,
    },
    confirmDialog: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: theme.card,
      borderRadius: mfRadius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: mfSpacing.lg,
      alignItems: 'center',
    },
    confirmIconBox: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: mfSpacing.md,
    },
    confirmTitle: {
      ...mfTypography.subtitle,
      color: theme.text,
      textAlign: 'center',
      marginBottom: mfSpacing.sm,
    },
    confirmMessage: {
      ...mfTypography.body,
      color: theme.textSecondary,
      textAlign: 'center',
      marginBottom: mfSpacing.md,
    },
    confirmError: {
      ...mfTypography.caption,
      color: theme.error,
      textAlign: 'center',
      marginBottom: mfSpacing.md,
    },
    confirmActions: {
      flexDirection: 'row',
      gap: mfSpacing.sm,
      width: '100%',
    },
    confirmBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: mfSpacing.sm,
      borderRadius: mfRadius.md,
      minHeight: 44,
    },
    confirmBtnCancel: {
      borderWidth: 1,
      backgroundColor: theme.backgroundMuted,
    },
    confirmBtnCancelText: {
      ...mfTypography.bodyStrong,
    },
    confirmBtnDanger: {},
    confirmBtnDangerText: {
      ...mfTypography.bodyStrong,
      color: '#FFFFFF',
    },
    saveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: mfSpacing.sm,
      paddingHorizontal: mfSpacing.lg,
      paddingVertical: mfSpacing.sm,
      borderRadius: mfRadius.sm,
      backgroundColor: tokens.accent,
      minWidth: isWebDialog ? 200 : undefined,
      flex: isWebDialog ? undefined : 1,
      minHeight: 44,
    },
    saveBtnDisabled: {
      opacity: 0.7,
    },
    saveBtnText: {
      ...mfTypography.bodyStrong,
      color: isDarkMode ? '#041018' : '#FFFFFF',
    },
    pressed: { opacity: 0.88 },
    sheetBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: mfSpacing.lg,
    },
    sheetBackdropSoft: {
      backgroundColor: isDarkMode ? 'rgba(0,0,0,0.38)' : 'rgba(15,23,42,0.28)',
    },
    timePickerOverlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 30,
      justifyContent: 'center',
      alignItems: 'center',
    },
    timePickerBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: isDarkMode ? 'rgba(0,0,0,0.45)' : 'rgba(15,23,42,0.32)',
    },
    timePickerCenter: {
      width: '100%',
      maxWidth: 300,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: mfSpacing.lg,
      zIndex: 31,
    },
    sheet: {
      backgroundColor: theme.card,
      borderRadius: mfRadius.lg,
      padding: mfSpacing.lg,
      width: '100%',
      maxWidth: 400,
      borderWidth: 1,
      borderColor: theme.border,
    },
    sheetTitle: {
      ...mfTypography.subtitle,
      color: theme.text,
      marginBottom: mfSpacing.md,
    },
    sheetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: mfSpacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    sheetRowText: {
      ...mfTypography.body,
      color: theme.text,
    },
    timeSheet: {
      width: '100%',
      maxWidth: 300,
      padding: 0,
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: isDarkMode
              ? '0 24px 48px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06)'
              : '0 20px 40px rgba(15,23,42,0.14), 0 0 0 1px rgba(15,23,42,0.06)',
          } as object)
        : {}),
    },
    timeSheetHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: mfSpacing.sm,
      paddingHorizontal: mfSpacing.lg,
      paddingTop: mfSpacing.lg,
      paddingBottom: mfSpacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    timeSheetHeaderText: {
      flex: 1,
      minWidth: 0,
    },
    timeSheetTitle: {
      ...mfTypography.subtitle,
      fontSize: 15,
      color: theme.text,
    },
    timeSheetHint: {
      ...mfTypography.caption,
      color: theme.textTertiary,
      marginTop: 2,
    },
    timeSheetClose: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tokens.insetFill,
    },
    timeListWrap: {
      margin: mfSpacing.md,
      marginTop: mfSpacing.sm,
      marginBottom: mfSpacing.md,
      borderRadius: mfRadius.md,
    },
    timeListScroll: {
      flexGrow: 0,
      flexShrink: 0,
    },
    timeListContent: {
      paddingVertical: mfSpacing.xs,
      paddingHorizontal: mfSpacing.xs,
    },
    timeSlotRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      paddingHorizontal: mfSpacing.md,
      borderRadius: mfRadius.sm,
      marginBottom: 2,
      minHeight: 42,
    },
    timeSlotText: {
      ...mfTypography.body,
      fontSize: 15,
      color: theme.text,
      ...(Platform.OS === 'web' ? ({ fontVariant: ['tabular-nums'] } as object) : {}),
    },
  });
}
