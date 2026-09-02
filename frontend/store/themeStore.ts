import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance, Platform } from 'react-native';
import { applyMfWebDocumentTheme } from '../lib/webScrollbar';

export type ThemePreference = 'light' | 'dark' | 'system';

interface ThemeState {
  preference: ThemePreference;
  systemIsDark: boolean;
  isDarkMode: boolean;
  initialized: boolean;
  setPreference: (preference: ThemePreference) => Promise<void>;
  toggleTheme: () => Promise<void>;
  initTheme: () => Promise<void>;
}

const THEME_STORAGE_KEY = '@financas_pessoais:theme';

function readSystemIsDark(): boolean {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return Appearance.getColorScheme() === 'dark';
  } catch {
    return false;
  }
}

function resolveIsDarkMode(preference: ThemePreference, systemIsDark: boolean): boolean {
  if (preference === 'system') return systemIsDark;
  return preference === 'dark';
}

function isValidPreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  preference: 'system',
  systemIsDark: false,
  isDarkMode: false,
  initialized: false,

  initTheme: async () => {
    let preference: ThemePreference = 'system';
    try {
      const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (isValidPreference(saved)) {
        preference = saved;
      }
    } catch (error) {
      console.error('Erro ao carregar tema:', error);
    }
    const systemIsDark = readSystemIsDark();
    const isDarkMode = resolveIsDarkMode(preference, systemIsDark);
    set({
      preference,
      systemIsDark,
      isDarkMode,
      initialized: true,
    });
    applyMfWebDocumentTheme(isDarkMode);
  },

  setPreference: async (preference) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch (error) {
      console.error('Erro ao salvar tema:', error);
    }
    const systemIsDark = readSystemIsDark();
    const isDarkMode = resolveIsDarkMode(preference, systemIsDark);
    set({
      preference,
      systemIsDark,
      isDarkMode,
    });
    applyMfWebDocumentTheme(isDarkMode);
  },

  toggleTheme: async () => {
    const current = get().preference;
    const next: ThemePreference =
      current === 'light' ? 'dark' : current === 'dark' ? 'system' : 'light';
    await get().setPreference(next);
  },
}));

// Listener do sistema: dispara quando o usuário troca o tema no SO/navegador.
// Atualiza apenas se a preferência atual for 'system'.
if (Platform.OS === 'web') {
  if (typeof window !== 'undefined' && window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent | { matches: boolean }) => {
      const systemIsDark = e.matches;
      const { preference } = useThemeStore.getState();
      const isDarkMode = resolveIsDarkMode(preference, systemIsDark);
      useThemeStore.setState({
        systemIsDark,
        isDarkMode,
      });
      applyMfWebDocumentTheme(isDarkMode);
    };
    try {
      mq.addEventListener('change', onChange);
    } catch {
      // Safari < 14
      mq.addListener(onChange as never);
    }
  }
} else {
  Appearance.addChangeListener(({ colorScheme }) => {
    const systemIsDark = colorScheme === 'dark';
    const { preference } = useThemeStore.getState();
    const isDarkMode = resolveIsDarkMode(preference, systemIsDark);
    useThemeStore.setState({
      systemIsDark,
      isDarkMode,
    });
    applyMfWebDocumentTheme(isDarkMode);
  });
}

// Inicializa o tema ao carregar o módulo.
void useThemeStore.getState().initTheme();
