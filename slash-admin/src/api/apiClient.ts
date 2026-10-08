import { GLOBAL_CONFIG } from "@/global-config";
import { t } from "@/locales/i18n";
import userStore from "@/store/userStore";
import axios, { type AxiosRequestConfig, type AxiosError, type AxiosResponse } from "axios";
import { toast } from "sonner";
import type { Result } from "#/api";
import { ResultStatus } from "#/enum";

const axiosInstance = axios.create({
  baseURL: GLOBAL_CONFIG.apiBaseUrl,
  timeout: 50000,
  headers: { "Content-Type": "application/json;charset=utf-8" },
});

// Flag to prevent infinite refresh loops
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any | null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(undefined);
    }
  });
  failedQueue = [];
};

axiosInstance.interceptors.request.use(
  (config) => {
    const token = userStore.getState().userToken.accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

axiosInstance.interceptors.response.use(
  (res: AxiosResponse<Result<any>>) => {
    // A DELETE that succeeds answers 204 with no body at all. There is nothing
    // to unwrap there, and an absent body is not a failure — without this every
    // successful delete rejected and callers saw their row stay on screen.
    if (res.status === 204 || (res.data as any) === "" || res.data == null) {
      return null as any;
    }

    if (!res.data) throw new Error(t("sys.api.apiRequestFailed"));

    // Django REST Framework returns data directly (not wrapped in Result)
    const data = res.data as any;

    // If it's a DRF paginated response (has count/results)
    if (data.count !== undefined && data.results !== undefined) {
      return data as any;
    }

    // If it's a wrapped Result response
    const { status } = data;
    if (status === ResultStatus.SUCCESS) {
      return data.data;
    }

    // If no status field, it's raw DRF data
    return data;
  },
  async (error: AxiosError<Result>) => {
    const { config, response } = error;

    // Handle 401 - try token refresh
    if (response?.status === 401 && config && !config.url?.includes("/auth/login/")) {
      const refreshToken = userStore.getState().userToken.refreshToken;

      if (!refreshToken) {
        userStore.getState().actions.clearUserInfoAndToken();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => axiosInstance(config));
      }

      isRefreshing = true;

      try {
        // Attempt to refresh the token
        const response = await axios.post(`${GLOBAL_CONFIG.apiBaseUrl}/auth/refresh/`, {
          refreshToken,
        });

        const { accessToken } = response.data;
        userStore.getState().actions.setUserToken({
          accessToken,
          refreshToken,
        });

        processQueue(null);

        // Retry original request
        if (config) {
          config.headers.Authorization = `Bearer ${accessToken}`;
        }
        return axiosInstance(config);
      } catch (refreshError) {
        processQueue(refreshError);
        userStore.getState().actions.clearUserInfoAndToken();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Handle other errors
    const { response: errResponse } = error || {};
    const errMessage = error.message || t("sys.api.errorMessage");

    if (errResponse?.data) {
      const errData = errResponse.data as any;
      const errMsg =
        errData.detail ||
        errData.message ||
        errData.error ||
        (typeof errData === "object" ? Object.values(errData).flat().join(", ") : "") ||
        errMessage;
      toast.error(errMsg, { position: "top-center" });
    } else {
      toast.error(errMessage, { position: "top-center" });
    }

    return Promise.reject(error);
  },
);

class APIClient {
  get<T = unknown>(config: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: "GET" });
  }
  post<T = unknown>(config: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: "POST" });
  }
  put<T = unknown>(config: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: "PUT" });
  }
  patch<T = unknown>(config: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: "PATCH" });
  }
  delete<T = unknown>(config: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: "DELETE" });
  }
  async request<T = unknown>(config: AxiosRequestConfig): Promise<T> {
    const response = await axiosInstance.request(config);
    return response as unknown as T;
  }
}

export default new APIClient();
