const KEY = "errwise:last-org";

export function getLastOrgId(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null; // storage unavailable
  }
}

export function setLastOrgId(id: string): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* storage unavailable */
  }
}
