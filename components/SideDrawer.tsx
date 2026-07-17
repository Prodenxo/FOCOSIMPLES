import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { Theme } from '../lib/theme';
import { getTheme, mfRadius, mfSpacing, mfTypography } from '../lib/theme';
import { getTechTokens, mfTechInsetSurface } from '../lib/techDesign';
import { useThemeStore } from '../store/themeStore';
import { AppBrandLogo } from './shell/AppBrandLogo';
import { APP_BRAND_NAME } from '@/lib/appBrand';
import { SHELL_CANVAS_DARK, SHELL_CANVAS_LIGHT } from './shell/shellTokens';

export type DrawerItem<T extends string> = {
  name: T;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  activeIcon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
};

export type DrawerFooterAction = {
  label: string;
  subtitle?: string;
  onPress: () => void;
};

type Props<T extends string> = {
  visible: boolean;
  onClose: () => void;
  items: DrawerItem<T>[];
  current: T;
  onSelect: (name: T) => void;
  theme: Theme;
  headerLabel?: string;
  brandTitle?: string;
  footerAction?: DrawerFooterAction | null;
};

const DRAWER_MAX_WIDTH = 320;
const DRAWER_MIN_RATIO = 0.82;

function DrawerNavItem<T extends string>({
  item,
  isActive,
  onPress,
  styles,
  accent,
  theme,
}: {
  item: DrawerItem<T>;
  isActive: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  accent: string;
  theme: Theme;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.navItem,
        isActive && styles.navItemActive,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={item.label}
    >
      {isActive ? <View style={[styles.navDot, { backgroundColor: accent }]} /> : null}
      <View style={[styles.navIconWrap, isActive && styles.navIconWrapActive]}>
        <Ionicons
          name={isActive ? item.activeIcon : item.icon}
          size={20}
          color={isActive ? accent : theme.textSecondary}
        />
      </View>
      <Text
        style={[
          styles.navLabel,
          isActive && styles.navLabelActive,
          !isActive && { color: theme.textTertiary },
        ]}
        numberOfLines={1}
      >
        {item.label}
      </Text>
      {isActive ? (
        <Ionicons name="chevron-forward" size={16} color={accent} style={styles.navChevron} />
      ) : null}
    </Pressable>
  );
}

export default function SideDrawer<T extends string>({
  visible,
  onClose,
  items,
  current,
  onSelect,
  theme: themeProp,
  headerLabel = 'Menu',
  brandTitle = APP_BRAND_NAME,
  footerAction = null,
}: Props<T>) {
  const { isDarkMode } = useThemeStore();
  const theme = useMemo(() => themeProp ?? getTheme(isDarkMode), [themeProp, isDarkMode]);
  const tokens = useMemo(() => getTechTokens(isDarkMode), [isDarkMode]);
  const { width: windowWidth } = useWindowDimensions();
  const drawerWidth = Math.min(DRAWER_MAX_WIDTH, Math.round(windowWidth * DRAWER_MIN_RATIO));

  const translateX = useRef(new Animated.Value(-drawerWidth)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: visible ? 0 : -drawerWidth,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: visible ? 1 : 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, drawerWidth, translateX, backdropOpacity]);

  const styles = useMemo(
    () => createStyles(theme, isDarkMode, tokens),
    [theme, isDarkMode, tokens],
  );

  const backdropTint = isDarkMode ? 'rgba(3, 5, 8, 0.78)' : 'rgba(15, 23, 42, 0.42)';
  const canvasBg = isDarkMode ? SHELL_CANVAS_DARK : SHELL_CANVAS_LIGHT;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity, backgroundColor: backdropTint }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fechar menu" />
      </Animated.View>

      <Animated.View
        style={[
          styles.drawerShell,
          { width: drawerWidth, transform: [{ translateX }], backgroundColor: canvasBg },
        ]}
      >
        <View style={styles.accentStripe} pointerEvents="none" />

        <View style={styles.drawerPanel}>
          {Platform.OS !== 'web' ? (
            <BlurView
              intensity={isDarkMode ? 72 : 88}
              tint={isDarkMode ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          <View style={styles.panelTint} pointerEvents="none" />

          <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'bottom']}>
            <View style={styles.header}>
              <View style={styles.brandRow}>
                <View style={styles.brandMarkWrap}>
                  <AppBrandLogo variant="mark" onDarkBackground={isDarkMode} />
                </View>
                <View style={styles.brandTextCol}>
                  <Text style={styles.brandEyebrow} numberOfLines={1}>
                    PAINEL
                  </Text>
                  <Text style={styles.brandTitle} numberOfLines={1}>
                    {brandTitle}
                  </Text>
                  <Text style={styles.brandSubtitle} numberOfLines={1}>
                    {headerLabel}
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={onClose}
                hitSlop={8}
                style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Fechar menu"
              >
                <Ionicons name="close" size={20} color={theme.text} />
              </Pressable>
            </View>

            <View style={styles.sectionEyebrow}>
              <View style={[styles.sectionDot, { backgroundColor: tokens.accent }]} />
              <Text style={[styles.sectionLabel, { color: tokens.accentMuted }]}>NAVEGAÇÃO</Text>
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {items.map((item) => (
                <DrawerNavItem
                  key={item.name}
                  item={item}
                  isActive={current === item.name}
                  onPress={() => {
                    onSelect(item.name);
                    onClose();
                  }}
                  styles={styles}
                  accent={tokens.accent}
                  theme={theme}
                />
              ))}
            </ScrollView>

            {footerAction ? (
              <Pressable
                style={({ pressed }) => [styles.footerAction, pressed && styles.pressed]}
                onPress={() => {
                  footerAction.onPress();
                  onClose();
                }}
                accessibilityRole="button"
                accessibilityLabel={footerAction.label}
              >
                <View style={styles.footerAccentBar} pointerEvents="none" />
                <View style={styles.footerActionIcon}>
                  <Ionicons name="rocket-outline" size={20} color={tokens.accent} />
                </View>
                <View style={styles.footerActionTextCol}>
                  <Text style={styles.footerActionLabel}>{footerAction.label}</Text>
                  {footerAction.subtitle ? (
                    <Text style={styles.footerActionSubtitle}>{footerAction.subtitle}</Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
              </Pressable>
            ) : null}
          </SafeAreaView>
        </View>
      </Animated.View>
    </View>
  );
}

const createStyles = (
  theme: Theme,
  isDarkMode: boolean,
  tokens: ReturnType<typeof getTechTokens>,
) => {
  const inset = mfTechInsetSurface(isDarkMode, false);
  const footerInset = mfTechInsetSurface(isDarkMode, true);

  return StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
    },
    drawerShell: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      overflow: 'hidden',
    },
    accentStripe: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 3,
      backgroundColor: tokens.accent,
      zIndex: 2,
    },
    drawerPanel: {
      flex: 1,
      marginLeft: 3,
      borderRightWidth: 1,
      borderRightColor: tokens.panelBorder,
      backgroundColor: tokens.panelFill,
      overflow: 'hidden',
      ...(Platform.OS === 'web'
        ? ({
            backdropFilter: 'blur(24px) saturate(1.25)',
            WebkitBackdropFilter: 'blur(24px) saturate(1.25)',
            boxShadow: tokens.panelShadow,
          } as ViewStyle)
        : {
            shadowColor: isDarkMode ? '#000' : '#0f172a',
            shadowOffset: { width: 8, height: 0 },
            shadowOpacity: isDarkMode ? 0.55 : 0.18,
            shadowRadius: 24,
            elevation: 16,
          }),
    },
    panelTint: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: isDarkMode ? 'rgba(34, 211, 238, 0.04)' : 'rgba(29, 78, 216, 0.03)',
    },
    safeArea: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: mfSpacing.lg,
      paddingTop: mfSpacing.md,
      paddingBottom: mfSpacing.md,
      borderBottomWidth: 1,
      borderBottomColor: tokens.divider,
    },
    brandRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: mfSpacing.sm,
      minWidth: 0,
    },
    brandMarkWrap: {
      ...inset,
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    brandTextCol: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    brandEyebrow: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.1,
      textTransform: 'uppercase',
      color: tokens.accent,
    },
    brandTitle: {
      ...mfTypography.subtitle,
      fontSize: 17,
      fontWeight: '700',
      color: theme.text,
      letterSpacing: -0.2,
    },
    brandSubtitle: {
      ...mfTypography.caption,
      color: theme.textTertiary,
    },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: mfRadius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: tokens.insetBorder,
      backgroundColor: tokens.insetFill,
      marginTop: mfSpacing.xs,
    },
    sectionEyebrow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: mfSpacing.xs,
      paddingHorizontal: mfSpacing.lg,
      paddingTop: mfSpacing.md,
      paddingBottom: mfSpacing.sm,
    },
    sectionDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
    },
    sectionLabel: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.2,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: mfSpacing.md,
      paddingBottom: mfSpacing.md,
      gap: mfSpacing.xs,
    },
    navItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: mfSpacing.sm,
      paddingVertical: mfSpacing.sm,
      paddingHorizontal: mfSpacing.sm,
      borderRadius: mfRadius.md,
      borderWidth: 1,
      borderColor: 'transparent',
      minHeight: 48,
    },
    navItemActive: {
      backgroundColor: tokens.accentSoft,
      borderColor: tokens.panelBorder,
    },
    navDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      marginLeft: mfSpacing.xs,
    },
    navIconWrap: {
      width: 36,
      height: 36,
      borderRadius: mfRadius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: tokens.insetBorder,
      backgroundColor: tokens.insetFill,
    },
    navIconWrapActive: {
      borderColor: tokens.panelBorder,
      backgroundColor: isDarkMode ? 'rgba(10, 15, 24, 0.55)' : 'rgba(255, 255, 255, 0.85)',
    },
    navLabel: {
      flex: 1,
      fontSize: 14,
      fontWeight: '500',
      color: theme.textSecondary,
      letterSpacing: -0.1,
    },
    navLabelActive: {
      color: theme.text,
      fontWeight: '700',
    },
    navChevron: {
      marginRight: mfSpacing.xs,
      opacity: 0.85,
    },
    footerAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: mfSpacing.sm,
      marginHorizontal: mfSpacing.md,
      marginBottom: mfSpacing.md,
      padding: mfSpacing.md,
      borderRadius: mfRadius.md,
      overflow: 'hidden',
      ...footerInset,
    },
    footerAccentBar: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 3,
      backgroundColor: tokens.accent,
    },
    footerActionIcon: {
      width: 40,
      height: 40,
      borderRadius: mfRadius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tokens.insetFill,
      borderWidth: 1,
      borderColor: tokens.insetBorder,
      marginLeft: mfSpacing.xs,
    },
    footerActionTextCol: {
      flex: 1,
      minWidth: 0,
    },
    footerActionLabel: {
      ...mfTypography.bodyStrong,
      color: theme.text,
    },
    footerActionSubtitle: {
      ...mfTypography.caption,
      color: theme.textSecondary,
      marginTop: 2,
    },
    pressed: {
      opacity: 0.82,
    },
  });
};
