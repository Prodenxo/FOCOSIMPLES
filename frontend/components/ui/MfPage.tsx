import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { mfSpacing } from '../../lib/theme';
import { SHELL_CANVAS_DARK, SHELL_CANVAS_LIGHT } from '../shell/shellTokens';
import { useMfTheme } from './useMfTheme';
import type { MfPageProps } from './types';
import { MfScrollView } from './MfScrollView';

export const MF_PAGE_MAX_WIDTH = 1280;

export function MfPage({
  children,
  scroll = true,
  maxWidth = MF_PAGE_MAX_WIDTH,
  contentPadding = mfSpacing.lg,
  style,
  testID,
}: MfPageProps) {
  const { theme, isDarkMode } = useMfTheme();
  const styles = useMemo(
    () => createStyles(theme, maxWidth, contentPadding, isDarkMode),
    [theme, maxWidth, contentPadding, isDarkMode]
  );

  const inner = <View style={styles.inner}>{children}</View>;

  if (!scroll) {
    return (
      <View style={[styles.root, style]} testID={testID}>
        {inner}
      </View>
    );
  }

  return (
    <MfScrollView
      style={[styles.root, style]}
      contentContainerStyle={styles.scrollContent}
      testID={testID}
      showsVerticalScrollIndicator
    >
      {inner}
    </MfScrollView>
  );
}

function createStyles(
  theme: ReturnType<typeof useMfTheme>['theme'],
  maxWidth: number,
  contentPadding: number,
  isDarkMode: boolean
) {
  const shellCanvas = isDarkMode ? SHELL_CANVAS_DARK : SHELL_CANVAS_LIGHT;
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: shellCanvas,
    },
    scrollContent: {
      flexGrow: 1,
    },
    inner: {
      width: '100%',
      maxWidth,
      alignSelf: 'center',
      paddingHorizontal: contentPadding,
      paddingBottom: mfSpacing.xl,
      paddingTop: mfSpacing.md,
    },
  });
}
