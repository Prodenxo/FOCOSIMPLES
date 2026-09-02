/**
 * Navegação principal do app.
 * Usamos navegação custom (AuthNavigator + SimpleNavigator) em vez de Stack/Tab do
 * React Navigation devido a um bug com Expo SDK 54 + React 19 + react-native-screens
 * ("java.lang.String  cannot be cast to java.lang.Boolean").
 */
import React, { useEffect, useState } from "react";
import { useAuthStore } from "../store/authStore";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  AppState,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import SimpleNavigator from "./SimpleNavigator";
import AuthNavigator from "./AuthNavigator";
import OnboardingScreen from "../screens/OnboardingScreen";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { isAppConfigured, isLocalApiAuthMode } from "../lib/authMode";

const ONBOARDING_KEY = "onboarding_done";

function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#2563eb" />
      <Text style={styles.loadingText}>Carregando...</Text>
    </View>
  );
}

function AppConfigScreen() {
  return (
    <ScrollView contentContainerStyle={styles.configContainer}>
      <Text style={styles.configTitle}>App não configurado</Text>
      <Text style={styles.configText}>
        Auth local — crie `.env` na raiz:
      </Text>
      <Text style={styles.configCode}>
        EXPO_PUBLIC_AUTH_MODE=local{"\n"}
        EXPO_PUBLIC_MEI_API_URL_DEV=http://localhost:3333
      </Text>
      <Text style={styles.configSubtext}>
        Depois reinicie o Expo (`npx expo start -c`).
      </Text>
    </ScrollView>
  );
}

export default function AppNavigator() {
  const { user, sessionRestored } = useAuthStore();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then((val) => {
      setOnboardingDone(val === "true");
    });
  }, []);

  useEffect(() => {
    if (isLocalApiAuthMode() || !isSupabaseConfigured()) return;
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });
    return () => subscription.remove();
  }, []);

  if (!isAppConfigured()) {
    return <AppConfigScreen />;
  }

  if (!sessionRestored || onboardingDone === null) {
    return <LoadingScreen />;
  }

  if (!onboardingDone) {
    return (
      <OnboardingScreen
        onComplete={async () => {
          await AsyncStorage.setItem(ONBOARDING_KEY, "true");
          setOnboardingDone(true);
        }}
      />
    );
  }

  if (!user) {
    return <AuthNavigator />;
  }

  return <SimpleNavigator />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#666",
  },
  configContainer: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#F3F4F6",
  },
  configTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 12,
    textAlign: "center",
  },
  configText: {
    fontSize: 15,
    color: "#374151",
    marginBottom: 8,
  },
  configCode: {
    fontFamily: "monospace",
    fontSize: 13,
    color: "#1F2937",
    backgroundColor: "#E5E7EB",
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  configSubtext: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 16,
  },
});
