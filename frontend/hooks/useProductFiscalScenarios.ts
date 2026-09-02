import { useCallback, useMemo, useState } from 'react'
import { emptyProductFiscalConfigForm } from '@/lib/fiscalConfiguration/ruleFormMapper'
import { defaultScenarioName, scenarioAppliesToOperationScope, syncFormEstablishmentContext, type ScenarioAppliesKind } from '@/lib/fiscalConfiguration/scenarioApplicationUi'
import type { FiscalScenarioDraft } from '@/lib/fiscalConfiguration/scenarioTypes'
import type { ProductFiscalConfigForm } from '@/lib/fiscalConfiguration/types'

export function useProductFiscalScenarios(issuerUf = 'RJ') {
  const [scenarios, setScenarios] = useState<FiscalScenarioDraft[]>([])
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null)
  const [merchandiseFacts, setMerchandiseFacts] = useState(() => {
    const base = emptyProductFiscalConfigForm(issuerUf)
    return {
      origemMercadoria: base.origemMercadoria,
      itemSource: base.itemSource,
      priorStStatus: base.priorStStatus,
    }
  })

  const activeScenario = useMemo(
    () => scenarios.find((s) => s.id === activeScenarioId) ?? null,
    [activeScenarioId, scenarios],
  )

  const addScenario = useCallback((opts?: { scenarioApplies?: ScenarioAppliesKind; name?: string }) => {
    const id = `scenario-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const kind = opts?.scenarioApplies ?? 'INTERNAL'
    const form = syncFormEstablishmentContext(emptyProductFiscalConfigForm(issuerUf), issuerUf)
    form.scenarioApplies = kind
    form.operationScope = scenarioAppliesToOperationScope(kind)
    const label = opts?.name?.trim() || defaultScenarioName(kind)
    form.name = label
    const next: FiscalScenarioDraft = {
      id,
      name: label,
      form,
      status: 'DRAFT',
      uiStatus: 'PENDENTE',
      ruleId: null,
    }
    setScenarios((prev) => [...prev, next])
    setActiveScenarioId(id)
    return id
  }, [issuerUf])

  const updateScenarioForm = useCallback((scenarioId: string, patch: Partial<ProductFiscalConfigForm>) => {
    setScenarios((prev) => prev.map((scenario) => (
      scenario.id === scenarioId
        ? {
          ...scenario,
          name: patch.name ?? scenario.name,
          form: { ...scenario.form, ...patch },
        }
        : scenario
    )))
  }, [])

  const removeScenario = useCallback((scenarioId: string) => {
    setScenarios((prev) => prev.filter((s) => s.id !== scenarioId))
    setActiveScenarioId((current) => (current === scenarioId ? null : current))
  }, [])

  const resetScenarios = useCallback(() => {
    setScenarios([])
    setActiveScenarioId(null)
    const base = emptyProductFiscalConfigForm(issuerUf)
    setMerchandiseFacts({
      origemMercadoria: base.origemMercadoria,
      itemSource: base.itemSource,
      priorStStatus: base.priorStStatus,
    })
  }, [issuerUf])

  const markScenarioSaved = useCallback((
    scenarioId: string,
    payload: { ruleId: string; uiStatus: FiscalScenarioDraft['uiStatus'] },
  ) => {
    setScenarios((prev) => prev.map((scenario) => (
      scenario.id === scenarioId
        ? { ...scenario, ruleId: payload.ruleId, uiStatus: payload.uiStatus, status: 'DRAFT' }
        : scenario
    )))
  }, [])

  return {
    scenarios,
    activeScenarioId,
    activeScenario,
    merchandiseFacts,
    setMerchandiseFacts,
    addScenario,
    updateScenarioForm,
    removeScenario,
    resetScenarios,
    setActiveScenarioId,
    markScenarioSaved,
  }
}
