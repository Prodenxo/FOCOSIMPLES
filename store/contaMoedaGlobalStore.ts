import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './authStore'
import { formatContaMoedaGlobalDbError } from '../lib/errors'
import {
  normalizeContaMoedaGlobalRow,
  type ContaMoedaGlobal,
  type ContaMoedaGlobalInput,
} from '../lib/contaMoedaGlobalTypes'

interface ContaMoedaGlobalState {
  contas: ContaMoedaGlobal[]
  loading: boolean
  error: string | null
  fetchContas: () => Promise<void>
  addConta: (input: ContaMoedaGlobalInput) => Promise<ContaMoedaGlobal | null>
  updateConta: (id: string, input: Partial<ContaMoedaGlobalInput>) => Promise<{ error: string | null }>
  deleteConta: (id: string) => Promise<{ error: string | null }>
}

function toDbPayload(input: ContaMoedaGlobalInput | Partial<ContaMoedaGlobalInput>) {
  const payload: Record<string, unknown> = {
    ...input,
    atualizado_em: new Date().toISOString(),
  }
  if ('moeda' in payload && payload.moeda != null) {
    payload.moeda = String(payload.moeda).trim().toUpperCase()
  }
  if ('valor' in payload && payload.valor != null) {
    payload.valor = Number(payload.valor)
  }
  if ('nome' in payload) {
    const n = payload.nome != null ? String(payload.nome).trim() : ''
    payload.nome = n || null
  }
  return payload
}

export const useContaMoedaGlobalStore = create<ContaMoedaGlobalState>((set, get) => ({
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
        .from('contas_moeda_global')
        .select('*')
        .eq('user_id', userId)
        .eq('ativo', true)
        .order('moeda', { ascending: true })
      if (error) throw error
      set({
        contas: (data || []).map((row) => normalizeContaMoedaGlobalRow(row as Record<string, unknown>)),
        loading: false,
      })
    } catch (err: unknown) {
      set({ error: formatContaMoedaGlobalDbError(err), loading: false })
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
        .from('contas_moeda_global')
        .insert([{ ...toDbPayload(input), user_id: userId }])
        .select('*')
        .single()
      if (error) throw error
      await get().fetchContas()
      return data ? normalizeContaMoedaGlobalRow(data as Record<string, unknown>) : null
    } catch (err: unknown) {
      set({ error: formatContaMoedaGlobalDbError(err) })
      return null
    }
  },

  updateConta: async (id, input) => {
    const userId = useAuthStore.getState().userId
    if (!userId) return { error: 'Usuário não autenticado' }
    try {
      const { error } = await supabase
        .from('contas_moeda_global')
        .update(toDbPayload(input))
        .eq('id', id)
        .eq('user_id', userId)
      if (error) throw error
      await get().fetchContas()
      return { error: null }
    } catch (err: unknown) {
      const msg = formatContaMoedaGlobalDbError(err)
      set({ error: msg })
      return { error: msg }
    }
  },

  deleteConta: async (id) => {
    const userId = useAuthStore.getState().userId
    if (!userId) return { error: 'Usuário não autenticado' }
    try {
      const { error } = await supabase
        .from('contas_moeda_global')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)
      if (error) throw error
      await get().fetchContas()
      return { error: null }
    } catch (err: unknown) {
      const msg = formatContaMoedaGlobalDbError(err)
      set({ error: msg })
      return { error: msg }
    }
  },
}))
