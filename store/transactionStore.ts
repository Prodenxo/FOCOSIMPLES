import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';
import { useRecorrenciaStore } from './recorrenciaStore';
import { createCalendarEvent } from '../lib/google-calendar';
import { getErrorMessage } from '../lib/errors';
import { apiClient } from '../lib/apiClient';
import { isLocalApiAuthMode } from '../lib/authMode';

interface Transaction {
  id: string; // UUID no Supabase
  tipo: 'saída' | 'entrada';
  valor: number;
  classificacao: string;
  criado_em: string;
  user_id: string | null; // UUID do usuário (null para transações globais)
  status: string;
  data?: string | null;
  categoria?: string | number | null;
  obs?: string | null;
  recorrencia_id?: string | null;
  recorrencia_ano_mes?: string | null;
  conta_id?: string | null;
}

interface TransactionState {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  googleAuthRequired: boolean;
  fetchTransactions: () => Promise<void>;
  addTransaction: (
    transaction: Omit<Transaction, 'id' | 'criado_em'>,
    options?: { addToCalendar?: boolean },
  ) => Promise<void>;
  updateTransaction: (id: string, transaction: Partial<Transaction>) => Promise<{ data: any | null; error: string | null }>;
  deleteTransaction: (id: string) => Promise<{ data: any | null; error: string | null }>;
  clearGoogleAuthRequired: () => void;
}

function normalizeTransactionRow(t: Record<string, unknown>): Transaction {
  return {
    ...t,
    id: String(t.id || ''),
    valor: typeof t.valor === 'string' ? parseFloat(t.valor) : Number(t.valor),
    tipo: (String(t.tipo) === 'saida' ? 'saída' : String(t.tipo)) as Transaction['tipo'],
    classificacao: String(t.classificacao || ''),
    status: String(t.status || ''),
    user_id: t.user_id ? String(t.user_id) : null,
    criado_em: String(t.criado_em || ''),
    data: t.data ? String(t.data) : null,
    categoria: t.categoria !== null && t.categoria !== undefined
      ? (typeof t.categoria === 'string'
        ? (isNaN(Number(t.categoria)) ? t.categoria : Number(t.categoria))
        : t.categoria as string | number)
      : null,
    obs: t.obs ? String(t.obs) : null,
    conta_id: t.conta_id ? String(t.conta_id) : null,
    recorrencia_id: t.recorrencia_id ? String(t.recorrencia_id) : null,
    recorrencia_ano_mes: t.recorrencia_ano_mes ? String(t.recorrencia_ano_mes) : null,
  } as Transaction;
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: [],
  loading: false,
  error: null,
  googleAuthRequired: false,
  fetchTransactions: async () => {
    const userId = useAuthStore.getState().userId;
    if (!userId) {
      set({ error: 'Usuário não autenticado' });
      return;
    }

    set({ loading: true, error: null });
    try {
      let data: Record<string, unknown>[] | null = null;
      if (isLocalApiAuthMode()) {
        data = await apiClient.get<Record<string, unknown>[]>('/transactions');
      } else {
        const res = await supabase
          .from('lancamentos_id')
          .select('*')
          .eq('user_id', userId)
          .order('criado_em', { ascending: false });
        if (res.error) throw res.error;
        data = (res.data || []) as Record<string, unknown>[];
      }

      const normalizedData = (data || []).map((t) => normalizeTransactionRow(t));
      set({ transactions: normalizedData, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },
  addTransaction: async (transaction, options) => {
    const userId = useAuthStore.getState().userId;
    if (!userId) {
      set({ error: 'Usuário não autenticado' });
      return;
    }

    try {
      const transactionData = {
        ...transaction,
        valor: typeof transaction.valor === 'number' ? transaction.valor : parseFloat(String(transaction.valor)),
        user_id: userId
      };

      if (isLocalApiAuthMode()) {
        await apiClient.post('/transactions', transactionData);
      } else {
        const { error } = await supabase
          .from('lancamentos_id')
          .insert([transactionData]);
        if (error) throw error;
      }
      await get().fetchTransactions();

      // Google Calendar agora é opt-in via options.addToCalendar.
      // O caller decide quando criar o evento (ex.: toggle no formulário).
      const wantsCalendar = options?.addToCalendar === true;
      const isPlanned = transaction.status === 'a_receber' || transaction.status === 'a_pagar';
      if (wantsCalendar && isPlanned) {
        try {
          const calendarResult = await createCalendarEvent(transaction);
          if (!calendarResult.success) {
            if (calendarResult.error === 'GOOGLE_AUTH_REQUIRED') {
              set({ googleAuthRequired: true });
            } else {
              console.warn('Erro ao criar evento no calendário:', calendarResult.error);
            }
          }
        } catch (calendarError: any) {
          console.warn('Erro ao criar evento no calendário:', calendarError);
        }
      }
    } catch (error: any) {
      set({ error: error.message });
    }
  },
  updateTransaction: async (id, transaction) => {
    const userId = useAuthStore.getState().userId;
    if (!userId) {
      const errorMsg = 'Usuário não autenticado';
      set({ error: errorMsg });
      return { data: null, error: errorMsg };
    }

    // Validar ID - UUID (string)
    const idString = String(id || '');
    if (!idString || idString.trim() === '') {
      const errorMsg = 'ID da transação inválido';
      set({ error: errorMsg });
      return { data: null, error: errorMsg };
    }

    try {
      const transactionData = {
        ...transaction,
        valor: typeof transaction.valor === 'number' ? transaction.valor : parseFloat(String(transaction.valor))
      };

      let data: unknown = null;
      if (isLocalApiAuthMode()) {
        data = await apiClient.put('/transactions', { id: idString, ...transactionData });
      } else {
        const res = await supabase
          .from('lancamentos_id')
          .update(transactionData)
          .eq('id', idString)
          .eq('user_id', userId);
        if (res.error) throw res.error;
        data = res.data;
      }
      await get().fetchTransactions();
      return { data, error: null };
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      set({ error: msg });
      return { data: null, error: msg };
    }
  },
  deleteTransaction: async (id) => {
    const userId = useAuthStore.getState().userId;
    if (!userId) {
      const errorMsg = 'Usuário não autenticado';
      set({ error: errorMsg });
      return { data: null, error: errorMsg };
    }

    // Validar ID - UUID (string)
    const idString = String(id || '');
    if (!idString || idString.trim() === '') {
      const errorMsg = 'ID da transação inválido';
      set({ error: errorMsg });
      return { data: null, error: errorMsg };
    }

    try {
      // Se a transação está vinculada a uma recorrência (recorrencia_id +
      // recorrencia_ano_mes), registramos um "skip" antes do DELETE. Sem isso,
      // o frontend regenera a projeção virtual no mesmo mês (perda da chave de
      // deduplicação). Pega do estado local — evita round-trip.
      const targetTx = get().transactions.find((t) => t.id === idString);
      if (targetTx?.recorrencia_id && targetTx?.recorrencia_ano_mes) {
        await useRecorrenciaStore
          .getState()
          .addSkip(targetTx.recorrencia_id, targetTx.recorrencia_ano_mes);
      }

      let data: unknown = null;
      if (isLocalApiAuthMode()) {
        data = await apiClient.delete(`/transactions?id=${encodeURIComponent(idString)}`);
      } else {
        const res = await supabase
          .from('lancamentos_id')
          .delete()
          .eq('id', idString)
          .eq('user_id', userId);
        if (res.error) throw res.error;
        data = res.data;
      }
      await get().fetchTransactions();
      return { data, error: null };
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      set({ error: msg });
      return { data: null, error: msg };
    }
  },
  clearGoogleAuthRequired: () => {
    set({ googleAuthRequired: false });
  },
}));
