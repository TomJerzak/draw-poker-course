import { Card, rankLabel } from '../engine/cards';
import { CATEGORY_NAME_PL, compareHands, evaluateHand, HandCategory, HandValue } from '../engine/handEvaluator';

/** Indeksy kart tworzących układ (to, co uczeń ma zaznaczyć w ćwiczeniu). */
export function coreCards(hand: Card[]): number[] {
  const v = evaluateHand(hand);
  if ([HandCategory.Straight, HandCategory.Flush, HandCategory.StraightFlush, HandCategory.FullHouse].includes(v.category)) {
    return [0, 1, 2, 3, 4];
  }
  if (v.category === HandCategory.HighCard) {
    const top = Math.max(...hand.map((c) => c.rank));
    return [hand.findIndex((c) => c.rank === top)];
  }
  return hand.map((c, i) => (hand.filter((d) => d.rank === c.rank).length >= 2 ? i : -1)).filter((i) => i >= 0);
}

export function coreHint(category: HandCategory): string {
  switch (category) {
    case HandCategory.HighCard: return 'Zaznacz najwyższą kartę.';
    case HandCategory.OnePair: return 'Zaznacz dwie karty tworzące parę.';
    case HandCategory.TwoPair: return 'Zaznacz cztery karty tworzące obie pary.';
    case HandCategory.ThreeOfAKind: return 'Zaznacz trzy karty tworzące trójkę.';
    case HandCategory.FourOfAKind: return 'Zaznacz cztery karty tworzące karetę.';
    default: return 'Ten układ tworzą wszystkie karty – zaznacz całą piątkę.';
  }
}

const REQUIRES: Record<HandCategory, string> = {
  [HandCategory.HighCard]: '',
  [HandCategory.OnePair]: 'dwóch kart tej samej wartości',
  [HandCategory.TwoPair]: 'dwóch różnych par',
  [HandCategory.ThreeOfAKind]: 'trzech kart tej samej wartości',
  [HandCategory.Straight]: 'pięciu kolejnych wartości',
  [HandCategory.Flush]: 'pięciu kart w jednym kolorze',
  [HandCategory.FullHouse]: 'trójki i pary jednocześnie',
  [HandCategory.FourOfAKind]: 'czterech kart tej samej wartości',
  [HandCategory.StraightFlush]: 'pięciu kolejnych wartości w jednym kolorze',
};

/** Które słabsze układy „mieszczą się” w danym układzie (np. w fullu jest trójka i para). */
const CONTAINS: Partial<Record<HandCategory, HandCategory[]>> = {
  [HandCategory.TwoPair]: [HandCategory.OnePair],
  [HandCategory.ThreeOfAKind]: [HandCategory.OnePair],
  [HandCategory.FullHouse]: [HandCategory.OnePair, HandCategory.TwoPair, HandCategory.ThreeOfAKind],
  [HandCategory.FourOfAKind]: [HandCategory.OnePair, HandCategory.TwoPair, HandCategory.ThreeOfAKind],
  [HandCategory.StraightFlush]: [HandCategory.Straight, HandCategory.Flush],
};

/** Podpowiedź po złym nazwaniu układu w ćwiczeniu – mówi, dlaczego wybór nie pasuje, nie zdradzając odpowiedzi. */
export function wrongNameHint(picked: HandCategory, actual: HandCategory): string {
  const name = CATEGORY_NAME_PL[picked].toLowerCase();
  if (picked === HandCategory.HighCard) {
    return 'Karty tworzą układ – „wysoka karta” liczy się tylko wtedy, gdy nie ma żadnego układu.';
  }
  if ((CONTAINS[actual] ?? []).includes(picked)) {
    return 'Ten układ rzeczywiście tu jest, ale karty tworzą coś silniejszego. Zawsze wybieramy najwyższy układ, jaki da się z nich ułożyć.';
  }
  const isNot = picked === HandCategory.TwoPair ? 'To nie są' : 'To nie jest';
  return `${isNot} ${name} – do tego układu potrzeba ${REQUIRES[picked]}. Tutaj tego nie ma.`;
}

function tiebreakLabel(category: HandCategory, i: number): string {
  switch (category) {
    case HandCategory.OnePair: return i === 0 ? 'wartość pary' : 'kicker (najwyższa karta poza parą)';
    case HandCategory.TwoPair: return ['wyższa para', 'niższa para', 'kicker (piąta karta)'][i];
    case HandCategory.ThreeOfAKind: return i === 0 ? 'wartość trójki' : 'kicker';
    case HandCategory.FullHouse: return i === 0 ? 'wartość trójki' : 'wartość pary';
    case HandCategory.FourOfAKind: return i === 0 ? 'wartość karety' : 'kicker';
    case HandCategory.Straight:
    case HandCategory.StraightFlush: return 'najwyższa karta strita';
    default: return i === 0 ? 'najwyższa karta' : `${['druga', 'trzecia', 'czwarta', 'piąta'][i - 1]} karta od góry`;
  }
}

/** Dlaczego `win` jest lepszy od `lose` (albo dlaczego jest remis). */
export function explainComparison(winName: string, win: HandValue, loseName: string, lose: HandValue): string {
  const cmp = compareHands(win, lose);
  if (cmp === 0) {
    const verb = winName === 'Ty' || loseName === 'Ty' ? 'macie' : 'mają';
    return `${winName} i ${loseName} ${verb} identyczne układy (${win.name}). Kolory się nie liczą, więc jest remis i pula jest dzielona.`;
  }
  if (win.category !== lose.category) {
    return `${winName}: ${win.name}, ${loseName}: ${lose.name}. Układ „${CATEGORY_NAME_PL[win.category].toLowerCase()}” jest wyżej w rankingu niż „${CATEGORY_NAME_PL[lose.category].toLowerCase()}”.`;
  }
  const i = win.tiebreakers.findIndex((r, k) => r !== lose.tiebreakers[k]);
  return `${winName}: ${win.name}, ${loseName}: ${lose.name} – ten sam układ. Decyduje ${tiebreakLabel(win.category, i)}: ${rankLabel(win.tiebreakers[i])} (${winName}) bije ${rankLabel(lose.tiebreakers[i])} (${loseName}).`;
}
