const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type ApiErrorCode =
  | "ROOM_NOT_FOUND"
  | "QUIZ_NOT_FOUND"
  | "PARTICIPANT_NOT_FOUND"
  | "QUESTION_NOT_FOUND"
  | "EMAIL_IN_USE"
  | "DISPLAY_NAME_IN_USE"
  | "DUPLICATE_ENTRY"
  | "ALREADY_VOTED"
  | "INVALID_ROOM_PHASE"
  | "INVALID_ACTIVITY_ACTION"
  | "WORD_CLOUD_PROMPT_REQUIRED"
  | "WORD_CLOUD_PROMPT_ALREADY_CONFIGURED"
  | "WORD_ALREADY_SUBMITTED"
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
export const apiErrorCode = (error: unknown): ApiErrorCode =>
  error instanceof ApiError ? error.code : "REQUEST_FAILED";
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
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  if (token && !headers.has("Authorization"))
    headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
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
