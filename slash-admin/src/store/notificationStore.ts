import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import apiClient from "@/api/apiClient";

export interface NotificationCounts {
  error_logs: number;
  workflow_actions: number;
  communications: number;
  error_logs_total: number;
  job_failures: number;
  comments: number;
  unread_notifications: number;
}

type NotificationStore = {
  counts: NotificationCounts;
  lastFetched: number | null;
  actions: {
    fetchCounts: () => Promise<void>;
    getCount: (key: keyof NotificationCounts) => number;
  };
};

const REFRESH_INTERVAL = 60_000; // 1 minute

export const useNotificationStore = create<NotificationStore>()(
  persist(
    (set, get) => ({
      counts: {
        error_logs: 0,
        workflow_actions: 0,
        communications: 0,
        error_logs_total: 0,
        job_failures: 0,
        comments: 0,
        unread_notifications: 0,
      },
      lastFetched: null,
      actions: {
        fetchCounts: async () => {
          try {
            const now = Date.now();
            const lastFetched = get().lastFetched;
            if (lastFetched && now - lastFetched < REFRESH_INTERVAL) return;

            const data = await apiClient.get<NotificationCounts>({
              url: "/roles/notification-counts/",
            });
            set({ counts: data, lastFetched: now });
          } catch {
            // Silently fail — badges are non-critical
          }
        },
        getCount: (key) => get().counts[key],
      },
    }),
    {
      name: "notificationStore",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        counts: state.counts,
        lastFetched: state.lastFetched,
      }),
    },
  ),
);

export const useNotificationCounts = () =>
  useNotificationStore((state) => state.counts);
