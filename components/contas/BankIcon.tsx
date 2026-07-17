import React, { useMemo } from 'react'
import { View, Text, StyleSheet, Platform } from 'react-native'
import { SvgXml } from 'react-native-svg'
import { renderBancoSvg } from '../../lib/bancoBrasilSvg'
import {
  findBankById,
  findBankByNome,
  bankInitials,
  resolveLibraryNome,
  type BankCatalogEntry,
} from '../../lib/bankCatalog'

type IconFormat = 'circulo' | 'quadrado' | 'sem'

type Props = {
  instituicaoId?: string | null
  nome?: string
  cor?: string | null
  size?: number
  formato?: IconFormat
}

function InitialsFallback({
  label,
  accent,
  size,
}: {
  label: string
  accent: string
  size: number
}) {
  return (
    <View
      style={[
        styles.initialsWrap,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: accent },
      ]}
    >
      <Text style={[styles.initials, { fontSize: Math.max(10, size * 0.34) }]}>
        {bankInitials(label)}
      </Text>
    </View>
  )
}

/** Web: `<div>` real — `View` do RN não aceita `dangerouslySetInnerHTML`. */
function WebSvgIcon({ xml, size }: { xml: string; size: number }) {
  if (Platform.OS !== 'web') return null
  return React.createElement('div', {
    style: {
      width: size,
      height: size,
      flexShrink: 0,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      lineHeight: 0,
    },
    dangerouslySetInnerHTML: { __html: xml },
  })
}

function BancoSvgFromLibrary({
  libraryNome,
  nome,
  cor,
  size,
  formato,
}: {
  libraryNome: string
  nome: string
  cor: string
  size: number
  formato: IconFormat
}) {
  const xml = useMemo(
    () => renderBancoSvg({ nome: libraryNome, formato, tamanho: size }),
    [libraryNome, formato, size],
  )

  if (!xml) {
    return <InitialsFallback label={nome} accent={cor} size={size} />
  }

  if (Platform.OS === 'web') {
    return <WebSvgIcon xml={xml} size={size} />
  }

  return <SvgXml xml={xml} width={size} height={size} />
}

export function BankIcon({
  instituicaoId,
  nome = '',
  cor,
  size = 36,
  formato = 'circulo',
}: Props) {
  const bank = useMemo(
    () => findBankById(instituicaoId) ?? findBankByNome(nome),
    [instituicaoId, nome],
  )
  const libraryNome = resolveLibraryNome(bank)
  const accent = bank?.cor ?? cor ?? '#64748B'
  const label = bank?.nome ?? nome ?? 'Conta'

  if (!libraryNome) {
    return <InitialsFallback label={label} accent={accent} size={size} />
  }

  return (
    <BancoSvgFromLibrary
      libraryNome={libraryNome}
      nome={label}
      cor={accent}
      size={size}
      formato={formato}
    />
  )
}

export function BankCatalogIcon({
  bank,
  size = 40,
}: {
  bank: BankCatalogEntry
  size?: number
}) {
  const libraryNome = resolveLibraryNome(bank)
  if (!libraryNome) {
    return <InitialsFallback label={bank.nome} accent={bank.cor} size={size} />
  }
  return (
    <BancoSvgFromLibrary
      libraryNome={libraryNome}
      nome={bank.nome}
      cor={bank.cor}
      size={size}
      formato="circulo"
    />
  )
}

const styles = StyleSheet.create({
  initialsWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
})
