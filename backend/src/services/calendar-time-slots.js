/** Referência UI app (Google Agenda lista slots de 15 min) — não é regra de validação. */
export const CALENDAR_TIME_SLOT_INTERVAL_MIN = 15;

export const formatCalendarTimeLabel = (hour, minute) =>
  `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

/**
 * Opcional (UI). Não forçar no WhatsApp — o utilizador pode usar qualquer minuto.
 * @param {number} hour
 * @param {number} minute
 * @returns {{ hour: number, minute: number, wasSnapped: boolean }}
 */
export const snapCalendarTimeToSlot = (hour, minute) => {
  const total = hour * 60 + minute;
  const snapped = Math.round(total / CALENDAR_TIME_SLOT_INTERVAL_MIN) * CALENDAR_TIME_SLOT_INTERVAL_MIN;
  const clamped = Math.max(0, Math.min(snapped, 23 * 60 + 45));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return { hour: h, minute: m, wasSnapped: h !== hour || m !== minute };
};

export const isCalendarTimeOnSlot = (hour, minute) =>
  minute % CALENDAR_TIME_SLOT_INTERVAL_MIN === 0;

/** @returns {Array<{ hour: number, minute: number, label: string }>} */
export const buildGoogleStyleTimeSlots = () => {
  const slots = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (let minute = 0; minute < 60; minute += CALENDAR_TIME_SLOT_INTERVAL_MIN) {
      slots.push({ hour, minute, label: formatCalendarTimeLabel(hour, minute) });
    }
  }
  return slots;
};

const addMinutesToTime = (startHour, startMinute, addMin) => {
  const total = startHour * 60 + startMinute + addMin;
  return {
    hour: Math.floor(total / 60) % 24,
    minute: total % 60,
  };
};

export const buildCalendarAskStartEndTimeMessage = () => [
  'Para agendar com horário, preciso da *hora de início* e da *hora de término*.',
  'Pode ser qualquer duração — ex.: das *14:00* às *14:15* (15 min) ou das *14:00* às *16:00* (2 h).',
  'Formato: HH:MM, "14h", "14h30" ou "das 14 às 16".',
].join('\n');

/**
 * @param {number} startHour
 * @param {number} startMinute
 */
export const buildCalendarAskEndTimeMessage = (startHour, startMinute) => {
  const start = formatCalendarTimeLabel(startHour, startMinute);
  const examples = [15, 60, 120].map((mins) => {
    const t = addMinutesToTime(startHour, startMinute, mins);
    return formatCalendarTimeLabel(t.hour, t.minute);
  });
  return [
    `Qual a *hora de término*? Início: ${start}.`,
    `Ex.: ${examples.join(', ')} — ou outro horário depois de ${start}.`,
  ].join('\n');
};

export const buildCalendarEndBeforeStartMessage = (startHour, startMinute, endHour, endMinute) => {
  const start = formatCalendarTimeLabel(startHour, startMinute);
  const end = formatCalendarTimeLabel(endHour, endMinute);
  return `O término (${end}) precisa ser depois do início (${start}). Informe hora de fim maior que ${start}.`;
};

export const buildCalendarTimeSlotInvalidMessage = (raw) =>
  `Horário "${String(raw || '').trim()}" inválido. Use HH:MM (ex.: 14:00, 14:15, 16:00).`;
