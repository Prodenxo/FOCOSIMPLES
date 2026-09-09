'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { AppFooter } from '@/components/layout/AppFooter';
import { AgendaDayPanel } from '@/components/agenda/AgendaDayPanel';
import { AgendaDayTimeline } from '@/components/agenda/AgendaDayTimeline';
import { AgendaEventModal } from '@/components/agenda/AgendaEventModal';
import { AgendaMonthGrid } from '@/components/agenda/AgendaMonthGrid';
import { AgendaToolbar } from '@/components/agenda/AgendaToolbar';
import { AgendaUpcoming } from '@/components/agenda/AgendaUpcoming';
import { AgendaWeekView } from '@/components/agenda/AgendaWeekView';
import { Card } from '@/components/ui/Card';
import { useAgendaData } from '@/hooks/useAgendaData';
import {
  formatDayPanelTitle,
  formatPeriodLabel,
  goToToday,
  navigatePeriod,
  todayYmd,
} from '@/lib/agendaUtils';
import {
  captureGoogleCalendarOAuthReturn,
  consumeGoogleCalendarOAuthReturn,
  createCustomGoogleEvent,
  deleteGoogleCalendarEvent,
  startGoogleAuthFlow,
  updateCustomGoogleEvent,
} from '@/lib/googleCalendarService';

export default function AgendaPage() {
  const [selectedYmd, setSelectedYmd] = useState(todayYmd);
  const [currentMonthYmd, setCurrentMonthYmd] = useState(() => {
    const t = todayYmd();
    return `${t.slice(0, 7)}-01`;
  });
  const [viewMode, setViewMode] = useState('month');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [detailEvent, setDetailEvent] = useState(null);
  const [googleConnecting, setGoogleConnecting] = useState(false);
  const [oauthBanner, setOauthBanner] = useState(null);

  const {
    combinedEvents,
    dayEvents,
    upcoming,
    monthUniqueCount,
    txLoading,
    txError,
    googleLoading,
    googleError,
    googleConnected,
    googleStatus,
    reload,
  } = useAgendaData({ currentMonthYmd, selectedYmd, viewMode });

  useEffect(() => {
    captureGoogleCalendarOAuthReturn();
    const status = consumeGoogleCalendarOAuthReturn();
    if (status === 'connected') {
      setOauthBanner('Google Calendar conectado com sucesso.');
      reload();
    } else if (status === 'error') {
      setOauthBanner('Não foi possível conectar o Google Calendar. Tente novamente.');
    }
  }, [reload]);

  const periodLabel = useMemo(
    () => formatPeriodLabel(viewMode, currentMonthYmd, selectedYmd),
    [viewMode, currentMonthYmd, selectedYmd],
  );

  const panelTitle = useMemo(() => formatDayPanelTitle(selectedYmd), [selectedYmd]);

  const handleSelectDate = useCallback((dateStr, changeMonth) => {
    setSelectedYmd(dateStr);
    setDetailEvent(null);
    if (changeMonth) {
      setCurrentMonthYmd(`${dateStr.slice(0, 7)}-01`);
    }
  }, []);

  const handleSelectEvent = useCallback((event, dateStr) => {
    setSelectedYmd(dateStr);
    setDetailEvent(event);
    if (event.source === 'google' && event.rawGoogleEvent) {
      setEditingEvent(event.rawGoogleEvent);
    }
  }, []);

  const handlePrevious = () => {
    const next = navigatePeriod(viewMode, currentMonthYmd, selectedYmd, 'prev');
    setCurrentMonthYmd(next.currentMonthYmd);
    setSelectedYmd(next.selectedYmd);
  };

  const handleNext = () => {
    const next = navigatePeriod(viewMode, currentMonthYmd, selectedYmd, 'next');
    setCurrentMonthYmd(next.currentMonthYmd);
    setSelectedYmd(next.selectedYmd);
  };

  const handleToday = () => {
    const next = goToToday();
    setCurrentMonthYmd(next.currentMonthYmd);
    setSelectedYmd(next.selectedYmd);
  };

  const openCreate = () => {
    setEditingEvent(null);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (event) => {
    if (event.rawGoogleEvent) {
      setEditingEvent(event.rawGoogleEvent);
      setFormError('');
      setModalOpen(true);
    }
  };

  const handleConnectGoogle = async () => {
    setGoogleConnecting(true);
    setOauthBanner(null);
    try {
      const returnTo = typeof window !== 'undefined' ? `${window.location.origin}/agenda` : undefined;
      await startGoogleAuthFlow(returnTo);
    } catch (err) {
      setOauthBanner(err instanceof Error ? err.message : 'Falha ao iniciar conexão com Google.');
      setGoogleConnecting(false);
    }
  };

  const handleSave = async (payload, eventId) => {
    setSaving(true);
    setFormError('');
    try {
      if (eventId) await updateCustomGoogleEvent(eventId, payload);
      else await createCustomGoogleEvent(payload);
      setModalOpen(false);
      setEditingEvent(null);
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Falha ao salvar compromisso.');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (eventId) => {
    setSaving(true);
    try {
      await deleteGoogleCalendarEvent(eventId);
      setModalOpen(false);
      setEditingEvent(null);
      setDetailEvent(null);
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Falha ao excluir compromisso.');
    } finally {
      setSaving(false);
    }
  };

  const loading = txLoading && combinedEvents.length === 0;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-[2rem] font-bold leading-tight text-[var(--text-primary)]">Agenda</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Seu mês em vista. Seu dia organizado.
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {monthUniqueCount} {monthUniqueCount === 1 ? 'compromisso' : 'compromissos'} neste mês
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:shrink-0">
          <button
            type="button"
            onClick={handleConnectGoogle}
            disabled={googleConnecting || googleConnected}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] border border-[var(--card-border)] bg-[var(--card-bg)] px-5 text-sm font-semibold text-[var(--text-primary)] shadow-[var(--shadow-card)] disabled:opacity-60"
          >
            {googleConnecting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Conectando…
              </>
            ) : googleConnected ? (
              'Google conectado'
            ) : (
              'Conectar Google'
            )}
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] bg-[var(--accent)] px-5 text-sm font-semibold text-white shadow-[var(--shadow-card)]"
          >
            <Plus className="h-4 w-4" />
            Novo compromisso
          </button>
        </div>
      </header>

      {oauthBanner ? (
        <Card className="border-[var(--accent)]/30 bg-[var(--accent-soft)]/30 px-4 py-3">
          <p className="text-sm text-[var(--text-primary)]">{oauthBanner}</p>
        </Card>
      ) : null}

      <AgendaToolbar
        periodLabel={periodLabel}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onToday={handleToday}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <Card className="overflow-hidden p-3 sm:p-4">
          {loading ? (
            <div className="flex min-h-[320px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
            </div>
          ) : viewMode === 'month' ? (
            <AgendaMonthGrid
              currentMonthYmd={currentMonthYmd}
              selectedYmd={selectedYmd}
              events={combinedEvents}
              onSelectDate={handleSelectDate}
              onSelectEvent={handleSelectEvent}
            />
          ) : viewMode === 'week' ? (
            <AgendaWeekView
              selectedYmd={selectedYmd}
              events={combinedEvents}
              onSelectDate={handleSelectDate}
              onSelectEvent={handleSelectEvent}
            />
          ) : (
            <AgendaDayTimeline
              selectedYmd={selectedYmd}
              events={combinedEvents}
              onSelectEvent={handleSelectEvent}
            />
          )}
        </Card>

        <AgendaDayPanel
          title={panelTitle}
          selectedYmd={selectedYmd}
          events={dayEvents}
          loading={txLoading || googleLoading}
          loadError={txError}
          googleStatus={googleStatus}
          googleError={googleError}
          onRetryGoogle={reload}
          onAdd={openCreate}
          onEdit={openEdit}
          onDelete={(ev) => {
            if (ev.rawGoogleEvent) {
              setEditingEvent(ev.rawGoogleEvent);
              setModalOpen(true);
            }
          }}
          onOpenExternal={(url) => window.open(url, '_blank', 'noopener,noreferrer')}
          detailEvent={detailEvent}
        />
      </div>

      <AgendaUpcoming events={upcoming} onSelect={handleSelectEvent} />

      <AgendaEventModal
        open={modalOpen}
        initialDate={selectedYmd}
        eventToEdit={editingEvent}
        googleConnected={googleConnected}
        onClose={() => {
          if (!saving) {
            setModalOpen(false);
            setEditingEvent(null);
            setFormError('');
          }
        }}
        onSubmit={handleSave}
        onDelete={handleDelete}
        saving={saving}
        error={formError}
      />

      <AppFooter />
    </div>
  );
}
