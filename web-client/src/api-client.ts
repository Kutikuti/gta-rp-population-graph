export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

const env = import.meta.env as { readonly VITE_API_BASE_URL?: string };
const API_BASE_URL = env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";

export const buildApiUrl = (path: string) => `${API_BASE_URL}${path}`;

export const buildApiError = async (response: Response) => {
  let message = `Erreur API ${String(response.status)}`;
  let code: string | null = null;

  try {
    const body = (await response.json()) as {
      error?: {
        code?: string;
        message?: string;
      };
    };

    if (body.error?.message) {
      message = body.error.message;
    }

    if (body.error?.code) {
      code = body.error.code;
    }
  } catch {
    // Ignore invalid or empty error bodies and keep the fallback message.
  }

  return new ApiRequestError(message, response.status, code);
};

export const resolveApiAssetUrl = (path: string | null) => {
  if (!path) {
    return null;
  }

  if (/^https?:\/\//u.test(path)) {
    return path;
  }

  return buildApiUrl(path);
};

export const fetchJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(buildApiUrl(path), {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers
    }
  });

  if (!response.ok) {
    throw await buildApiError(response);
  }

  return (await response.json()) as T;
};

export const fetchFreshJson = async <T>(path: string, init?: RequestInit): Promise<T> =>
  fetchJson<T>(path, {
    ...init,
    cache: "no-store"
  });

export const sendJson = async <T>(
  path: string,
  method: "POST" | "PATCH",
  body?: unknown
): Promise<T> =>
  fetchJson<T>(path, {
    method,
    ...(body ? { body: JSON.stringify(body) } : {})
  });

export const deleteJson = async <T>(path: string): Promise<T | null> => {
  const response = await fetch(buildApiUrl(path), {
    method: "DELETE",
    credentials: "include"
  });

  if (!response.ok) {
    throw await buildApiError(response);
  }

  if (response.status === 204) {
    return null;
  }

  return (await response.json()) as T;
};
