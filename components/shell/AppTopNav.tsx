import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { getTheme, mfRadius, mfSpacing, mfTypography } from '@/lib/theme';
import { getTechTokens, mfTechPanelChrome } from '@/lib/techDesign';
import {
  APP_NAV_ITEMS,
  SCREEN_TO_HREF,
  filterNavItems,
  type AppNavItem,
} from '@/lib/appNavConfig';
import type { AppScreenName } from '@/lib/navigationContext';
import { AppBrandLogo } from './AppBrandLogo';
import { APP_BRAND_NAME } from '@/lib/appBrand';
import { SHELL_NAV_MAX_WIDTH } from './shellTokens';
import { SignOutHeaderButton } from '../settings/SignOutHeaderButton';

type Props = {
  current: AppScreenName;
  showMeiTab: boolean;
  compact?: boolean;
  onOpenMenu?: () => void;
  onOpenSettings: () => void;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'FS';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function AppTopNav({
  current,
  showMeiTab,
  compact = false,
  onOpenMenu,
  onOpenSettings,
}: Props) {
  const router = useRouter();
  const { isDarkMode, toggleTheme } = useThemeStore();
  const { user } = useAuthStore();
  const theme = useMemo(() => getTheme(isDarkMode), [isDarkMode]);
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode]);
  const styles = useMemo(
    () => createStyles(theme, isDarkMode, compact, tokens),
    [theme, isDarkMode, compact, tokens],
  );
  const navChrome = useMemo(() => mfTechPanelChrome(isDarkMode), [isDarkMode]);

  const topItems = useMemo(
    () => filterNavItems(APP_NAV_ITEMS, showMeiTab).filter((i) => i.showInTopNav),
    [showMeiTab],
  );

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split('@')[0] ||
    'Conta';

  const goTo = (screen: AppScreenName) => {
    router.replace(SCREEN_TO_HREF[screen] as any);
  };

  if (Platform.OS !== 'web') return null;

  return (
    <View style={styles.shellPad} accessibilityRole="header">
      <View style={[styles.floatingBar, navChrome]}>
        <View style={styles.inner}>
          <View style={styles.brandZone}>
            {compact && onOpenMenu ? (
              <Pressable
                onPress={onOpenMenu}
                style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Abrir menu"
              >
                <Ionicons name="menu" size={20} color={theme.text} />
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => goTo('MeuMei')}
              style={({ pressed }) => [pressed && styles.pressed]}
              accessibilityRole="link"
              accessibilityLabel={`${APP_BRAND_NAME} — início`}
            >
              <AppBrandLogo
                variant={compact ? 'wordmarkCompact' : 'wordmark'}
                transparent
                onDarkBackground={isDarkMode}
              />
            </Pressable>
          </View>

          {!compact ? (
            <View style={styles.navLinks} accessibilityRole="toolbar">
              {topItems.map((item) => (
                <NavLink
                  key={item.screen}
                  item={item}
                  active={current === item.screen}
                  onPress={() => goTo(item.screen)}
                  styles={styles}
                  theme={theme}
                  accent={tokens.accent}
                />
              ))}
            </View>
          ) : (
            <View style={styles.navSpacer} />
          )}

          <View style={styles.actions}>
            <Pressable
              onPress={() => void toggleTheme()}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={isDarkMode ? 'Ativar tema claro' : 'Ativar tema escuro'}
            >
              <Ionicons
                name={isDarkMode ? 'sunny-outline' : 'moon-outline'}
                size={18}
                color={tokens.accent}
              />
            </Pressable>
            <Pressable
              onPress={onOpenSettings}
              style={({ pressed }) => [styles.accountBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Minha conta"
            >
              <View style={[styles.avatar, { borderColor: tokens.accent }]}>
                <Text style={styles.avatarText}>{initialsFromName(displayName)}</Text>
              </View>
              {!compact ? (
                <Text style={styles.accountLabel} numberOfLines={1}>
                  Minha Conta
                </Text>
              ) : null}
            </Pressable>
            <SignOutHeaderButton iconOnly={compact} />
          </View>
        </View>
      </View>
    </View>
  );
}

function NavLink({
  item,
  active,
  onPress,
  styles,
  theme,
  accent,
}: {
  item: AppNavItem;
  active: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  theme: ReturnType<typeof getTheme>;
  accent: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.navLink,
        active && styles.navLinkActive,
        pressed && styles.pressed,
      ]}
      accessibilityRole="link"
      accessibilityState={{ selected: active }}
    >
      {active ? <View style={[styles.navLinkDot, { backgroundColor: accent }]} /> : null}
      <Text
        style={[
          styles.navLinkText,
          active && styles.navLinkTextActive,
          !active && { color: theme.textTertiary },
        ]}
      >
        {item.label}
      </Text>
    </Pressable>
  );
}

function createStyles(
  theme: ReturnType<typeof getTheme>,
  isDarkMode: boolean,
  compact: boolean,
  tokens: ReturnType<typeof getTechTokens>,
) {
  return StyleSheet.create({
    shellPad: {
      paddingTop: compact ? 8 : 12,
      paddingHorizontal: compact ? mfSpacing.md : mfSpacing.lg,
      paddingBottom: compact ? 8 : 10,
      ...(Platform.OS === 'web'
        ? ({
            position: 'sticky',
            top: 0,
            zIndex: 50,
          } as unknown as ViewStyle)
        : {}),
    },
    floatingBar: {
      maxWidth: SHELL_NAV_MAX_WIDTH,
      width: '100%',
      alignSelf: 'center',
      minHeight: compact ? 48 : 54,
      justifyContent: 'center',
    },
    inner: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: compact ? mfSpacing.md : mfSpacing.lg,
      gap: mfSpacing.md,
      minHeight: compact ? 48 : 54,
    },
    brandZone: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: mfSpacing.sm,
      flexShrink: 0,
    },
    navLinks: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      flexWrap: 'nowrap',
      gap: 4,
      minWidth: 0,
      paddingHorizontal: mfSpacing.xs,
    },
    navSpacer: {
      flex: 1,
      minWidth: 0,
    },
    navLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: compact ? 10 : 12,
      paddingVertical: 7,
      borderRadius: mfRadius.sm,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    navLinkActive: {
      backgroundColor: tokens.accentSoft,
      borderColor: tokens.panelBorder,
    },
    navLinkDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
    },
    navLinkText: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.textSecondary,
      letterSpacing: -0.15,
    },
    navLinkTextActive: {
      color: theme.text,
      fontWeight: '700',
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: mfSpacing.sm,
      flexShrink: 0,
    },
    iconBtn: {
      width: 34,
      height: 34,
      borderRadius: mfRadius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: tokens.insetBorder,
      backgroundColor: tokens.insetFill,
    },
    accountBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 4,
      paddingHorizontal: 10,
      paddingLeft: 5,
      borderRadius: mfRadius.pill,
      borderWidth: 1,
      borderColor: tokens.panelBorder,
      backgroundColor: tokens.insetFill,
    },
    avatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
    },
    avatarText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.3,
    },
    accountLabel: {
      ...mfTypography.bodyStrong,
      fontSize: 12,
      color: theme.text,
      letterSpacing: -0.1,
    },
    pressed: {
      opacity: 0.82,
    },
  });
}
