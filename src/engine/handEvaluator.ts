import { Card, Rank, rankCountPl, rankGenitivePl, rankNamePl } from './cards';

export enum HandCategory {
  HighCard = 0,
  OnePair = 1,
  TwoPair = 2,
  ThreeOfAKind = 3,
  Straight = 4,
  Flush = 5,
  FullHouse = 6,
  FourOfAKind = 7,
  StraightFlush = 8,
}

export const CATEGORY_NAME_PL: Record<HandCategory, string> = {
  [HandCategory.HighCard]: 'Wysoka karta',
  [HandCategory.OnePair]: 'Para',
  [HandCategory.TwoPair]: 'Dwie pary',
  [HandCategory.ThreeOfAKind]: 'Trójka',
  [HandCategory.Straight]: 'Strit',
  [HandCategory.Flush]: 'Kolor',
  [HandCategory.FullHouse]: 'Full',
  [HandCategory.FourOfAKind]: 'Kareta',
  [HandCategory.StraightFlush]: 'Poker',
};

export interface HandValue {
  category: HandCategory;
  /** Ranks compared lexicographically after the category (most significant first). */
  tiebreakers: Rank[];
  /** Polish description, e.g. "Para dam" or "Poker królewski". */
  name: string;
}

function plural(rank: Rank): string {
  const map: Record<Rank, string> = {
    2: 'dwójek', 3: 'trójek', 4: 'czwórek', 5: 'piątek', 6: 'szóstek', 7: 'siódemek',
    8: 'ósemek', 9: 'dziewiątek', 10: 'dziesiątek', 11: 'waletów', 12: 'dam', 13: 'króli', 14: 'asów',
  };
  return map[rank];
}

export function evaluateHand(cards: Card[]): HandValue {
  if (cards.length !== 5) throw new Error('Ocena wymaga dokładnie 5 kart');

  const counts = new Map<Rank, number>();
  for (const c of cards) counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1);
  // groups sorted by count desc, then rank desc
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const byGroup = groups.map(([r]) => r);

  const isFlush = cards.every((c) => c.suit === cards[0].suit);
  const distinct = [...counts.keys()].sort((a, b) => b - a);
  let straightHigh: Rank | null = null;
  if (distinct.length === 5) {
    if (distinct[0] - distinct[4] === 4) straightHigh = distinct[0];
    else if (distinct.join() === '14,5,4,3,2') straightHigh = 5; // "koło" A-2-3-4-5
  }

  if (straightHigh && isFlush) {
    return {
      category: HandCategory.StraightFlush,
      tiebreakers: [straightHigh],
      name: straightHigh === 14 ? 'Poker królewski' : `Poker do ${rankGenitivePl(straightHigh)}`,
    };
  }
  if (groups[0][1] === 4) {
    return { category: HandCategory.FourOfAKind, tiebreakers: byGroup, name: `Kareta ${plural(byGroup[0])}` };
  }
  if (groups[0][1] === 3 && groups[1][1] === 2) {
    return {
      category: HandCategory.FullHouse,
      tiebreakers: byGroup,
      name: `Full: ${rankCountPl(3, byGroup[0])} i ${rankCountPl(2, byGroup[1])}`,
    };
  }
  if (isFlush) {
    return { category: HandCategory.Flush, tiebreakers: distinct, name: `Kolor do ${rankGenitivePl(distinct[0])}` };
  }
  if (straightHigh) {
    return { category: HandCategory.Straight, tiebreakers: [straightHigh], name: `Strit do ${rankGenitivePl(straightHigh)}` };
  }
  if (groups[0][1] === 3) {
    return { category: HandCategory.ThreeOfAKind, tiebreakers: byGroup, name: `Trójka ${plural(byGroup[0])}` };
  }
  if (groups[0][1] === 2 && groups[1][1] === 2) {
    return {
      category: HandCategory.TwoPair,
      tiebreakers: byGroup,
      name: `Dwie pary: ${plural(byGroup[0])} i ${plural(byGroup[1])}`,
    };
  }
  if (groups[0][1] === 2) {
    return { category: HandCategory.OnePair, tiebreakers: byGroup, name: `Para ${plural(byGroup[0])}` };
  }
  return { category: HandCategory.HighCard, tiebreakers: distinct, name: `Wysoka karta (${rankNamePl(distinct[0])})` };
}

/** >0 if a wins, <0 if b wins, 0 for a tie. */
export function compareHands(a: HandValue, b: HandValue): number {
  if (a.category !== b.category) return a.category - b.category;
  for (let i = 0; i < Math.max(a.tiebreakers.length, b.tiebreakers.length); i++) {
    const d = (a.tiebreakers[i] ?? 0) - (b.tiebreakers[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}
