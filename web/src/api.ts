import type {
  Attempts,
  BirdAnalysis,
  LoginResponse,
  AdminUser,
  Payment,
  PaymentInfo,
} from "./types";

const BASE_URL = "/api";

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(BASE_URL + path, {
    ...options,
    headers,
  });
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!response.ok) {
    let message = `Ошибка сервера: ${response.status}`;
    if (typeof data === "string" && data.trim()) {
      message = data;
    } else if (data && typeof data === "object") {
      const error = data as {
        message?: string;
        title?: string;
        errors?: Record<string, string[]>;
      };
      message = error.message || error.title || message;
      if (error.errors) {
        message = Object.values(error.errors).flat().join(", ");
      }
    }
    throw new Error(message);
  }
  return data as T;
}

export const authApi = {
  register(email: string, password: string) {
    return request<unknown>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  login(email: string, password: string) {
    return request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },
};

export const birdsApi = {
  analyze(file: File, token: string) {
    const form = new FormData();
    form.append("file", file);
    return request<unknown>(
      "/birds/analyze",
      {
        method: "POST",
        body: form,
      },
      token,
    );
  },

  async history(token: string): Promise<BirdAnalysis[]> {
    const data = await request<
      | BirdAnalysis[]
      | {
          items?: BirdAnalysis[];
          analyses?: BirdAnalysis[];
        }
    >("/birds", {}, token);
    if (Array.isArray(data)) {
      return data;
    }
    return data?.items ?? data?.analyses ?? [];
  },
  attempts(token: string) {
    return request<Attempts>("/birds/attempts", {}, token);
  },
};

export const adminApi = {
  users(token: string) {
    return request<AdminUser[]>("/admin/users", {}, token);
  },
  analyses(token: string) {
    return request<BirdAnalysis[]>("/admin/analyses", {}, token);
  },
  payments(token: string) {
    return request<Payment[]>("/admin/payments", {}, token);
  },
};

export const paymentsApi = {
  info(token: string) {
    return request<PaymentInfo>("/payments/info", {}, token);
  },
  confirm(transactionHash: string, token: string) {
    return request<{ message: string; attemptsAdded: number }>(
      "/payments/confirm",
      {
        method: "POST",
        body: JSON.stringify({ transactionHash }),
      },
      token,
    );
  },
};
