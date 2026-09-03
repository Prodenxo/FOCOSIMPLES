import { Alert, Platform } from 'react-native';
import type { MfConfirmDialogIntent, MfConfirmDialogProps, MfConfirmDialogVariant } from '../components/ui/MfConfirmDialog';
import { useAppDialogStore } from '../store/appDialogStore';

export interface ConfirmOptions {
  title: string;
  message: string;
  detail?: string;
  highlight?: string;
  highlightCaption?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  confirmIntent?: MfConfirmDialogIntent;
  variant?: MfConfirmDialogVariant;
  iconName?: MfConfirmDialogProps['iconName'];
}

/**
 * Confirmação no modal do app. Se o host ainda não montou, cai no aviso nativo.
 */
export function confirmDialog({
  title,
  message,
  detail,
  highlight,
  highlightCaption,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive = false,
  confirmIntent,
  variant = 'confirm',
  iconName,
}: ConfirmOptions): Promise<boolean> {
  const store = useAppDialogStore.getState();
  if (store.ready) {
    return store.present({
      mode: 'confirm',
      title,
      message,
      detail,
      highlight,
      highlightCaption,
      confirmLabel,
      cancelLabel,
      confirmIntent: confirmIntent ?? (destructive ? 'danger' : 'primary'),
      variant,
      iconName,
    });
  }
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      {
        text: confirmLabel,
        style: destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
}

/**
 * Aviso no modal do app. Se o host ainda não montou, cai no aviso nativo.
 */
export function alertDialog(
  title: string,
  message: string,
  extras: Pick<ConfirmOptions, 'detail' | 'highlight' | 'highlightCaption' | 'iconName' | 'variant'> = {},
): void {
  const store = useAppDialogStore.getState();
  if (store.ready) {
    void store.present({
      mode: 'alert',
      title,
      message,
      confirmLabel: 'OK',
      variant: extras.variant ?? 'info',
      confirmIntent: extras.variant === 'error' ? 'danger' : extras.variant === 'success' ? 'success' : 'primary',
      ...extras,
    });
    return;
  }
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}
