import { Card, Rank, rankLabel, SUIT_NAME_PL, SUIT_SYMBOL } from '../engine/cards';
import { evaluateHand, HandCategory } from '../engine/handEvaluator';

export interface DrawAdvice {
  /** Indeksy kart do wymiany. */
  discard: number[];
  /** Polskie wyjaśnienie dla trenera. */
  reason: string;
  /** Liczba kart w talii, które poprawiają rękę do celu (dla ciągów i kolorów). */
  outs?: number;
}

function rankCounts(hand: Card[]): Map<Rank, number[]> {
  const m = new Map<Rank, number[]>();
  hand.forEach((c, i) => m.set(c.rank, [...(m.get(c.rank) ?? []), i]));
  return m;
}

/** Cztery karty do koloru – indeks karty spoza koloru albo null. */
function fourFlushOdd(hand: Card[]): number | null {
  for (const suit of ['S', 'H', 'D', 'C']) {
    const off = hand.map((c, i) => (c.suit === suit ? -1 : i)).filter((i) => i >= 0);
    if (off.length === 1) return off[0];
  }
  return null;
}

/** Otwarty strit (4 kolejne karty, do uzupełnienia z obu stron) – indeks karty zbędnej albo null. */
function openEndedOdd(hand: Card[]): number | null {
  for (let skip = 0; skip < 5; skip++) {
    const ranks = hand.filter((_, i) => i !== skip).map((c) => c.rank).sort((a, b) => a - b);
    const distinct = new Set(ranks).size === 4;
    if (distinct && ranks[3] - ranks[0] === 3 && ranks[3] < 14 && ranks[0] > 2) return skip;
  }
  return null;
}

/** Czy ręka bez układu ma szansę na kolor albo strita po wymianie jednej karty. */
export function drawingTo(hand: Card[]): 'kolor' | 'strita' | null {
  if (evaluateHand(hand).category !== HandCategory.HighCard) return null;
  if (fourFlushOdd(hand) !== null) return 'kolor';
  if (openEndedOdd(hand) !== null) return 'strita';
  return null;
}

/** Standardowa strategia wymiany w pokerze dobieranym. */
export function adviseDraw(hand: Card[], maxDraw = 3): DrawAdvice {
  const v = evaluateHand(hand);
  const counts = rankCounts(hand);
  const keepRanks = (pred: (n: number) => boolean) =>
    hand.map((c, i) => (pred(counts.get(c.rank)!.length) ? -1 : i)).filter((i) => i >= 0);

  switch (v.category) {
    case HandCategory.StraightFlush:
    case HandCategory.FourOfAKind:
    case HandCategory.FullHouse:
    case HandCategory.Flush:
    case HandCategory.Straight:
      return { discard: [], reason: `${v.name} – gotowy układ, zostaw wszystkie karty („stój”).` };
    case HandCategory.ThreeOfAKind:
      return {
        discard: keepRanks((n) => n === 3),
        reason: `${v.name}: zostaw trójkę i wymień dwie pozostałe karty. Szansa na fulla albo karetę około 10% (mniej więcej 1 na 10).`,
      };
    case HandCategory.TwoPair:
      return {
        discard: keepRanks((n) => n === 2),
        reason: `${v.name}: wymień kartę spoza par. Szansa na fulla około 8,5% (mniej więcej 1 na 12).`,
        outs: 4,
      };
    case HandCategory.OnePair: {
      return {
        discard: keepRanks((n) => n === 2).slice(0, maxDraw),
        reason: `${v.name}: zostaw parę i wymień trzy pozostałe karty. Mniej więcej w co trzecim takim rozdaniu układ się poprawi (szansa około 29%).`,
      };
    }
    default: {
      const ff = fourFlushOdd(hand);
      if (ff !== null) {
        const suit = hand[ff === 0 ? 1 : 0].suit;
        return {
          discard: [ff],
          reason: `Masz cztery karty w kolorze ${SUIT_NAME_PL[suit]} (${SUIT_SYMBOL[suit]}). Wymień kartę w innym kolorze. Szansa na kolor około 19% (mniej więcej 1 na 5).`,
          outs: 9,
        };
      }
      const oe = openEndedOdd(hand);
      if (oe !== null) {
        const run = hand.filter((_, i) => i !== oe).map((c) => c.rank).sort((a, b) => a - b);
        const low = rankLabel((run[0] - 1) as Rank);
        const high = rankLabel((run[3] + 1) as Rank);
        return {
          discard: [oe],
          reason: `Masz cztery kolejne karty: ${run.map(rankLabel).join('-')}. Wymień kartę spoza ciągu. Strita da każda karta ${low} albo ${high} – szansa około 17% (mniej więcej 1 na 6).`,
          outs: 8,
        };
      }
      const order = hand.map((c, i) => ({ r: c.rank, i })).sort((a, b) => b.r - a.r);
      const keep = order.slice(0, 5 - maxDraw).map((o) => o.i);
      const kept = order.slice(0, 5 - maxDraw).map((o) => rankLabel(o.r)).join(' i ');
      return {
        discard: hand.map((_, i) => i).filter((i) => !keep.includes(i)),
        reason: `Brak układu: zostaw dwie najwyższe karty (${kept}) i wymień ${maxDraw} pozostałe (więcej nie można). Szansa na mocną rękę jest mała.`,
      };
    }
  }
}

/**
 * Siła ręki w skali 0..1 – przybliżenie szansy wygranej z jednym rywalem.
 * Przed wymianą premiuje dobre dobieranie (kolor/strit).
 */
export function handStrength(hand: Card[], beforeDraw: boolean): number {
  const v = evaluateHand(hand);
  const top = v.tiebreakers[0];
  switch (v.category) {
    case HandCategory.HighCard: {
      let base = 0.05 + (top - 7) * 0.025;
      if (beforeDraw && (fourFlushOdd(hand) !== null || openEndedOdd(hand) !== null)) base = 0.35;
      return Math.max(0.02, base);
    }
    case HandCategory.OnePair:
      return 0.35 + (top - 2) * 0.025; // para dwójek ~0.35, para asów ~0.65
    case HandCategory.TwoPair:
      return 0.72 + (top - 3) * 0.008;
    case HandCategory.ThreeOfAKind:
      return 0.85 + (top - 2) * 0.004;
    case HandCategory.Straight:
      return 0.91;
    case HandCategory.Flush:
      return 0.94;
    case HandCategory.FullHouse:
      return 0.97;
    default:
      return 0.995;
  }
}
