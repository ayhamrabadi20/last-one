export class ClientApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ClientApiError";
  }
}

export async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  const data = await response.json().catch(() => null) as
    | { error?: { code?: string; messageAr?: string } }
    | T
    | null;

  if (!response.ok) {
    const error = data && typeof data === "object" && "error" in data ? data.error : undefined;
    throw new ClientApiError(
      error?.messageAr ?? `تعذر إكمال الطلب (HTTP ${response.status}).`,
      response.status,
      error?.code,
    );
  }
  if (data === null) throw new ClientApiError("أعاد الخادم استجابة غير صالحة.", response.status);
  return data as T;
}
