import { Platform, StatusBar } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';
import { mfSpacing } from './theme';

/** Espaço extra abaixo do notch/status bar (padrão app mobile). */
export const MOBILE_TOP_EXTRA = mfSpacing.sm;

const IOS_FALLBACK_TOP = 47;
const ANDROID_FALLBACK_TOP = StatusBar.currentHeight ?? 24;

/** Inset superior efetivo (Modal e cold start podem reportar 0). */
export function getEffectiveTopInset(insets: EdgeInsets): number {
  if (Platform.OS === 'web') return 0;
  if (insets.top > 0) return insets.top;
  return Platform.OS === 'ios' ? IOS_FALLBACK_TOP : ANDROID_FALLBACK_TOP;
}

/** Padding superior em telas nativas (fora de Modal). */
export function getNativeScreenTopPad(insets: EdgeInsets, extra = MOBILE_TOP_EXTRA): number {
  if (Platform.OS === 'web') return 0;
  return getEffectiveTopInset(insets) + extra;
}

/** Padding superior em Modals nativos quando `SafeAreaView` top falha. */
export function getNativeModalTopPad(insets: EdgeInsets, extra = MOBILE_TOP_EXTRA): number {
  if (Platform.OS === 'web') return mfSpacing.md;
  return getEffectiveTopInset(insets) + extra;
}
