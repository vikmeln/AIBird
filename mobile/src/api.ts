import { File } from "expo-file-system";
import { fetch as expoFetch } from "expo/fetch";
import { API_BASE_URL } from "./config";
import type {
  LoginResponse,
  Attempts,
  BirdAnalysis,
  AnalyzeResponse,
} from "./types";

type ApiError = {
  message?: string;
  title?: string;
  errors?: Record<string, string[]>;
};

async function readResponse(response: Response): Promise<unknown> {
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
    if (response.status === 401) {
      throw new Error("Сессия закончилась. Выйди и войди снова.");
    }

    if (response.status === 402) {
      throw new Error(
        "Попытки закончились. Приобретите дополнительные попытки в веб-версии AI Bird.",
      );
    }
    const error = data && typeof data === "object" ? (data as ApiError) : null;
    const validationErrors = error?.errors
      ? Object.values(error.errors).flat().join(" ")
      : "";
    throw new Error(
      validationErrors ||
        error?.message ||
        error?.title ||
        `Ошибка сервера: ${response.status}`,
    );
  }
  return data;
}

async function post(path: string, body: object): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("Auth API network error:", err);
    throw new Error(
      "Нет соединения с сервером. Проверь IP компьютера, Wi-Fi и Docker.",
    );
  }
  return readResponse(response);
}

export const authApi = {
  register: async (email: string, password: string): Promise<void> => {
    await post("/auth/register", {
      email,
      password,
    });
  },

  login: async (email: string, password: string): Promise<LoginResponse> => {
    const data = (await post("/auth/login", {
      email,
      password,
    })) as Partial<LoginResponse> | null;
    if (!data?.token || !data?.role) {
      throw new Error("Сервер не вернул токен или роль.");
    }
    return {
      token: data.token,
      role: data.role,
    };
  },
};

async function birdRequest(path: string, token: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (err) {
    console.error("Bird API network error:", err);
    throw new Error(
      err instanceof Error
        ? `Ошибка запроса: ${err.message}`
        : "Не удалось подключиться к серверу.",
    );
  }
  return readResponse(response);
}

export const birdsApi = {
  attempts: async (token: string): Promise<Attempts> => {
    return (await birdRequest("/birds/attempts", token)) as Attempts;
  },

  history: async (token: string): Promise<BirdAnalysis[]> => {
    const data = await birdRequest("/birds", token);
    if (Array.isArray(data)) {
      return data as BirdAnalysis[];
    }
    if (data && typeof data === "object") {
      const result = data as {
        items?: BirdAnalysis[];
        analyses?: BirdAnalysis[];
      };
      return result.items ?? result.analyses ?? [];
    }
    return [];
  },

  analyze: async (
    token: string,
    imageUri: string,
  ): Promise<AnalyzeResponse> => {
    const file = new File(imageUri);
    if (!file.exists) {
      throw new Error("Фотография не найдена на телефоне.");
    }
    const form = new FormData();
    form.append("file", file, "bird.jpg");
    let response: Response;
    try {
      response = await expoFetch(`${API_BASE_URL}/birds/analyze`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: form,
      });
    } catch (err) {
      console.error("Bird upload error:", err);
      throw new Error(
        err instanceof Error
          ? `Ошибка отправки фотографии: ${err.message}`
          : "Не удалось отправить фотографию.",
      );
    }
    return (await readResponse(response)) as AnalyzeResponse;
  },
};

async function adminRequest(path: string, token: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (err) {
    throw new Error(
      err instanceof Error
        ? `Ошибка соединения: ${err.message}`
        : "Нет связи с Central Server.",
    );
  }
  if (response.status === 401) {
    throw new Error("Сессия закончилась. Выйди и войди снова.");
  }
  if (response.status === 403) {
    throw new Error("Нет доступа. Требуется роль Admin.");
  }
  if (!response.ok) {
    throw new Error(`Ошибка сервера: ${response.status}`);
  }
  return response.json();
}

export const adminApi = {
  users: async (token: string): Promise<unknown> =>
    adminRequest("/admin/users", token),
  analyses: async (token: string): Promise<unknown> =>
    adminRequest("/admin/analyses", token),
  payments: async (token: string): Promise<unknown> =>
    adminRequest("/admin/payments", token),
};
