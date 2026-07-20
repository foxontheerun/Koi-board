// A throwaway, human-friendly identity for presence: a generated "adjective +
// animal" name, editable by the user and persisted in localStorage. This is the
// auth-light first step toward real accounts (see docs/AUTH_PLAN.md) — no
// password, just a label that rides along with the cursor.

const STORAGE_KEY = "koi:displayName";

const ADJECTIVES = [
  "Быстрый",
  "Тихий",
  "Смелый",
  "Хитрый",
  "Ясный",
  "Дерзкий",
  "Лёгкий",
  "Тёплый",
  "Острый",
  "Юркий",
];

const ANIMALS = [
  "Лис",
  "Кит",
  "Ёж",
  "Барс",
  "Сокол",
  "Бобр",
  "Филин",
  "Выдра",
  "Волк",
  "Скат",
];

function pick(list: readonly string[]): string {
  return list[Math.floor(Math.random() * list.length)];
}

export function generateDisplayName(): string {
  return `${pick(ADJECTIVES)} ${pick(ANIMALS)}`;
}

// Returns the saved name, or generates and persists a fresh one on first visit.
export function loadOrCreateDisplayName(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved.trim()) return saved;
  } catch {
    // localStorage unavailable (private mode, etc.) — fall back to a session name.
    return generateDisplayName();
  }

  const fresh = generateDisplayName();
  saveDisplayName(fresh);
  return fresh;
}

export function saveDisplayName(name: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch {
    // Ignore — the name still lives in memory for this session.
  }
}
