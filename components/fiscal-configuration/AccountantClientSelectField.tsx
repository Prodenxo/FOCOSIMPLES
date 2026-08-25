import React, { useMemo } from 'react'
import { FiscalConfigSelectField } from '@/components/fiscal-configuration/FiscalConfigSelectField'

type ClientOption = {
  clientKey: string
  label: string
}

type Props = {
  clients: ClientOption[]
  selectedClientKey: string | null
  onSelectClient: (clientKey: string) => void
  disabled?: boolean
}

const PLACEHOLDER = '__none__'

function splitEmitterLabel(raw: string): { label: string; subtitle?: string } {
  const text = String(raw ?? '').trim()
  if (!text) return { label: 'Emissor' }

  const dotIdx = text.lastIndexOf(' · ')
  if (dotIdx <= 0) return { label: text }

  const name = text.slice(0, dotIdx).trim()
  const cnpj = text.slice(dotIdx + 3).trim()
  if (!cnpj) return { label: name }

  return {
    label: name,
    subtitle: `CNPJ ${cnpj}`,
  }
}

export function AccountantClientSelectField({
  clients,
  selectedClientKey,
  onSelectClient,
  disabled = false,
}: Props) {
  const options = useMemo(
    () => [
      {
        value: PLACEHOLDER,
        label: 'Selecione o emissor…',
        menuHidden: true,
      },
      ...clients.map((client) => {
        const parsed = splitEmitterLabel(client.label)
        return {
          value: client.clientKey,
          label: parsed.label,
          subtitle: parsed.subtitle,
        }
      }),
    ],
    [clients],
  )

  return (
    <FiscalConfigSelectField
      label="Emissor (CNPJ) *"
      value={selectedClientKey ?? PLACEHOLDER}
      options={options}
      onChange={(value) => {
        if (value !== PLACEHOLDER) onSelectClient(value)
      }}
      disabled={disabled || clients.length === 0}
      helpText={
        clients.length === 0
          ? 'Nenhum emissor com Simples ativo e CRT configurado.'
          : 'Empresas emissoras com CRT importado — não o escritório contábil.'
      }
    />
  )
}
