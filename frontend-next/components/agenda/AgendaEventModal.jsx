'use client';

import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { GOOGLE_CALENDAR_COLORS } from '@/lib/googleCalendarColors';
import { parseGoogleEventForForm } from '@/lib/googleCalendarService';
import { AppSelect } from '@/components/ui/AppSelect';

const RECURRENCE_OPTIONS = [
  { label: 'Não se repete', value: null },
  { label: 'Diariamente', value: 'RRULE:FREQ=DAILY' },
  { label: 'Semanalmente', value: 'RRULE:FREQ=WEEKLY' },
  { label: 'Mensalmente', value: 'RRULE:FREQ=MONTHLY' },
  { label: 'Anualmente', value: 'RRULE:FREQ=YEARLY' },
];

const REMINDER_OPTIONS = [
  { label: 'Sem lembrete', value: null },
  { label: 'Na hora do evento', value: 0 },
  { label: '10 minutos antes', value: 10 },
  { label: '30 minutos antes', value: 30 },
  { label: '1 hora antes', value: 60 },
  { label: '1 dia antes', value: 1440 },
];

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function AgendaEventModal({
  open,
  initialDate,
  eventToEdit,
  googleConnected,
  onClose,
  onSubmit,
  onDelete,
  saving,
  error,
}) {
  const isEdit = Boolean(eventToEdit?.id);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [isAllDay, setIsAllDay] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startHour, setStartHour] = useState(9);
  const [startMinute, setStartMinute] = useState(0);
  const [endHour, setEndHour] = useState(10);
  const [endMinute, setEndMinute] = useState(0);
  const [recurrence, setRecurrence] = useState(null);
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState(null);
  const [colorId, setColorId] = useState('2');
  const [createMeetLink, setCreateMeetLink] = useState(false);
  const [localError, setLocalError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLocalError('');
    setConfirmDelete(false);
    if (eventToEdit) {
      const f = parseGoogleEventForForm(eventToEdit);
      setTitle(f.title);
      setDescription(f.description);
      setLocation(f.location);
      setIsAllDay(f.isAllDay);
      setStartDate(f.startDate);
      setEndDate(f.endDate);
      setStartHour(f.startHour);
      setStartMinute(f.startMinute);
      setEndHour(f.endHour);
      setEndMinute(f.endMinute);
      setRecurrence(f.recurrence);
      setRepeatEnabled(f.repeatEnabled);
      setReminderMinutes(f.reminderMinutes);
      setColorId(f.colorId || '2');
      setCreateMeetLink(f.createMeetLink);
    } else {
      const d = initialDate || '';
      setTitle('');
      setDescription('');
      setLocation('');
      setIsAllDay(false);
      setStartDate(d);
      setEndDate(d);
      setStartHour(9);
      setStartMinute(0);
      setEndHour(10);
      setEndMinute(0);
      setRecurrence(null);
      setRepeatEnabled(false);
      setReminderMinutes(null);
      setColorId('2');
      setCreateMeetLink(false);
    }
  }, [open, eventToEdit, initialDate]);

  if (!open) return null;

  const buildPayload = () => ({
    title: title.trim(),
    isAllDay,
    startDate,
    endDate: endDate || startDate,
    startHour,
    startMinute,
    endHour,
    endMinute,
    recurrence: repeatEnabled ? recurrence : null,
    location: location.trim() || undefined,
    description: description.trim() || undefined,
    colorId: colorId || undefined,
    reminderMinutes,
    createMeetLink: createMeetLink && !isAllDay,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    if (!title.trim()) {
      setLocalError('Informe o título do compromisso.');
      return;
    }
    if (!startDate) {
      setLocalError('Informe a data.');
      return;
    }
    if (!googleConnected) {
      setLocalError('Conecte o Google Calendar para criar compromissos.');
      return;
    }
    try {
      await onSubmit(buildPayload(), isEdit ? eventToEdit.id : null);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Falha ao salvar.');
    }
  };

  const displayError = localError || error;
  const deleteTitle = title.trim() || eventToEdit?.summary || 'este compromisso';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Fechar" onClick={() => !saving && onClose()} />
      <form
        onSubmit={handleSubmit}
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-[16px] border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[var(--shadow-card)] sm:rounded-[16px]"
      >
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-[var(--card-border)] bg-[var(--card-bg)] px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">Agenda</p>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              {isEdit ? 'Editar compromisso' : 'Novo compromisso'}
            </h2>
          </div>
          <button type="button" onClick={() => !saving && onClose()} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--card-border)]" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {!googleConnected ? (
            <p className="rounded-[10px] bg-amber-500/10 px-3 py-2 text-sm text-[var(--text-primary)]">
              Conecte o Google Calendar para criar e editar compromissos. Lançamentos locais continuam visíveis.
            </p>
          ) : null}

          <div>
            <label htmlFor="agenda-title" className="mb-1 block text-[10px] font-bold uppercase text-[var(--text-muted)]">Título</label>
            <input id="agenda-title" value={title} onChange={(e) => setTitle(e.target.value)} className="h-11 w-full rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] px-3 text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="agenda-start" className="mb-1 block text-[10px] font-bold uppercase text-[var(--text-muted)]">Início</label>
              <input id="agenda-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-11 w-full rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] px-3 text-sm" />
            </div>
            <div>
              <label htmlFor="agenda-end" className="mb-1 block text-[10px] font-bold uppercase text-[var(--text-muted)]">Término</label>
              <input id="agenda-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-11 w-full rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] px-3 text-sm" />
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-[var(--text-primary)]">
            <input type="checkbox" checked={isAllDay} onChange={(e) => setIsAllDay(e.target.checked)} />
            Dia inteiro
          </label>

          {!isAllDay ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-[var(--text-muted)]">Horário início</label>
                <input
                  type="time"
                  value={`${pad2(startHour)}:${pad2(startMinute)}`}
                  onChange={(e) => {
                    const [h, m] = e.target.value.split(':').map(Number);
                    setStartHour(h);
                    setStartMinute(m);
                  }}
                  className="h-11 w-full rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] px-3 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-[var(--text-muted)]">Horário término</label>
                <input
                  type="time"
                  value={`${pad2(endHour)}:${pad2(endMinute)}`}
                  onChange={(e) => {
                    const [h, m] = e.target.value.split(':').map(Number);
                    setEndHour(h);
                    setEndMinute(m);
                  }}
                  className="h-11 w-full rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] px-3 text-sm"
                />
              </div>
            </div>
          ) : null}

          <div>
            <label htmlFor="agenda-desc" className="mb-1 block text-[10px] font-bold uppercase text-[var(--text-muted)]">Descrição</label>
            <textarea id="agenda-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] px-3 py-2 text-sm" />
          </div>

          <div>
            <label htmlFor="agenda-loc" className="mb-1 block text-[10px] font-bold uppercase text-[var(--text-muted)]">Local</label>
            <input id="agenda-loc" value={location} onChange={(e) => setLocation(e.target.value)} className="h-11 w-full rounded-[12px] border border-[var(--card-border)] bg-[var(--canvas)] px-3 text-sm" />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-[var(--text-muted)]">Cor</label>
            <div className="flex flex-wrap gap-2">
              {GOOGLE_CALENDAR_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-label={c.name}
                  onClick={() => setColorId(c.id)}
                  className={`h-7 w-7 rounded-full border-2 ${colorId === c.id ? 'border-[var(--text-primary)]' : 'border-transparent'}`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={repeatEnabled} onChange={(e) => setRepeatEnabled(e.target.checked)} />
            Repetir
          </label>
          {repeatEnabled ? (
            <AppSelect
              ariaLabel="Repetição do evento"
              value={recurrence || ''}
              onChange={(v) => setRecurrence(v || null)}
              searchable={false}
              compact
              options={RECURRENCE_OPTIONS.filter((o) => o.value).map((o) => ({
                value: o.value,
                label: o.label,
              }))}
            />
          ) : null}

          <AppSelect
            label="Lembrete"
            value={String(reminderMinutes ?? '')}
            onChange={(v) => setReminderMinutes(v === '' ? null : Number(v))}
            searchable={false}
            compact
            options={REMINDER_OPTIONS.map((o) => ({
              value: String(o.value ?? ''),
              label: o.label,
            }))}
          />

          {!isAllDay ? (
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={createMeetLink} onChange={(e) => setCreateMeetLink(e.target.checked)} />
              Gerar link do Google Meet
            </label>
          ) : null}

          {isEdit && repeatEnabled ? (
            <p className="text-xs text-[var(--text-muted)]">
              Alterações em eventos recorrentes afetam toda a série, conforme o Google Calendar.
            </p>
          ) : null}

          {displayError ? (
            <p className="rounded-[10px] bg-red-500/10 px-3 py-2 text-sm text-red-500" role="alert">{displayError}</p>
          ) : null}
        </div>

        <div className="sticky bottom-0 flex flex-col gap-2 border-t border-[var(--card-border)] bg-[var(--card-bg)] px-5 py-4">
          {isEdit && onDelete && !confirmDelete ? (
            <button type="button" onClick={() => setConfirmDelete(true)} className="text-sm font-semibold text-red-500 hover:underline">
              Excluir compromisso
            </button>
          ) : null}
          {confirmDelete ? (
            <div className="rounded-[10px] border border-red-500/30 bg-red-500/5 p-3 text-sm">
              <p>Excluir &quot;{deleteTitle}&quot; em {startDate}?</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Esta ação remove o evento no Google Calendar.</p>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-lg border px-3 py-1.5 text-sm">Cancelar</button>
                <button type="button" disabled={saving} onClick={() => onDelete(eventToEdit.id)} className="rounded-lg bg-red-500 px-3 py-1.5 text-sm text-white">
                  Confirmar exclusão
                </button>
              </div>
            </div>
          ) : null}
          <button type="submit" disabled={saving || !googleConnected} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-[var(--accent)] text-sm font-semibold text-white disabled:opacity-60">
            {saving ? (<><Loader2 className="h-4 w-4 animate-spin" />Salvando…</>) : 'Salvar compromisso'}
          </button>
        </div>
      </form>
    </div>
  );
}
