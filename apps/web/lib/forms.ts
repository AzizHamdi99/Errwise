import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { ApiError } from "./api";

/** Returns true if the error was mapped to form fields. */
export function applyFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
): boolean {
  if (!(error instanceof ApiError) || error.fieldErrors.length === 0) {
    return false;
  }
  for (const { path, message } of error.fieldErrors) {
    setError(path as Path<T>, { message });
  }
  return true;
}
