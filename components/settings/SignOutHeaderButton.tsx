import React, { useMemo } from 'react'
import { Pressable, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useMfTheme } from '../ui/useMfTheme'
import { useNavigationDrawer } from '../../lib/navigationContext'
import { mfRadius, mfSpacing, mfTypography } from '../../lib/theme'

type Props = {
  /** Só ícone (top nav compacta). */
  iconOnly?: boolean
}

export function SignOutHeaderButton ({ iconOnly = false }: Props) {
  const { theme, isDarkMode } = useMfTheme()
  const { requestSignOut } = useNavigationDrawer()
  const styles = useMemo(
    () => createStyles(theme, iconOnly),
    [theme, iconOnly],
  )

  return (
    <Pressable
      onPress={requestSignOut}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel="Sair da conta"
    >
      <Ionicons name="log-out-outline" size={18} color={theme.error} />
      {!iconOnly ? (
        <Text style={styles.label}>Sair</Text>
      ) : null}
    </Pressable>
  )
}

function createStyles (
  theme: ReturnType<typeof useMfTheme>['theme'],
  iconOnly: boolean,
) {
  return StyleSheet.create({
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: iconOnly ? 8 : 8,
      paddingHorizontal: iconOnly ? 10 : mfSpacing.md,
      borderRadius: mfRadius.md,
      borderWidth: 1,
      borderColor: `${theme.error}44`,
      backgroundColor: theme.errorLight,
      minHeight: 40,
    },
    pressed: {
      opacity: 0.88,
    },
    label: {
      ...mfTypography.caption,
      fontWeight: '700',
      color: theme.error,
    },
  })
}
