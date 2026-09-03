import { create } from 'zustand';
import { Ionicons } from '@expo/vector-icons';
import type { MfConfirmDialogIntent, MfConfirmDialogVariant } from '../components/ui/MfConfirmDialog';

export type AppDialogRequest = {
  mode: 'confirm' | 'alert';
  title: string;
  message: string;
  detail?: string;
  highlight?: string;
  highlightCaption?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmIntent?: MfConfirmDialogIntent;
  variant?: MfConfirmDialogVariant;
  iconName?: keyof typeof Ionicons.glyphMap;
};

type Presentable = AppDialogRequest & { id: number };

interface AppDialogStore {
  ready: boolean;
  current: Presentable | null;
  setReady: (ready: boolean) => void;
  present: (req: AppDialogRequest) => Promise<boolean>;
  resolve: (ok: boolean) => void;
}

let seq = 0;
let pendingResolve: ((ok: boolean) => void) | null = null;

export const useAppDialogStore = create<AppDialogStore>((set) => ({
  ready: false,
  current: null,
  setReady: (ready) => set({ ready }),
  present: (req) => {
    if (pendingResolve) {
      pendingResolve(false);
      pendingResolve = null;
    }
    return new Promise<boolean>((resolve) => {
      pendingResolve = resolve;
      seq += 1;
      set({ current: { ...req, id: seq } });
    });
  },
  resolve: (ok) => {
    const fn = pendingResolve;
    pendingResolve = null;
    set({ current: null });
    fn?.(ok);
  },
}));
