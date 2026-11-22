import { parseCards } from '../engine/cards';
import { evaluateHand, HandCategory } from '../engine/handEvaluator';
import { coreCards, explainComparison, wrongNameHint } from './explain';
import { GLOSSARY, splitTerms } from './glossary';

describe('coreCards', () => {
  it.each([
    ['KS KD 7H 4C 2S', [0, 1]],
    ['AS QD 9H 6C 3S', [0]],
    ['3S 9D AH 6C 2S', [2]],
    ['9S 9H 5D 5C AS', [0, 1, 2, 3]],
    ['JS 8C JH 3S JD', [0, 2, 4]],
    ['5S 5H 5D 5C 9H', [0, 1, 2, 3]],
    ['6S 6H 6D KC KS', [0, 1, 2, 3, 4]],
    ['3S 4D 5H 6C 7S', [0, 1, 2, 3, 4]],
  ])('%s → %j', (hand, idx) => {
    expect(coreCards(parseCards(hand))).toEqual(idx);
  });
});

describe('explainComparison', () => {
  const v = (s: string) => evaluateHand(parseCards(s));
  it('różne kategorie', () => {
    expect(explainComparison('Ania', v('6S 6H 3D 3C KS'), 'Ty', v('JS JC 9H 4D 2C'))).toContain('Układ „dwie pary” jest wyżej w rankingu niż „para”.');
  });
  it('kicker', () => {
    const t = explainComparison('Ty', v('TS TH AD 6C 4S'), 'Ania', v('TD TC KH 9S 7D'));
    expect(t).toContain('kicker');
    expect(t).toContain('A (Ty) bije K (Ania)');
  });
  it('remis', () => {
    expect(explainComparison('Ty', v('5S 5H 9D 7C 3S'), 'Ania', v('5D 5C 9H 7S 3D'))).toContain('remis');
  });
});

describe('wrongNameHint', () => {
  it('słabszy układ, który mieści się w prawdziwym – wskazówka o najwyższym układzie', () => {
    expect(wrongNameHint(HandCategory.ThreeOfAKind, HandCategory.FullHouse)).toContain('Zawsze wybieramy najwyższy układ');
    expect(wrongNameHint(HandCategory.Flush, HandCategory.StraightFlush)).toContain('Zawsze wybieramy najwyższy układ');
    expect(wrongNameHint(HandCategory.HighCard, HandCategory.Straight)).toContain('„wysoka karta” liczy się tylko wtedy, gdy nie ma żadnego układu');
  });
  it('układ, którego nie ma – mówi, czego wymaga', () => {
    expect(wrongNameHint(HandCategory.Flush, HandCategory.FullHouse)).toBe(
      'To nie jest kolor – do tego układu potrzeba pięciu kart w jednym kolorze. Tutaj tego nie ma.',
    );
    expect(wrongNameHint(HandCategory.ThreeOfAKind, HandCategory.OnePair)).toContain('potrzeba trzech kart tej samej wartości');
    expect(wrongNameHint(HandCategory.TwoPair, HandCategory.OnePair)).toMatch(/^To nie są dwie pary/);
  });
});

describe('słowniczek', () => {
  it('każde hasło ma pełną definicję zakończoną kropką i nie powtarza się', () => {
    const terms = GLOSSARY.map((g) => g.term);
    expect(new Set(terms).size).toBe(terms.length);
    for (const g of GLOSSARY) expect(g.definition).toMatch(/^[A-ZĄĆĘŁŃÓŚŹŻ].*\.$/);
  });
});

describe('splitTerms', () => {
  it('oznacza pierwsze wystąpienie pojęcia, także w odmianie', () => {
    const parts = splitTerms('Wpłać ante do puli. Pula rośnie, ante znowu.');
    const terms = parts.filter((p) => typeof p !== 'string').map((p) => (p as { text: string }).text);
    expect(terms).toEqual(['ante', 'puli']);
    expect(parts.map((p) => (typeof p === 'string' ? p : p.text)).join('')).toBe('Wpłać ante do puli. Pula rośnie, ante znowu.');
  });
  it('nie oznacza fragmentów innych słów', () => {
    expect(splitTerms('Betonowy stół').every((p) => typeof p === 'string')).toBe(true);
  });
});

describe('explainComparison – kolejne karty słownie', () => {
  it('nazywa trzecią kartę słowem', () => {
    const v = (s: string) => evaluateHand(parseCards(s));
    expect(explainComparison('Ania', v('KC JD 9H 4S 2C'), 'Ty', v('KD JH 8S 6C 3H'))).toContain(
      'Decyduje trzecia karta od góry: 9 (Ania) bije 8 (Ty).',
    );
  });
});
