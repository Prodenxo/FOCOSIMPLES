import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import {
  MeiFlowModalShell,
  MeiFormField,
  MeiFormSheetActions,
  useMeiFlowStyles,
} from '../components/mei/meiFlowUi'
import { useMfTheme } from '../components/ui/useMfTheme'
import { formatCnaeForDisplay } from '../lib/meiCatalogoProdutoForm'
import type {
  CodigoServicoReferencia,
  CnpjLookupCnaeItem,
} from '../services/meiNotasService'
import {
  criarCatalogoProdutosFromCnaes,
  listarCatalogoCodigosServicos,
  sugerirCatalogoCodigosServicos,
} from '../services/meiNotasService'
import { alertDialog } from '../lib/confirmDialog'
import { useAppToastStore } from '../store/appToastStore'

export type MeiImportCnaesModalProps = {
  visible: boolean
  cnaes: CnpjLookupCnaeItem[]
  onClose: () => void
  onImported?: () => void
}

type Step = 'cnaes' | 'codigos'

type ServicoPick = {
  codigo: string
  descricao?: string | null
}

function pickBorder (
  active: boolean,
  theme: { primary: string },
  isDarkMode: boolean,
): string {
  if (active) return theme.primary
  return isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'
}

export default function MeiImportCnaesModal ({
  visible,
  cnaes,
  onClose,
  onImported,
}: MeiImportCnaesModalProps) {
  const { theme, isDarkMode } = useMfTheme()
  const flow = useMeiFlowStyles()
  const showToast = useAppToastStore((s) => s.show)

  const [step, setStep] = useState<Step>('cnaes')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [servicoByCnae, setServicoByCnae] = useState<Record<string, ServicoPick | null>>({})
  const [suggestionsByCnae, setSuggestionsByCnae] = useState<
    Record<string, CodigoServicoReferencia[]>
  >({})
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [browseCnae, setBrowseCnae] = useState<string | null>(null)
  const [browseQuery, setBrowseQuery] = useState('')
  const [browseResults, setBrowseResults] = useState<CodigoServicoReferencia[]>([])
  const [browseLoading, setBrowseLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const items = useMemo(() => cnaes.filter((c) => c.codigo), [cnaes])
  const pickedItems = useMemo(
    () => items.filter((c) => selected.has(c.codigo)),
    [items, selected],
  )

  useEffect(() => {
    if (!visible) return
    setStep('cnaes')
    setSelected(new Set(cnaes.map((c) => c.codigo).filter(Boolean)))
    setServicoByCnae({})
    setSuggestionsByCnae({})
    setBrowseCnae(null)
    setBrowseQuery('')
    setBrowseResults([])
    setSaving(false)
  }, [visible, cnaes])

  const loadSuggestions = useCallback(async (list: CnpjLookupCnaeItem[]) => {
    setSuggestionsLoading(true)
    try {
      const entries = await Promise.all(
        list.map(async (item) => {
          const texto = String(item.descricao || '').trim() || item.codigo
          try {
            const rows = await sugerirCatalogoCodigosServicos({ texto, limit: 6 })
            return [item.codigo, rows] as const
          } catch {
            return [item.codigo, [] as CodigoServicoReferencia[]] as const
          }
        }),
      )
      const next: Record<string, CodigoServicoReferencia[]> = {}
      for (const [codigo, rows] of entries) next[codigo] = rows
      setSuggestionsByCnae(next)
    } finally {
      setSuggestionsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!visible || step !== 'codigos') return
    const list = items.filter((c) => selected.has(c.codigo))
    if (list.length === 0) return
    void loadSuggestions(list)
  }, [visible, step, items, selected, loadSuggestions])

  useEffect(() => {
    if (!browseCnae) return
    const q = browseQuery.trim()
    let cancelled = false
    const handle = setTimeout(() => {
      setBrowseLoading(true)
      void listarCatalogoCodigosServicos({ q, limit: 40 })
        .then((rows) => {
          if (!cancelled) setBrowseResults(rows)
        })
        .catch(() => {
          if (!cancelled) setBrowseResults([])
        })
        .finally(() => {
          if (!cancelled) setBrowseLoading(false)
        })
    }, 280)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [browseCnae, browseQuery])

  const toggle = (codigo: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(codigo)) next.delete(codigo)
      else next.add(codigo)
      return next
    })
  }

  const assignServico = (cnaeCodigo: string, pick: ServicoPick | null) => {
    setServicoByCnae((prev) => ({ ...prev, [cnaeCodigo]: pick }))
  }

  const goToCodigosStep = () => {
    if (pickedItems.length === 0) {
      alertDialog('Seleção', 'Marque ao menos um CNAE ou cancele.')
      return
    }
    setStep('codigos')
  }

  const handleConfirm = async () => {
    if (pickedItems.length === 0) {
      alertDialog('Seleção', 'Marque ao menos um CNAE ou cancele.')
      return
    }
    setSaving(true)
    try {
      const result = await criarCatalogoProdutosFromCnaes({
        documentType: 'NFSE',
        items: pickedItems.map((c) => {
          const pick = servicoByCnae[c.codigo]
          return {
            codigo: c.codigo,
            descricao: c.descricao,
            principal: Boolean(c.principal),
            ...(pick?.codigo ? { codigoServico: pick.codigo } : {}),
          }
        }),
      })
      const n = result.created?.length ?? 0
      const skipped = result.skipped?.length ?? 0
      const withCodigo = (result.created || []).filter((r) => String(r.codigo || '').trim()).length
      if (n > 0) {
        if (withCodigo === n) {
          showToast(
            n === 1 ? '1 serviço adicionado ao catálogo.' : `${n} serviços adicionados ao catálogo.`,
            'success',
          )
        } else if (withCodigo > 0) {
          showToast(
            `${n} CNAEs importados (${withCodigo} com código LC 116). Complete os demais antes de emitir.`,
            'success',
          )
        } else {
          showToast(
            n === 1
              ? '1 CNAE adicionado. Complete o código LC 116 antes de emitir.'
              : `${n} CNAEs adicionados. Complete o código LC 116 antes de emitir.`,
            'success',
          )
        }
      } else if (skipped > 0) {
        showToast('Esses CNAEs já estavam no catálogo.', 'info')
      } else {
        showToast('Nenhum CNAE importado.', 'info')
      }
      onImported?.()
      onClose()
    } catch (e: unknown) {
      alertDialog('Erro', e instanceof Error ? e.message : 'Falha ao importar CNAEs.')
    } finally {
      setSaving(false)
    }
  }

  const handleShellClose = () => {
    if (step === 'codigos') {
      setStep('cnaes')
      return
    }
    onClose()
  }

  const renderCodigoOption = (
    cnaeCodigo: string,
    option: CodigoServicoReferencia,
    keyPrefix: string,
  ) => {
    const chosen = servicoByCnae[cnaeCodigo]?.codigo === option.codigo
    return (
      <Pressable
        key={`${keyPrefix}-${option.codigo}`}
        accessibilityRole="radio"
        accessibilityState={{ selected: chosen }}
        onPress={() => assignServico(cnaeCodigo, {
          codigo: option.codigo,
          descricao: option.descricao,
        })}
        style={{
          paddingVertical: 10,
          paddingHorizontal: 12,
          marginBottom: 6,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: pickBorder(chosen, theme, isDarkMode),
          backgroundColor: chosen
            ? (isDarkMode ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.08)')
            : 'transparent',
        }}
      >
        <Text style={{ color: theme.text, fontWeight: '600', fontSize: 13 }}>
          {option.codigo}
        </Text>
        {option.descricao ? (
          <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>
            {option.descricao}
          </Text>
        ) : null}
      </Pressable>
    )
  }

  return (
    <MeiFlowModalShell
      visible={visible}
      onClose={handleShellClose}
      title={step === 'cnaes' ? 'Importar CNAEs' : 'Código LC 116'}
      eyebrow={step === 'cnaes' ? 'Atividades da Receita' : 'Sugestão + lista completa'}
      closeIcon={step === 'codigos' ? 'arrow-back' : 'close'}
    >
      {step === 'cnaes' ? (
        <>
          <Text style={[flow.hint, { marginBottom: 12 }]}>
            Marque as atividades de serviço. No próximo passo sugerimos códigos LC 116;
            você também pode buscar na lista completa ou deixar para depois.
          </Text>

          <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
            {items.map((item) => {
              const checked = selected.has(item.codigo)
              return (
                <Pressable
                  key={item.codigo}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                  onPress={() => toggle(item.codigo)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: 12,
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    marginBottom: 8,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: pickBorder(checked, theme, isDarkMode),
                    backgroundColor: checked
                      ? (isDarkMode ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.08)')
                      : 'transparent',
                  }}
                >
                  <Ionicons
                    name={checked ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={checked ? theme.primary : theme.textSecondary}
                    style={{ marginTop: 2 }}
                  />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>
                      {formatCnaeForDisplay(item.codigo)}
                      {item.principal ? ' · principal' : ''}
                    </Text>
                    {item.descricao ? (
                      <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 4 }}>
                        {item.descricao}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              )
            })}
          </ScrollView>

          <View style={{ marginTop: 16 }}>
            <MeiFormSheetActions
              onCancel={onClose}
              onConfirm={goToCodigosStep}
              confirmLabel="Continuar"
            />
          </View>
        </>
      ) : (
        <>
          <Text style={[flow.hint, { marginBottom: 12 }]}>
            Escolha um código sugerido ou busque na lista. Pode pular e completar depois no catálogo.
          </Text>

          {suggestionsLoading ? (
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <ActivityIndicator size="small" color={theme.primary} />
              <Text style={[flow.hint, { marginTop: 8 }]}>Buscando sugestões…</Text>
            </View>
          ) : null}

          <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
            {pickedItems.map((item) => {
              const pick = servicoByCnae[item.codigo]
              const suggestions = suggestionsByCnae[item.codigo] || []
              const isBrowsing = browseCnae === item.codigo
              return (
                <View
                  key={item.codigo}
                  style={{
                    marginBottom: 16,
                    padding: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                  }}
                >
                  <Text style={{ color: theme.text, fontWeight: '700', fontSize: 14 }}>
                    {formatCnaeForDisplay(item.codigo)}
                    {item.principal ? ' · principal' : ''}
                  </Text>
                  {item.descricao ? (
                    <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 4 }}>
                      {item.descricao}
                    </Text>
                  ) : null}

                  {pick ? (
                    <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="checkmark-circle" size={18} color={theme.primary} />
                      <Text style={{ color: theme.text, flex: 1, fontSize: 13 }}>
                        Selecionado: {pick.codigo}
                      </Text>
                      <Pressable
                        onPress={() => assignServico(item.codigo, null)}
                        accessibilityRole="button"
                        accessibilityLabel="Limpar código selecionado"
                      >
                        <Text style={{ color: theme.textSecondary, fontSize: 12 }}>Limpar</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 8 }}>
                      Sem código ainda (pode completar depois)
                    </Text>
                  )}

                  <Text style={{ color: theme.text, fontWeight: '600', fontSize: 13, marginTop: 12, marginBottom: 6 }}>
                    Sugeridos
                  </Text>
                  {suggestions.length === 0 && !suggestionsLoading ? (
                    <Text style={{ color: theme.textSecondary, fontSize: 12, marginBottom: 8 }}>
                      Nenhuma sugestão forte — use a busca abaixo.
                    </Text>
                  ) : (
                    suggestions.map((opt) => renderCodigoOption(item.codigo, opt, 'sug'))
                  )}

                  <Pressable
                    onPress={() => {
                      if (isBrowsing) {
                        setBrowseCnae(null)
                        setBrowseQuery('')
                        setBrowseResults([])
                      } else {
                        setBrowseCnae(item.codigo)
                        setBrowseQuery('')
                      }
                    }}
                    accessibilityRole="button"
                    style={{ marginTop: 4, marginBottom: 8 }}
                  >
                    <Text style={{ color: theme.primary, fontWeight: '600', fontSize: 13 }}>
                      {isBrowsing ? 'Ocultar lista completa' : 'Ver / buscar todos os códigos'}
                    </Text>
                  </Pressable>

                  {isBrowsing ? (
                    <View>
                      <MeiFormField
                        label="Buscar código ou descrição"
                        value={browseQuery}
                        onChangeText={setBrowseQuery}
                        placeholder="Ex.: 01.01 ou desenvolvimento"
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      {browseLoading ? (
                        <ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: 8 }} />
                      ) : null}
                      {browseResults.map((opt) => renderCodigoOption(item.codigo, opt, 'all'))}
                      {!browseLoading && browseResults.length === 0 ? (
                        <Text style={{ color: theme.textSecondary, fontSize: 12, marginBottom: 8 }}>
                          Nenhum resultado. Tente outro termo.
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              )
            })}
          </ScrollView>

          <View style={{ marginTop: 16 }}>
            <MeiFormSheetActions
              onCancel={() => setStep('cnaes')}
              cancelLabel="Voltar"
              onConfirm={() => void handleConfirm()}
              loading={saving}
              confirmLabel={saving ? 'Importando…' : 'Adicionar ao catálogo'}
            />
            {saving ? (
              <View style={{ alignItems: 'center', marginTop: 8 }}>
                <ActivityIndicator size="small" color={theme.primary} />
              </View>
            ) : null}
          </View>
        </>
      )}
    </MeiFlowModalShell>
  )
}
