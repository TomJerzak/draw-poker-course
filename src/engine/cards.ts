export type Suit = 'S' | 'H' | 'D' | 'C';
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface Card {
  rank: Rank;
  suit: Suit;
}

export const SUITS: Suit[] = ['S', 'H', 'D', 'C'];
export const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export const SUIT_SYMBOL: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
export const SUIT_NAME_PL: Record<Suit, string> = { S: 'pik', H: 'kier', D: 'karo', C: 'trefl' };

const RANK_CHARS: Record<string, Rank> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  T: 10, J: 11, Q: 12, K: 13, A: 14,
};

export function rankLabel(rank: Rank): string {
  switch (rank) {
    case 10: return '10';
    case 11: return 'J';
    case 12: return 'Q';
    case 13: return 'K';
    case 14: return 'A';
    default: return String(rank);
  }
}

const RANK_NAME_PL: Record<Rank, string> = {
  2: 'dwójka', 3: 'trójka', 4: 'czwórka', 5: 'piątka', 6: 'szóstka', 7: 'siódemka',
  8: 'ósemka', 9: 'dziewiątka', 10: 'dziesiątka', 11: 'walet', 12: 'dama', 13: 'król', 14: 'as',
};

export function rankNamePl(rank: Rank): string {
  return RANK_NAME_PL[rank];
}

const RANK_GENITIVE_PL: Record<Rank, string> = {
  2: 'dwójki', 3: 'trójki', 4: 'czwórki', 5: 'piątki', 6: 'szóstki', 7: 'siódemki',
  8: 'ósemki', 9: 'dziewiątki', 10: 'dziesiątki', 11: 'waleta', 12: 'damy', 13: 'króla', 14: 'asa',
};

/** Odmiana rzeczownika po liczbie: plural(1, 'karta', 'karty', 'kart') → „1 karta”, 2 → „2 karty”, 5 → „5 kart”. */
export function pluralPl(n: number, one: string, few: string, many: string): string {
  if (n === 1) return `${n} ${one}`;
  const d = n % 10;
  const t = n % 100;
  return `${n} ${d >= 2 && d <= 4 && (t < 12 || t > 14) ? few : many}`;
}

const RANK_PLURAL_NOM_PL: Record<Rank, string> = {
  2: 'dwójki', 3: 'trójki', 4: 'czwórki', 5: 'piątki', 6: 'szóstki', 7: 'siódemki',
  8: 'ósemki', 9: 'dziewiątki', 10: 'dziesiątki', 11: 'walety', 12: 'damy', 13: 'króle', 14: 'asy',
};

/** Mianownik liczby mnogiej z liczebnikiem: „trzy asy”, „dwie damy”, „dwa walety”. */
export function rankCountPl(count: 2 | 3, rank: Rank): string {
  const masculine = rank >= 11 && rank !== 12; // walet, król, as
  const num = count === 3 ? 'trzy' : masculine ? 'dwa' : 'dwie';
  return `${num} ${RANK_PLURAL_NOM_PL[rank]}`;
}

/** Dopełniacz – np. „Strit do siódemki”, „Kolor do asa”. */
export function rankGenitivePl(rank: Rank): string {
  return RANK_GENITIVE_PL[rank];
}

/** Parse a card code such as "AS", "TH", "10D", "7c". */
export function parseCard(code: string): Card {
  const c = code.trim().toUpperCase().replace(/^10/, 'T');
  if (c.length !== 2) throw new Error(`Nieprawidłowy kod karty: ${code}`);
  const rank = RANK_CHARS[c[0]];
  const suit = c[1] as Suit;
  if (!rank || !SUITS.includes(suit)) throw new Error(`Nieprawidłowy kod karty: ${code}`);
  return { rank, suit };
}

export function parseCards(codes: string): Card[] {
  return codes.trim().split(/\s+/).filter(Boolean).map(parseCard);
}

export function cardCode(card: Card): string {
  const r = card.rank === 10 ? 'T' : rankLabel(card.rank);
  return r + card.suit;
}

export function cardLabel(card: Card): string {
  return rankLabel(card.rank) + SUIT_SYMBOL[card.suit];
}

export function sameCard(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ rank, suit });
  return deck;
}

/** Deterministic PRNG (mulberry32). */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Build a deck whose top cards come in the given order (the rest is shuffled).
 * Used by lessons to stage specific situations. Cards are dealt from index 0.
 */
export function scriptedDeck(topCodes: string, rng: () => number): Card[] {
  const top = parseCards(topCodes);
  for (let i = 0; i < top.length; i++) {
    for (let j = i + 1; j < top.length; j++) {
      if (sameCard(top[i], top[j])) throw new Error(`Powtórzona karta w scenariuszu: ${cardCode(top[i])}`);
    }
  }
  const rest = createDeck().filter((c) => !top.some((t) => sameCard(t, c)));
  return [...top, ...shuffle(rest, rng)];
}
