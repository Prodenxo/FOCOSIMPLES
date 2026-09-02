import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import { useThemeStore } from '../themeStore';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('react-native', () => ({
  Appearance: {
    getColorScheme: jest.fn(() => 'light'),
    addChangeListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  Platform: { OS: 'ios' },
}));

describe('themeStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Appearance.getColorScheme as jest.Mock).mockReturnValue('light');
    useThemeStore.setState({
      preference: 'system',
      systemIsDark: false,
      isDarkMode: false,
      initialized: false,
    });
  });

  it('initTheme com "dark" no storage define preference dark e isDarkMode true', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('dark');
    await useThemeStore.getState().initTheme();
    const state = useThemeStore.getState();
    expect(state.preference).toBe('dark');
    expect(state.isDarkMode).toBe(true);
  });

  it('initTheme com "light" no storage define preference light e isDarkMode false', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('light');
    await useThemeStore.getState().initTheme();
    const state = useThemeStore.getState();
    expect(state.preference).toBe('light');
    expect(state.isDarkMode).toBe(false);
  });

  it('initTheme com null no storage usa system como default', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (Appearance.getColorScheme as jest.Mock).mockReturnValue('dark');
    await useThemeStore.getState().initTheme();
    const state = useThemeStore.getState();
    expect(state.preference).toBe('system');
    expect(state.isDarkMode).toBe(true);
  });

  it('initTheme com "system" no storage segue o SO', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('system');
    (Appearance.getColorScheme as jest.Mock).mockReturnValue('dark');
    await useThemeStore.getState().initTheme();
    const state = useThemeStore.getState();
    expect(state.preference).toBe('system');
    expect(state.isDarkMode).toBe(true);
  });

  it('setPreference persiste no storage e atualiza isDarkMode', async () => {
    await useThemeStore.getState().setPreference('dark');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@financas_pessoais:theme', 'dark');
    expect(useThemeStore.getState().preference).toBe('dark');
    expect(useThemeStore.getState().isDarkMode).toBe(true);
  });

  it('toggleTheme cicla light → dark → system → light', async () => {
    await useThemeStore.getState().setPreference('light');
    await useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().preference).toBe('dark');
    await useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().preference).toBe('system');
    await useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().preference).toBe('light');
  });
});
