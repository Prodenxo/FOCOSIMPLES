import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@/store/themeStore';
import { getTheme } from '@/lib/theme';
import { APP_NAV_ITEMS, filterNavItems } from '@/lib/appNavConfig';
import type { AppScreenName } from '@/lib/navigationContext';
import { SHELL_NAV_HEIGHT_NATIVE } from './shellTokens';

export type BottomNavAction = AppScreenName | 'Menu';

type Props = {
  current: AppScreenName;
  showMeiTab: boolean;
  onSelect: (action: BottomNavAction) => void;
};

export default function AppBottomNav({ current, showMeiTab, onSelect }: Props) {
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useThemeStore();
  const theme = useMemo(() => getTheme(isDarkMode), [isDarkMode]);
  const styles = useMemo(() => createStyles(theme, insets.bottom), [theme, insets.bottom]);

  const tabItems = useMemo(
    () => filterNavItems(APP_NAV_ITEMS, showMeiTab).filter((i) => i.showInBottomNav),
    [showMeiTab],
  );

  const primaryScreens = tabItems.map((i) => i.screen);
  const menuActive = !primaryScreens.includes(current);

  return (
    <View style={styles.bar} accessibilityRole="tablist">
      {tabItems.map((item) => {
        const active = current === item.screen;
        return (
          <Pressable
            key={item.screen}
            onPress={() => onSelect(item.screen)}
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={item.label}
          >
            <Ionicons
              name={(active ? item.activeIcon : item.icon) as keyof typeof Ionicons.glyphMap}
              size={22}
              color={active ? theme.tabActive : theme.tabInactive}
            />
            <Text style={[styles.tabLabel, active && { color: theme.tabActive }]} numberOfLines={1}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
      <Pressable
        onPress={() => onSelect('Menu')}
        style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
        accessibilityRole="tab"
        accessibilityState={{ selected: menuActive }}
        accessibilityLabel="Mais opções"
      >
        <Ionicons
          name={menuActive ? 'ellipsis-horizontal' : 'ellipsis-horizontal-outline'}
          size={22}
          color={menuActive ? theme.tabActive : theme.tabInactive}
        />
        <Text style={[styles.tabLabel, menuActive && { color: theme.tabActive }]}>Mais</Text>
      </Pressable>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof getTheme>, bottomInset: number) {
  return StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      minHeight: SHELL_NAV_HEIGHT_NATIVE + bottomInset,
      paddingBottom: Math.max(bottomInset, 8),
      paddingTop: 8,
      backgroundColor: theme.tabBarBackground,
      borderTopWidth: 1,
      borderTopColor: theme.tabBarBorder,
      ...(Platform.OS === 'web'
        ? ({
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 50,
          } as unknown as ViewStyle)
        : {}),
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      paddingVertical: 4,
    },
    tabLabel: {
      fontSize: 10,
      fontWeight: '600',
      color: theme.tabInactive,
    },
    pressed: {
      opacity: 0.75,
    },
  });
}
