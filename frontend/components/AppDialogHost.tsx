import React, { useEffect } from 'react';
import { MfConfirmDialog } from './ui/MfConfirmDialog';
import { useAppDialogStore } from '../store/appDialogStore';

export function AppDialogHost() {
  const current = useAppDialogStore((s) => s.current);
  const setReady = useAppDialogStore((s) => s.setReady);
  const resolve = useAppDialogStore((s) => s.resolve);

  useEffect(() => {
    setReady(true);
    return () => setReady(false);
  }, [setReady]);

  const isConfirm = current?.mode === 'confirm';

  return (
    <MfConfirmDialog
      visible={current !== null}
      variant={current?.variant ?? (isConfirm ? 'confirm' : 'info')}
      confirmIntent={current?.confirmIntent ?? (isConfirm ? 'primary' : 'primary')}
      iconName={current?.iconName}
      title={current?.title ?? ''}
      message={current?.message ?? ''}
      detail={current?.detail}
      highlight={current?.highlight}
      highlightCaption={current?.highlightCaption}
      confirmLabel={current?.confirmLabel}
      cancelLabel={current?.cancelLabel ?? 'Cancelar'}
      onConfirm={isConfirm ? () => resolve(true) : undefined}
      onCancel={() => resolve(isConfirm ? false : true)}
    />
  );
}
