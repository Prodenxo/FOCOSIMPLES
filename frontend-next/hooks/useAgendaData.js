'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchTransactions } from '@/lib/categoryService';
import {
  buildCombinedEvents,
  eventsForDateKey,
  upcomingEventsAfter,
  uniqueEventsInRange,
} from '@/lib/agendaEvents';
import {
  getLocalMonthBounds,
  getMonthRangeIso,
  getUpcomingRangeIso,
  localDateStr,
  parseLocalYmd,
} from '@/lib/agendaUtils';
import {
  checkGoogleAuth,
  getGoogleEvents,
} from '@/lib/googleCalendarService';

function filterTransactionsForRange(transactions, startYmd, endYmd) {
  const start = parseLocalYmd(startYmd);
  const end = parseLocalYmd(endYmd);
  end.setHours(23, 59, 59, 999);
  return (transactions || []).filter((t) => {
    const d = t.data ? parseLocalYmd(t.data.slice(0, 10)) : new Date(t.criado_em);
    return d >= start && d <= end;
  });
}

export function useAgendaData({ currentMonthYmd, selectedYmd, viewMode }) {
  const [transactions, setTransactions] = useState([]);
  const [googleEvents, setGoogleEvents] = useState([]);
  const [txLoading, setTxLoading] = useState(true);
  const [txError, setTxError] = useState(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleStatus, setGoogleStatus] = useState('checking');
  const loadSeq = useRef(0);

  const fetchRange = useMemo(() => {
    const monthRange = getMonthRangeIso(currentMonthYmd);
    const upcoming = getUpcomingRangeIso(selectedYmd, 90);
    const monthStart = monthRange.timeMin.slice(0, 10);
    const monthEnd = getLocalMonthBounds(currentMonthYmd).end;
    const monthEndYmd = localDateStr(monthEnd);
    const upcomingEnd = upcoming.timeMax.slice(0, 10);
    const startYmd = monthStart < selectedYmd ? monthStart : selectedYmd;
    const endYmd = upcomingEnd > monthEndYmd ? upcomingEnd : monthEndYmd;
    return {
      timeMin: parseLocalYmd(startYmd).toISOString(),
      timeMax: parseLocalYmd(endYmd).toISOString(),
      startYmd,
      endYmd,
    };
  }, [currentMonthYmd, selectedYmd]);

  const loadAll = useCallback(async () => {
    const seq = ++loadSeq.current;
    setTxLoading(true);
    setTxError(null);
    setGoogleLoading(true);
    setGoogleError(null);
    setGoogleStatus('connecting');

    try {
      const txs = await fetchTransactions();
      if (seq !== loadSeq.current) return;
      setTransactions(txs || []);
      setTxLoading(false);
    } catch (err) {
      if (seq !== loadSeq.current) return;
      setTxError(err instanceof Error ? err.message : 'Falha ao carregar lançamentos.');
      setTransactions([]);
      setTxLoading(false);
    }

    try {
      const connected = await checkGoogleAuth();
      if (seq !== loadSeq.current) return;
      setGoogleConnected(connected);
      setGoogleStatus(connected ? 'connected' : 'disconnected');

      if (!connected) {
        setGoogleEvents([]);
        setGoogleLoading(false);
        return;
      }

      const events = await getGoogleEvents({
        timeMin: fetchRange.timeMin,
        timeMax: fetchRange.timeMax,
      });
      if (seq !== loadSeq.current) return;
      setGoogleEvents(events || []);
    } catch (err) {
      if (seq !== loadSeq.current) return;
      setGoogleError(err instanceof Error ? err.message : 'Erro ao carregar eventos do Google.');
      setGoogleStatus('error');
    } finally {
      if (seq === loadSeq.current) setGoogleLoading(false);
    }
  }, [fetchRange.timeMin, fetchRange.timeMax]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const monthTx = useMemo(
    () => filterTransactionsForRange(transactions, fetchRange.startYmd, fetchRange.endYmd),
    [transactions, fetchRange.startYmd, fetchRange.endYmd],
  );

  const combinedEvents = useMemo(
    () => buildCombinedEvents(monthTx, googleEvents),
    [monthTx, googleEvents],
  );

  const dayEvents = useMemo(
    () => eventsForDateKey(combinedEvents, selectedYmd),
    [combinedEvents, selectedYmd],
  );

  const monthUniqueCount = useMemo(() => {
    const { start } = getLocalMonthBounds(currentMonthYmd);
    const end = getLocalMonthBounds(currentMonthYmd).end;
    return uniqueEventsInRange(
      combinedEvents,
      localDateStr(start),
      localDateStr(end),
    ).length;
  }, [combinedEvents, currentMonthYmd]);

  const upcoming = useMemo(
    () => upcomingEventsAfter(combinedEvents, selectedYmd, 6),
    [combinedEvents, selectedYmd],
  );

  return {
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
    reload: loadAll,
  };
}
