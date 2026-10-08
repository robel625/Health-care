import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { GLOBAL_CONFIG } from "@/global-config";
import userStore from "@/store/userStore";
import { useNotificationStore } from "@/store/notificationStore";

export interface RealtimePayload {
  event: string;
  data: any;
  user_id?: number | null;
  timestamp?: string;
}

/**
 * Hook to listen for real-time notifications via Server-Sent Events (SSE).
 * Connects to Redis-backed SSE stream on Django backend and presents
 * real-time toasts and updates notification counters.
 */
export function useRealtimeNotifications() {
  const navigate = useNavigate();
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);

  useEffect(() => {
    const token = userStore.getState().userToken?.accessToken;
    if (!token) return;

    let isMounted = true;

    const connectSSE = () => {
      if (!isMounted) return;

      const url = `${GLOBAL_CONFIG.apiBaseUrl}/healthcare/realtime/stream/?token=${encodeURIComponent(token)}`;
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.addEventListener("lab_order_created", (e) => {
        try {
          const payload = JSON.parse(e.data);
          const data = payload.data || payload;
          toast.info(`🧪 ${data.title || "New Lab Order"}`, {
            description: data.message || `Lab test prescribed for ${data.patient_name || "Patient"}`,
            action: {
              label: "View Lab Tests",
              onClick: () => navigate("/healthcare/diagnostics/lab-tests"),
            },
            duration: 8000,
          });
          useNotificationStore.getState().actions.fetchCounts();
        } catch (err) {
          console.error("Failed to parse lab_order_created event:", err);
        }
      });

      es.addEventListener("lab_result_approved", (e) => {
        try {
          const payload = JSON.parse(e.data);
          const data = payload.data || payload;
          toast.success(`✅ ${data.title || "Lab Result Approved"}`, {
            description: data.message || `Test results for ${data.patient_name || "Patient"} are approved.`,
            action: {
              label: "View Report",
              onClick: () => {
                if (data.lab_test_id) {
                  navigate(`/healthcare/diagnostics/lab-tests/${data.lab_test_id}`);
                } else {
                  navigate("/healthcare/diagnostics/lab-tests");
                }
              },
            },
            duration: 8000,
          });
          useNotificationStore.getState().actions.fetchCounts();
        } catch (err) {
          console.error("Failed to parse lab_result_approved event:", err);
        }
      });

      es.addEventListener("pending_orders_reminder", (e) => {
        try {
          const payload = JSON.parse(e.data);
          const data = payload.data || payload;
          toast.warning(`⏳ ${data.title || "Pending Orders"}`, {
            description: data.message,
            duration: 7000,
          });
          useNotificationStore.getState().actions.fetchCounts();
        } catch (err) {}
      });

      es.addEventListener("test_alert", (e) => {
        try {
          const payload = JSON.parse(e.data);
          const data = payload.data || payload;
          toast.info(`🔔 ${data.title}`, {
            description: data.message,
            duration: 5000,
          });
          useNotificationStore.getState().actions.fetchCounts();
        } catch (err) {}
      });

      es.onerror = () => {
        es.close();
        if (isMounted) {
          reconnectTimeoutRef.current = setTimeout(connectSSE, 5000);
        }
      };
    };

    connectSSE();

    return () => {
      isMounted = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [navigate]);
}
