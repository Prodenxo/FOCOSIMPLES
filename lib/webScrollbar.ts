import { Platform } from 'react-native';
import type { Theme } from './theme';

/** Scrollbar — modo escuro (canvas FocoMEI #0D2B5E). */
export const MF_SCROLL_TRACK_DARK = '#0D2B5E';
export const MF_SCROLL_THUMB_DARK = 'rgba(255, 255, 255, 0.22)';
export const MF_SCROLL_THUMB_HOVER_DARK = 'rgba(255, 255, 255, 0.38)';

/** Scrollbar — modo claro (canvas #e4eaf3, cards brancos). */
export const MF_SCROLL_TRACK_LIGHT = '#e8eef4';
export const MF_SCROLL_THUMB_LIGHT = '#c5d0e0';
export const MF_SCROLL_THUMB_HOVER_LIGHT = '#94a3b8';

/** @deprecated Use tokens por tema via `getScrollTokens`. */
export const MF_SCROLL_TRACK = MF_SCROLL_TRACK_DARK;
export const MF_SCROLL_THUMB = MF_SCROLL_THUMB_DARK;
export const MF_SCROLL_THUMB_HOVER = MF_SCROLL_THUMB_HOVER_DARK;

export const MF_SCROLL_ATTR = 'data-mf-theme';

/** Classe CSS — scroll vertical padrão (painéis e páginas). */
export const WEB_SCROLL_Y_CLASS = 'mf-scroll-y';

export function getScrollTokens(isDarkMode: boolean) {
  return isDarkMode
    ? {
        track: MF_SCROLL_TRACK_DARK,
        thumb: MF_SCROLL_THUMB_DARK,
        thumbHover: MF_SCROLL_THUMB_HOVER_DARK,
      }
    : {
        track: MF_SCROLL_TRACK_LIGHT,
        thumb: MF_SCROLL_THUMB_LIGHT,
        thumbHover: MF_SCROLL_THUMB_HOVER_LIGHT,
      };
}

export function isThemeDark(theme?: Theme | boolean): boolean {
  if (typeof theme === 'boolean') return theme;
  if (!theme) return true;
  return theme.background === '#000000' || theme.background === '#0D2B5E';
}

/** Sincroniza variáveis CSS globais (`index.html`) com o tema ativo. */
export function applyMfWebDocumentTheme(isDarkMode: boolean): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  document.documentElement.setAttribute(MF_SCROLL_ATTR, isDarkMode ? 'dark' : 'light');
}

/** Agenda desktop — overflow dentro de flex (layout; scroll usa tokens globais). */
export const WEB_AGENDA_EVENTS_SCROLL_CLASS = 'mf-agenda-events-scroll';

/** Esconde barra horizontal (tabs, chips, filtros). */
export const WEB_HIDE_X_SCROLL_CLASS = 'mf-hide-x-scrollbar';

/** Estilo Firefox para barras verticais visíveis (web). */
export function getWebScrollbarStyle(themeOrDark?: Theme | boolean): Record<string, string> {
  if (Platform.OS !== 'web') return {};
  const isDark =
    typeof themeOrDark === 'boolean'
      ? themeOrDark
      : isThemeDark(themeOrDark);
  const { thumb, track } = getScrollTokens(isDark);
  return {
    scrollbarWidth: 'thin',
    scrollbarColor: `${thumb} ${track}`,
  };
}

type WebScrollViewOptions = {
  horizontal?: boolean;
  hideHorizontalBar?: boolean;
  extraClassName?: string;
};

/** Props para ScrollView na web — design único de scrollbar. */
export function getWebScrollViewProps(
  themeOrDark?: Theme | boolean,
  options: WebScrollViewOptions = {},
): { className?: string; style?: Record<string, string> } {
  if (Platform.OS !== 'web') return {};

  const { horizontal, hideHorizontalBar, extraClassName } = options;
  const classes = [
    !horizontal ? WEB_SCROLL_Y_CLASS : '',
    horizontal && hideHorizontalBar ? WEB_HIDE_X_SCROLL_CLASS : '',
    horizontal && !hideHorizontalBar ? WEB_SCROLL_Y_CLASS : '',
    extraClassName ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return {
    ...(classes ? { className: classes } : {}),
    style: getWebScrollbarStyle(themeOrDark),
  };
}

type WebScrollIndicatorOptions = {
  horizontal?: boolean;
  hideHorizontalBar?: boolean;
  showsVerticalScrollIndicator?: boolean;
  showsHorizontalScrollIndicator?: boolean;
};

/**
 * RN Web (ScrollViewBase): se QUALQUER shows*ScrollIndicator === false,
 * aplica scrollbarWidth:none e esconde a barra. Nunca passe false no eixo
 * oposto — use mf-hide-x-scrollbar para esconder só horizontal.
 */
export function getWebScrollIndicatorProps({
  horizontal = false,
  hideHorizontalBar = false,
  showsVerticalScrollIndicator,
  showsHorizontalScrollIndicator,
}: WebScrollIndicatorOptions): Pick<
  ScrollViewPropsLike,
  'showsVerticalScrollIndicator' | 'showsHorizontalScrollIndicator'
> {
  if (horizontal) {
    if (hideHorizontalBar) {
      return {
        showsHorizontalScrollIndicator: true,
        showsVerticalScrollIndicator: showsVerticalScrollIndicator ?? true,
      };
    }
    return {
      showsHorizontalScrollIndicator: showsHorizontalScrollIndicator ?? true,
      ...(showsVerticalScrollIndicator !== undefined
        ? { showsVerticalScrollIndicator }
        : {}),
    };
  }

  return {
    showsVerticalScrollIndicator: showsVerticalScrollIndicator ?? true,
    ...(showsHorizontalScrollIndicator !== undefined
      ? { showsHorizontalScrollIndicator }
      : {}),
  };
}

type ScrollViewPropsLike = {
  showsVerticalScrollIndicator?: boolean;
  showsHorizontalScrollIndicator?: boolean;
};

/** Spread em ScrollView legado: className + indicators seguros na web. */
export function getWebScrollViewSpread(
  themeOrDark?: Theme | boolean,
  options: WebScrollViewOptions & WebScrollIndicatorOptions = {},
): {
  className?: string;
  style?: Record<string, string>;
  showsVerticalScrollIndicator?: boolean;
  showsHorizontalScrollIndicator?: boolean;
} {
  if (Platform.OS !== 'web') {
    return {
      showsVerticalScrollIndicator: options.showsVerticalScrollIndicator,
      showsHorizontalScrollIndicator: options.showsHorizontalScrollIndicator,
    };
  }

  return {
    ...getWebScrollViewProps(themeOrDark, options),
    ...getWebScrollIndicatorProps(options),
  };
}

/** overflow-y na web — ScrollView com altura fixa em flex. */
export function getWebAgendaEventsScrollStyle(): Record<string, unknown> {
  if (Platform.OS !== 'web') return {};
  return {
    overflowY: 'auto',
    overflowX: 'hidden',
  };
}