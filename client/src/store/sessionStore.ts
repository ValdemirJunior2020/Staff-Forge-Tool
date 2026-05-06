// client/src/store/sessionStore.ts

import { create } from "zustand";
import { persist } from "zustand/middleware";

type SessionPayload = {
  sessionId: string;
  fullName: string;
};

type SessionStore = {
  sessionId: string | null;
  fullName: string;
  setSession: (payload: SessionPayload) => void;
  clear: () => void;
};

export const useSessionStore = create<SessionStore>()(
  persist(
    (set) => ({
      sessionId: null,
      fullName: "",

      setSession: (payload) =>
        set({
          sessionId: payload.sessionId,
          fullName: payload.fullName,
        }),

      clear: () =>
        set({
          sessionId: null,
          fullName: "",
        }),
    }),
    {
      name: "staffforge-session",
    }
  )
);