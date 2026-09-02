import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { mfRadius, mfSpacing, mfTypography } from '../../lib/theme';
import { useMfTheme } from './useMfTheme';
import type { MfAppHeaderProps } from './types';
import { useNavigationDrawer } from '../../lib/navigationContext';

export function MfAppHeader({ title, subtitle, onMenuPress, right, style, testID }: MfAppHeaderProps) {
  const { theme, isDarkMode } = useMfTheme();
  const { hasGlobalNav } = useNavigationDrawer();
  const styles = useMemo(
    () => createStyles(theme, isDarkMode, hasGlobalNav),
    [theme, isDarkMode, hasGlobalNav]
  );
  const showMenu = Boolean(onMenuPress) && !hasGlobalNav;
  /** Topo: `MfScreenSafeArea` / SafeAreaView `edges` inclui `top` no ecrã pai. */
  const isShellWeb = hasGlobalNav && Platform.OS === 'web';
  const isDashboardGreeting = title === 'Meu Financeiro' || title === 'Foco Simples';

  if (isShellWeb && isDashboardGreeting && !right) {
    return null;
  }

  if (isShellWeb && isDashboardGreeting && right) {
    return (
      <View style={[styles.shellToolbar, style]} testID={testID}>
        <View style={styles.shellToolbarSpacer} />
        <View style={styles.right}>{right}</View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.bar,
        isShellWeb && styles.barInShell,
        style,
      ]}
      testID={testID}
    >
      <View style={styles.left}>
        {showMenu ? (
          <Pressable
            onPress={onMenuPress}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Abrir menu"
          >
            <Ionicons name="menu" size={24} color={theme.text} />
          </Pressable>
        ) : null}
        <View style={styles.titles}>
          {title ? (
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

function createStyles(
  theme: ReturnType<typeof useMfTheme>['theme'],
  isDarkMode: boolean,
  hasGlobalNav: boolean
) {
  return StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: mfSpacing.lg,
      paddingVertical: mfSpacing.md,
      backgroundColor: theme.background,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      ...(Platform.OS === 'web' && !hasGlobalNav
        ? ({
            position: 'sticky',
            top: 0,
            zIndex: 40,
          } as unknown as ViewStyle)
        : {}),
    },
    barInShell: {
      backgroundColor: 'transparent',
      borderBottomWidth: 0,
      paddingTop: mfSpacing.lg,
      paddingBottom: mfSpacing.sm,
      maxWidth: 1280,
      width: '100%',
      alignSelf: 'center',
    },
    shellToolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: mfSpacing.lg,
      paddingTop: mfSpacing.md,
      paddingBottom: mfSpacing.sm,
      maxWidth: 1280,
      width: '100%',
      alignSelf: 'center',
      backgroundColor: 'transparent',
    },
    shellToolbarSpacer: {
      flex: 1,
    },
    left: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: mfSpacing.sm,
      minWidth: 0,
    },
    titles: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      ...mfTypography.title,
      fontSize: hasGlobalNav && Platform.OS === 'web' ? 22 : 18,
      color: theme.text,
      letterSpacing: hasGlobalNav && Platform.OS === 'web' ? -0.3 : 0,
    },
    subtitle: {
      ...mfTypography.caption,
      color: theme.textSecondary,
      marginTop: 2,
    },
    right: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: mfSpacing.sm,
      flexShrink: 0,
    },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: mfRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDarkMode ? theme.surface : theme.backgroundMuted,
      borderWidth: 1,
      borderColor: theme.border,
    },
    iconBtnPressed: {
      opacity: 0.8,
    },
  });
}
