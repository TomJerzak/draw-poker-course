const KEY = 'kurs-pokera-progress-v2';

export interface Progress {
  completed: string[];
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (Array.isArray(p.completed)) return { completed: p.completed.filter((x: unknown) => typeof x === 'string') };
    }
  } catch {
    /* brak dostępu do localStorage – postęp tylko w pamięci */
  }
  return { completed: [] };
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignorujemy */
  }
}

export function markCompleted(p: Progress, id: string): Progress {
  return p.completed.includes(id) ? p : { completed: [...p.completed, id] };
}

const NOTICE_KEY = 'kurs-pokera-notice-v1';

/** Czy użytkownik zaakceptował już komunikat startowy (cel edukacyjny, ostrzeżenie przed hazardem). */
export function loadNoticeAccepted(): boolean {
  try {
    return localStorage.getItem(NOTICE_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveNoticeAccepted(): void {
  try {
    localStorage.setItem(NOTICE_KEY, '1');
  } catch {
    /* ignorujemy – komunikat pojawi się przy następnym wejściu */
  }
}
