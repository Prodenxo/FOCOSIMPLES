import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type { FinanceSemantic } from '../../lib/theme';

export type { FinanceSemantic };

export interface MfBaseProps {
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export interface MfCardProps extends MfBaseProps {
  children: ReactNode;
  /** default = surface + borda; elevated = sombra; outline = só borda */
  variant?: 'default' | 'elevated' | 'outline';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export interface MfMetricTileProps extends MfBaseProps {
  label: string;
  value: string;
  semantic?: FinanceSemantic;
  icon?: ReactNode;
  hint?: string;
  /** Reduz fonte em telas estreitas para valores longos (ex.: saldo). */
  shrinkValue?: boolean;
  /** KPI estilo painel técnico (mono, borda acento). */
  variant?: 'default' | 'tech';
  /** Destaque no grid (saldo principal). */
  featured?: boolean;
}

export interface MfPeriodNavProps extends MfBaseProps {
  label: string;
  onPrevious?: () => void;
  onNext?: () => void;
  disablePrevious?: boolean;
  disableNext?: boolean;
  variant?: 'default' | 'tech';
  size?: 'default' | 'large';
}

export interface MfSegmentOption<T extends string = string> {
  key: T;
  label: string;
  /** Destaque semântico quando o segmento está ativo. */
  tone?: 'income' | 'expense' | 'pending' | 'neutral';
}

export interface MfSegmentedProps<T extends string = string> extends MfBaseProps {
  options: MfSegmentOption<T>[];
  value: T;
  onChange: (key: T) => void;
}

export interface MfDonutSegment {
  ratio: number;
  color: string;
}

export interface MfDonutChartProps extends MfBaseProps {
  size?: number;
  segments: MfDonutSegment[];
  strokeWidth?: number;
  centerLabel?: string;
  centerSubLabel?: string;
}

export interface MfAppHeaderProps extends MfBaseProps {
  title?: string;
  subtitle?: string;
  onMenuPress?: () => void;
  right?: ReactNode;
}

export interface MfPageProps extends MfBaseProps {
  children: ReactNode;
  scroll?: boolean;
  maxWidth?: number;
  contentPadding?: number;
}
