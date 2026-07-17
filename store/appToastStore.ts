import { create } from 'zustand';
import type { ToastNoticeVariant } from '../components/ToastNotice';

interface AppToastStore {
  visible: boolean;
  message: string;
  variant: ToastNoticeVariant;
  show: (message: string, variant?: ToastNoticeVariant) => void;
  dismiss: () => void;
}

export const useAppToastStore = create<AppToastStore>((set) => ({
  visible: false,
  message: '',
  variant: 'info',
  show: (message, variant = 'info') =>
    set({ visible: true, message: message.trim(), variant }),
  dismiss: () => set({ visible: false, message: '' }),
}));
