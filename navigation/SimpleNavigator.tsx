import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { View, StyleSheet, PanResponder, BackHandler } from "react-native";
import { useThemeStore } from "../store/themeStore";
import { useAuthStore } from "../store/authStore";
import { getTheme } from "../lib/theme";
import { canAccessMeiArea } from "../lib/meiAccess";
import SideDrawer, { DrawerItem } from "../components/SideDrawer";
import ImpersonationBanner from "../components/ImpersonationBanner";
import {
  NavigationContext,
  type AppScreenName,
} from "../lib/navigationContext";

// Telas
import DashboardScreen from "../screens/DashboardScreen";
import TransactionsScreen from "../screens/TransactionsScreen";
import CategoriasScreen from "../screens/CategoriasScreen";
import OrcamentosScreen from "../screens/OrcamentosScreen";
import AgendaScreen from "../screens/AgendaScreen";
import SettingsScreen from "../screens/SettingsScreen";
import MeiScreen from "../screens/MeiScreen";

const ALL_ITEMS: (DrawerItem<AppScreenName> & {
  requiresMeiAccess?: boolean;
})[] = [
  {
    name: "Dashboard",
    icon: "home-outline",
    activeIcon: "home",
    label: "Visão Geral",
  },
  {
    name: "Transacoes",
    icon: "list-outline",
    activeIcon: "list",
    label: "Transações",
  },
  {
    name: "Categorias",
    icon: "apps-outline",
    activeIcon: "apps",
    label: "Categorias",
  },
  {
    name: "Orcamentos",
    icon: "wallet-outline",
    activeIcon: "wallet",
    label: "Orçamentos",
  },
  {
    name: "Agenda",
    icon: "calendar-outline",
    activeIcon: "calendar",
    label: "Agenda",
  },
  {
    name: "MeuMei",
    icon: "briefcase-outline",
    activeIcon: "briefcase",
    label: "Meu MEI",
    requiresMeiAccess: true,
  },
  {
    name: "Configuracoes",
    icon: "settings-outline",
    activeIcon: "settings",
    label: "Configurações",
  },
];

export default function SimpleNavigator() {
  const [currentScreen, setCurrentScreen] =
    useState<AppScreenName>("Dashboard");
  const [screenHistory, setScreenHistory] = useState<AppScreenName[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { isDarkMode } = useThemeStore();
  const { role, mei } = useAuthStore();
  const showMeiTab = useMemo(() => canAccessMeiArea(role, mei), [role, mei]);
  const items = useMemo(
    () => ALL_ITEMS.filter((item) => !item.requiresMeiAccess || showMeiTab),
    [showMeiTab],
  );
  const theme = useMemo(() => getTheme(isDarkMode), [isDarkMode]);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const navigateTo = useCallback((screen: AppScreenName) => {
    setCurrentScreen((prev) => {
      if (prev !== screen) {
        setScreenHistory((h) => [...h, prev]);
      }
      return screen;
    });
    setDrawerOpen(false);
  }, []);
  const navContextValue = useMemo(
    () => ({ openDrawer, navigateTo, hasGlobalNav: false, shellLocked: false }),
    [openDrawer, navigateTo],
  );

  const drawerOpenRef = useRef(drawerOpen);
  useEffect(() => {
    drawerOpenRef.current = drawerOpen;
  }, [drawerOpen]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy, x0 }) => {
        if (drawerOpenRef.current) return false;
        return x0 < 30 && dx > 8 && Math.abs(dx) > Math.abs(dy) * 1.5;
      },
      onPanResponderRelease: (_, { dx, x0 }) => {
        if (x0 < 30 && dx > 50) setDrawerOpen(true);
      },
    }),
  ).current;

  useEffect(() => {
    if (currentScreen === "MeuMei" && !showMeiTab) {
      setCurrentScreen("Dashboard");
      setScreenHistory([]);
    }
  }, [currentScreen, showMeiTab]);

  useEffect(() => {
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (drawerOpen) {
        setDrawerOpen(false);
        return true;
      }
      if (screenHistory.length > 0) {
        const prev = screenHistory[screenHistory.length - 1];
        setScreenHistory((h) => h.slice(0, -1));
        setCurrentScreen(prev);
        return true;
      }
      return false;
    });
    return () => handler.remove();
  }, [drawerOpen, screenHistory]);

  const renderScreen = () => {
    switch (currentScreen) {
      case "Dashboard":
        return <DashboardScreen />;
      case "Transacoes":
        return <TransactionsScreen />;
      case "Categorias":
        return <CategoriasScreen />;
      case "Orcamentos":
        return <OrcamentosScreen />;
      case "Agenda":
        return <AgendaScreen />;
      case "MeuMei":
        return <MeiScreen />;
      case "Configuracoes":
        return <SettingsScreen />;
      default:
        return <DashboardScreen />;
    }
  };

  return (
    <NavigationContext.Provider value={navContextValue}>
      <View style={styles.outer} {...panResponder.panHandlers}>
        <ImpersonationBanner />
        <View style={styles.content}>{renderScreen()}</View>

        <SideDrawer
          visible={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          items={items}
          current={currentScreen}
          onSelect={setCurrentScreen}
          theme={theme}
          brandTitle="Meu Financeiro"
          headerLabel="Navegação"
        />
      </View>
    </NavigationContext.Provider>
  );
}

const createStyles = (theme: ReturnType<typeof getTheme>) =>
  StyleSheet.create({
    outer: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      flex: 1,
    },
  });
