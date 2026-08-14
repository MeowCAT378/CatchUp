const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type ApiErrorCode =
  | "ROOM_NOT_FOUND"
  | "QUIZ_NOT_FOUND"
  | "PARTICIPANT_NOT_FOUND"
  | "INVALID_ROOM_PHASE"
  | "ALREADY_ANSWERED"
  | "QUESTION_HAS_RESPONSES"
  | "ACTIVITY_IN_USE"
  | "DELETE_FAILED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "INTERNAL_ERROR"
  | "REQUEST_FAILED";
export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message?: string,
  ) {
    super(message ?? code);
  }
}
export type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  error?: { code?: ApiErrorCode; message: string | string[] };
};
export async function api<T>(
  path: string,
  init: RequestInit = {},
  token?: string,
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });
  const body = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok)
    throw new ApiError(
      body.error?.code ?? "REQUEST_FAILED",
      Array.isArray(body.error?.message)
        ? body.error.message.join(", ")
        : body.error?.message,
    );
  return body.data;
}
