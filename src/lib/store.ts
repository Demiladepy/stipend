// Local index of stipends this browser created. The chain is the source of
// truth (StipendCreated logs recover this), localStorage is just the fast path.

export type StoredStipend = {
  id: `0x${string}`;
  salt: `0x${string}`;
  recipient: `0x${string}`;
  createdAt: number;
  fundingTxId?: string;
};

const KEY = 'stipend.created';

export function loadStipends(): StoredStipend[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveStipend(s: StoredStipend) {
  const all = loadStipends().filter((x) => x.id !== s.id);
  all.unshift(s);
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function removeStipend(id: string) {
  localStorage.setItem(
    KEY,
    JSON.stringify(loadStipends().filter((x) => x.id !== id)),
  );
}
