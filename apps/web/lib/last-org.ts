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

/** Forgets the saved organization, but only if it is the one given. */
export function clearLastOrgId(id: string): void {
  try {
    if (localStorage.getItem(KEY) === id) localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}
