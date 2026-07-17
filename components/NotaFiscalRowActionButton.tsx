import React from 'react';
import {
  ActivityIndicator,
  Platform,
  TouchableOpacity,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

export type NotaFiscalRowActionButtonProps = {
  icon: IoniconsName;
  color: string;
  hint: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Botão compacto da lista de notas fiscais com tooltip no web (`title`).
 */
export function NotaFiscalRowActionButton({
  icon,
  color,
  hint,
  onPress,
  disabled = false,
  loading = false,
  style,
}: NotaFiscalRowActionButtonProps) {
  const webTitle = Platform.OS === 'web' ? { title: hint } : {};

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={style}
      accessibilityRole="button"
      accessibilityLabel={hint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      {...webTitle}
    >
      {loading ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <Ionicons name={icon} size={15} color={color} />
      )}
    </TouchableOpacity>
  );
}
