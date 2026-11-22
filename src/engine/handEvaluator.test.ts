import { parseCards, pluralPl, scriptedDeck, createRng, createDeck, cardCode } from './cards';
import { evaluateHand, compareHands, HandCategory } from './handEvaluator';

const ev = (s: string) => evaluateHand(parseCards(s));

describe('evaluateHand – kategorie', () => {
  it.each([
    ['AS KH 9D 7C 3S', HandCategory.HighCard],
    ['QS QH 9D 7C 3S', HandCategory.OnePair],
    ['QS QH 9D 9C 3S', HandCategory.TwoPair],
    ['QS QH QD 9C 3S', HandCategory.ThreeOfAKind],
    ['9S TH JD QC KS', HandCategory.Straight],
    ['AS 2H 3D 4C 5S', HandCategory.Straight],
    ['2H 7H 9H JH KH', HandCategory.Flush],
    ['QS QH QD 9C 9S', HandCategory.FullHouse],
    ['QS QH QD QC 3S', HandCategory.FourOfAKind],
    ['5D 6D 7D 8D 9D', HandCategory.StraightFlush],
    ['TS JS QS KS AS', HandCategory.StraightFlush],
  ])('%s', (hand, cat) => {
    expect(ev(hand).category).toBe(cat);
  });

  it('nazywa poker królewski', () => {
    expect(ev('TS JS QS KS AS').name).toBe('Poker królewski');
  });

  it('odmienia wartość po „do” (dopełniacz)', () => {
    expect(ev('3S 4H 5D 6C 7S').name).toBe('Strit do siódemki');
    expect(ev('AS 2H 3D 4C 5S').name).toBe('Strit do piątki');
    expect(ev('2H 7H 9H JH AH').name).toBe('Kolor do asa');
    expect(ev('2H 7H 9H JH QH').name).toBe('Kolor do damy');
    expect(ev('7D 8D 9D TD JD').name).toBe('Poker do waleta');
  });

  it('nazywa fulla liczebnikami z właściwym rodzajem', () => {
    expect(ev('3S 3H 3D 2C 2S').name).toBe('Full: trzy trójki i dwie dwójki');
    expect(ev('AS AH AD KC KS').name).toBe('Full: trzy asy i dwa króle');
    expect(ev('TS TH TD QC QS').name).toBe('Full: trzy dziesiątki i dwie damy');
    expect(ev('QS QH QD JC JS').name).toBe('Full: trzy damy i dwa walety');
  });

  it('nie uznaje Q-K-A-2-3 za strita', () => {
    expect(ev('QS KH AD 2C 3S').category).toBe(HandCategory.HighCard);
  });
});

describe('compareHands', () => {
  const cmp = (a: string, b: string) => Math.sign(compareHands(ev(a), ev(b)));

  it('wyższa kategoria wygrywa', () => {
    expect(cmp('2S 2H 3D 4C 6S', 'AS KH 9D 7C 3S')).toBe(1);
    expect(cmp('2H 7H 9H JH KH', '9S TH JD QC KS')).toBe(1);
  });
  it('kicker rozstrzyga przy równej parze', () => {
    expect(cmp('QS QH AD 7C 3S', 'QD QC KD 7H 3H')).toBe(1);
  });
  it('dwie pary: najpierw wyższa para, potem niższa, potem kicker', () => {
    expect(cmp('KS KH 2D 2C 3S', 'QS QH JD JC AS')).toBe(1);
    expect(cmp('KS KH 9D 9C 3S', 'KD KC 9S 9H 4S')).toBe(-1);
  });
  it('koło jest najniższym stritem', () => {
    expect(cmp('AS 2H 3D 4C 5S', '2S 3H 4D 5C 6S')).toBe(-1);
  });
  it('full porównuje najpierw trójkę', () => {
    expect(cmp('3S 3H 3D 2C 2S', '2D 2H 2C AC AS')).toBe(1);
  });
  it('remis przy identycznych wartościach w różnych kolorach', () => {
    expect(cmp('AS KH 9D 7C 3S', 'AH KD 9C 7S 3H')).toBe(0);
  });
});

describe('pluralPl', () => {
  it.each([[1, '1 karta'], [2, '2 karty'], [4, '4 karty'], [5, '5 kart'], [12, '12 kart'], [22, '22 karty'], [25, '25 kart']])('%i', (n, t) => {
    expect(pluralPl(n as number, 'karta', 'karty', 'kart')).toBe(t);
  });
});

describe('cards', () => {
  it('talia ma 52 unikalne karty', () => {
    expect(new Set(createDeck().map(cardCode)).size).toBe(52);
  });
  it('scriptedDeck zaczyna od zadanych kart i ma 52 karty', () => {
    const d = scriptedDeck('AS KS', createRng(1));
    expect(d.slice(0, 2).map(cardCode)).toEqual(['AS', 'KS']);
    expect(new Set(d.map(cardCode)).size).toBe(52);
  });
  it('scriptedDeck odrzuca duplikaty', () => {
    expect(() => scriptedDeck('AS AS', createRng(1))).toThrow();
  });
});
