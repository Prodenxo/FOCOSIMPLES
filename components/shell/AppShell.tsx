import React, { useMemo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Slot } from 'expo-router';
import { useThemeStore } from '@/store/themeStore';
import type { AppScreenName } from '@/lib/navigationContext';
import AppTopNav from './AppTopNav';
import ImpersonationBanner from '../ImpersonationBanner';
import { getDashboardCanvasStyle } from '@/lib/glassStyles';
import { getWebScrollbarStyle } from '@/lib/webScrollbar';
import { useShellLayout } from './useShellLayout';

type Props = {
  currentScreen: AppScreenName;
  showMeiTab: boolean;
  navigateTo: (screen: AppScreenName) => void;
  /** Navbar web. Desligado em onboarding bloqueado. */
  showTopNav?: boolean;
};

export default function AppShell({
  showMeiTab,
  navigateTo,
  currentScreen,
  showTopNav = true,
}: Props) {
  const { isDarkMode } = useThemeStore();
  const { isWebDesktop } = useShellLayout();
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);

  return (
    <View style={styles.root}>
      <ImpersonationBanner />
      {isWebDesktop && showTopNav ? (
        <AppTopNav
          current={currentScreen}
          showMeiTab={showMeiTab}
          compact={false}
          onOpenSettings={() => navigateTo('Configuracoes')}
        />
      ) : null}
      <View style={styles.canvas}>
        <Slot />
      </View>
    </View>
  );
}

function createStyles(isDarkMode: boolean) {
  const canvas = getDashboardCanvasStyle(isDarkMode);
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: canvas.backgroundColor,
    },
    canvas: {
      flex: 1,
      minHeight: 0,
      ...canvas,
      ...(Platform.OS === 'web'
        ? ({
            overflow: 'hidden',
            ...getWebScrollbarStyle(isDarkMode),
          } as Record<string, unknown>)
        : {}),
    },
  });
}
