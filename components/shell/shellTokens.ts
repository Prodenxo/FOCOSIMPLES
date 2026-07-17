import { brandDarkColors } from '@/lib/brandTokens'

/** Fundo da área de conteúdo — light: slate; dark: navy da marca (sem preto puro). */
export const SHELL_CANVAS_LIGHT = '#F1F5F9'
export const SHELL_CANVAS_DARK = brandDarkColors.background

/** Alinhado ao AUTH_BREAKPOINT_MD — web estreito usa shell mobile. */
export const SHELL_BREAKPOINT_MD = 768;

export const SHELL_NAV_MAX_WIDTH = 1280;
export const SHELL_NAV_FLOAT_RADIUS = 16;
export const SHELL_NAV_FLOAT_SHADOW_LIGHT = '0 4px 24px rgba(15, 23, 42, 0.06)';

export const SHELL_NAV_HEIGHT_WEB = 64;
export const SHELL_NAV_HEIGHT_WEB_COMPACT = 52;
export const SHELL_NAV_HEIGHT_NATIVE = 56;
