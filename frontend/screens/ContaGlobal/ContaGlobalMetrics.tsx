import React, { useMemo } from 'react'

import {

  View,

  Text,

  StyleSheet,

  Platform,

  type ViewStyle,

} from 'react-native'

import { MoedaFlag } from '../../components/conta-global/MoedaFlag'

import { useMfTheme } from '../../components/ui/useMfTheme'

import { formatBrl } from '../../lib/moedaFormat'

import { mfSpacing } from '../../lib/theme'



type Props = {

  totalBrl: number

  moedaCount: number

  ratesLoading: boolean

  ratesReady: boolean

}



const monoFont = Platform.select({

  web: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',

  ios: 'Menlo',

  android: 'monospace',

  default: undefined,

}) as ViewStyle['fontFamily']



export function ContaGlobalMetrics({ totalBrl, moedaCount, ratesLoading, ratesReady }: Props) {

  const { theme } = useMfTheme()

  const styles = useMemo(() => createStyles(theme), [theme])



  const countLabel =

    moedaCount === 1 ? '1 moeda' : `${moedaCount} moedas`



  const totalDisplay = ratesLoading && !ratesReady ? '…' : formatBrl(totalBrl)



  return (

    <View style={styles.root}>

      <View style={styles.heroRow}>

        <MoedaFlag moeda="BRL" size={36} label="Real brasileiro" />

        <View style={styles.heroText}>

          <Text style={styles.eyebrow}>Saldo total em reais</Text>

          <Text
            style={[styles.total, { color: theme.financeOpen }]}
            numberOfLines={1}
            {...(Platform.OS === 'web'
              ? { adjustsFontSizeToFit: true, minimumFontScale: 0.55 }
              : {})}
          >

            {totalDisplay}

          </Text>

          <Text style={styles.hint}>

            {countLabel} · não entra na visão geral

          </Text>

        </View>

      </View>

    </View>

  )

}



function createStyles(theme: ReturnType<typeof useMfTheme>['theme']) {

  const isNative = Platform.OS !== 'web'



  return StyleSheet.create({

    root: {

      width: '100%',

      marginBottom: mfSpacing.lg,

      paddingVertical: mfSpacing.xs,

    },

    heroRow: {

      flexDirection: 'row',

      alignItems: 'center',

      gap: mfSpacing.md,

    },

    heroText: {

      flex: 1,

      minWidth: 0,

      gap: 4,

    },

    eyebrow: {

      fontSize: 13,

      fontWeight: '600',

      color: theme.textSecondary,

    },

    total: {

      fontSize: isNative ? 32 : 36,

      fontWeight: '800',

      letterSpacing: -1,

      lineHeight: isNative ? 38 : 42,

      fontFamily: monoFont,

      fontVariant: ['tabular-nums'],

    },

    hint: {

      fontSize: 11,

      color: theme.textTertiary,

      lineHeight: 15,

      marginTop: 2,

    },

  })

}

