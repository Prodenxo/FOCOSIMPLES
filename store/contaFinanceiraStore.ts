import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './authStore'
import { formatContaFinanceiraDbError } from '../lib/errors'
import {
  normalizeContaRow,
  type ContaFinanceira,
  type ContaFinanceiraInput,
} from '../lib/contaFinanceiraTypes'

interface ContaFinanceiraState {
  contas: ContaFinanceira[]
  loading: boolean
  error: string | null
  fetchContas: () => Promise<void>
  addConta: (input: ContaFinanceiraInput) => Promise<ContaFinanceira | null>
  updateConta: (id: string, input: Partial<ContaFinanceiraInput>) => Promise<{ error: string | null }>
  deleteConta: (id: string) => Promise<{ error: string | null }>
}

function toDbPayload(input: ContaFinanceiraInput | Partial<ContaFinanceiraInput>) {
  const payload: Record<string, unknown> = { ...input, atualizado_em: new Date().toISOString() }
  if ('saldo_inicial' in payload && payload.saldo_inicial != null) {
    payload.saldo_inicial = Number(payload.saldo_inicial)
  }
  if ('limite_credito' in payload) {
    payload.limite_credito =
      payload.limite_credito == null || payload.limite_credito === ''
        ? null
        : Number(payload.limite_credito)
  }
  return payload
}

export const useContaFinanceiraStore = create<ContaFinanceiraState>((set, get) => ({
  contas: [],
  loading: false,
  error: null,

  fetchContas: async () => {
    const userId = useAuthStore.getState().userId
    if (!userId) {
      set({ error: 'Usuário não autenticado' })
      return
    }
    set({ loading: true, error: null })
    try {
      const { data, error } = await supabase
        .from('contas_financeiras')
        .select('*')
        .eq('user_id', userId)
        .order('nome', { ascending: true })
      if (error) throw error
      set({
        contas: (data || []).map((row) => normalizeContaRow(row as Record<string, unknown>)),
        loading: false,
      })
    } catch (err: unknown) {
      set({ error: formatContaFinanceiraDbError(err), loading: false })
    }
  },

  addConta: async (input) => {
    const userId = useAuthStore.getState().userId
    if (!userId) {
      set({ error: 'Usuário não autenticado' })
      return null
    }
    try {
      const { data, error } = await supabase
        .from('contas_financeiras')
        .insert([{ ...toDbPayload(input), user_id: userId }])
        .select('*')
        .single()
      if (error) throw error
      await get().fetchContas()
      return data ? normalizeContaRow(data as Record<string, unknown>) : null
    } catch (err: unknown) {
      set({ error: formatContaFinanceiraDbError(err) })
      return null
    }
  },

  updateConta: async (id, input) => {
    const userId = useAuthStore.getState().userId
    if (!userId) return { error: 'Usuário não autenticado' }
    try {
      const { error } = await supabase
        .from('contas_financeiras')
        .update(toDbPayload(input))
        .eq('id', id)
        .eq('user_id', userId)
      if (error) throw error
      await get().fetchContas()
      return { error: null }
    } catch (err: unknown) {
      const msg = formatContaFinanceiraDbError(err)
      set({ error: msg })
      return { error: msg }
    }
  },

  deleteConta: async (id) => {
    const userId = useAuthStore.getState().userId
    if (!userId) return { error: 'Usuário não autenticado' }
    try {
      const { error } = await supabase
        .from('contas_financeiras')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)
      if (error) throw error
      await get().fetchContas()
      return { error: null }
    } catch (err: unknown) {
      const msg = formatContaFinanceiraDbError(err)
      set({ error: msg })
      return { error: msg }
    }
  },
}))
