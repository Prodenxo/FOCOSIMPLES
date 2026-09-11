const SAO_PAULO_TZ = 'America/Sao_Paulo';
const DAY_NAMES = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export { SAO_PAULO_TZ, DAY_NAMES };

export function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Interpreta YYYY-MM-DD no fuso local (evita UTC). */
export function parseLocalYmd(dateString) {
  const [y, m, d] = String(dateString || '').split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function localDateStr(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function todayYmd() {
  return localDateStr(new Date());
}

export function addDaysYmd(ymd, days) {
  const d = parseLocalYmd(ymd);
  d.setDate(d.getDate() + days);
  return localDateStr(d);
}

export function getLocalMonthBounds(dateString) {
  const [y, m] = String(dateString || '').split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function getMonthRangeIso(dateString) {
  const { start, end } = getLocalMonthBounds(dateString);
  return {
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
  };
}

/** Intervalo ampliado para “Próximos dias” (90 dias após seleção). */
export function getUpcomingRangeIso(fromYmd, daysAhead = 90) {
  const start = parseLocalYmd(fromYmd);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + daysAhead);
  end.setHours(23, 59, 59, 999);
  return { timeMin: start.toISOString(), timeMax: end.toISOString() };
}

export function getStartOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

export function getWeekDays(dateString) {
  const start = getStartOfWeek(parseLocalYmd(dateString));
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return day;
  });
}

export function buildMonthGridWeeks(currentMonthYmd) {
  const [y, m] = currentMonthYmd.split('-').map(Number);
  const year = y;
  const month = m - 1;
  const firstDow = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = firstDow === 0 ? 6 : firstDow - 1;

  const cells = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

export function resolveGridDateStr(currentMonthYmd, day, weekIndex, dayIndex) {
  const [y, m] = currentMonthYmd.split('-').map(Number);
  if (day != null) return `${y}-${pad2(m)}-${pad2(day)}`;

  const monthStart = new Date(y, m - 1, 1);
  const firstDow = monthStart.getDay();
  const leading = firstDow === 0 ? 6 : firstDow - 1;
  const cellIndex = weekIndex * 7 + dayIndex;

  if (cellIndex < leading) {
    const prev = new Date(y, m - 1, 0);
    const prevY = prev.getFullYear();
    const prevM = prev.getMonth() + 1;
    const prevLast = prev.getDate();
    const dayNum = prevLast - (leading - cellIndex - 1);
    return `${prevY}-${pad2(prevM)}-${pad2(dayNum)}`;
  }

  const totalDays = new Date(y, m, 0).getDate();
  const monthCells = leading + totalDays;
  if (cellIndex >= monthCells) {
    const nextDay = cellIndex - monthCells + 1;
    const next = new Date(y, m, nextDay);
    return localDateStr(next);
  }
  return null;
}

export function formatPeriodLabel(viewMode, currentMonthYmd, selectedYmd) {
  if (viewMode === 'week') {
    const days = getWeekDays(selectedYmd);
    const start = days[0].toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
    const end = days[6].toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
    return `${start} – ${end}`;
  }
  if (viewMode === 'day') {
    const d = parseLocalYmd(selectedYmd);
    const label = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }
  const [yr, mo] = currentMonthYmd.split('-').map(Number);
  const label = new Date(yr, mo - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatDayPanelTitle(selectedYmd) {
  const d = parseLocalYmd(selectedYmd);
  const label = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatShortDatePt(ymd) {
  const d = parseLocalYmd(ymd);
  const day = d.toLocaleDateString('pt-BR', { day: '2-digit' });
  const month = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  return `${day} ${month.toUpperCase()}`;
}

export function navigatePeriod(viewMode, currentMonthYmd, selectedYmd, direction) {
  const delta = direction === 'next' ? 1 : -1;
  if (viewMode === 'week') {
    const d = parseLocalYmd(selectedYmd);
    d.setDate(d.getDate() + delta * 7);
    const next = localDateStr(d);
    return { selectedYmd: next, currentMonthYmd: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01` };
  }
  if (viewMode === 'day') {
    const d = parseLocalYmd(selectedYmd);
    d.setDate(d.getDate() + delta);
    const next = localDateStr(d);
    return { selectedYmd: next, currentMonthYmd: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01` };
  }
  const [y, m] = currentMonthYmd.split('-').map(Number);
  const target = new Date(y, m - 1 + delta, 1);
  const nextMonth = `${target.getFullYear()}-${pad2(target.getMonth() + 1)}-01`;
  return { currentMonthYmd: nextMonth, selectedYmd: nextMonth.slice(0, 8) + '01' };
}

export function goToToday() {
  const now = new Date();
  const ymd = localDateStr(now);
  return {
    selectedYmd: ymd,
    currentMonthYmd: `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-01`,
  };
}

export function eventSortKey(event) {
  if (event.isAllDay) return `0-${event.dateKey}-${event.title}`;
  const t = event.startDate?.getTime?.() || 0;
  return `1-${String(t).padStart(15, '0')}-${event.title}`;
}

export function compareEvents(a, b) {
  return eventSortKey(a).localeCompare(eventSortKey(b), 'pt-BR');
}
