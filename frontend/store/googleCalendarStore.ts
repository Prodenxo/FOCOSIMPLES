import { create } from 'zustand';

/** Incrementar após conectar/desconectar Google Calendar para telas recarregarem status. */
interface GoogleCalendarStore {
  connectionVersion: number;
  notifyConnectionChanged: () => void;
}

export const useGoogleCalendarStore = create<GoogleCalendarStore>((set) => ({
  connectionVersion: 0,
  notifyConnectionChanged: () =>
    set((state) => ({ connectionVersion: state.connectionVersion + 1 })),
}));
