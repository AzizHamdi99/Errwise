import { ApiError, getErrorMessage } from "@/lib/api";

export function invitationErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 503) {
    return "We couldn't send the email. Please try again in a moment.";
  }
  return getErrorMessage(error);
}
