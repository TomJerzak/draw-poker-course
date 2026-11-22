import { createRng, parseCards, scriptedDeck } from '../engine/cards';
import { applyAction, PlayerSeat, startHand } from '../engine/game';
import { FULL_RULES } from '../engine/rules';
import { botDecide, BotLevel } from './bot';
import { adviseDraw } from './strategy';

describe('adviseDraw', () => {
  it.each([
    ['QS QH 9D 7C 3S', [2, 3, 4]],
    ['QS QH 9D 9C 3S', [4]],
    ['QS QH QD 9C 3S', [3, 4]],
    ['2H 7H 9H JH KS', [4]],
    ['5S 6H 7D 8C KS', [4]],
    ['9S TH JD QC KS', []],
    ['AS KH 9D 7C 3S', [2, 3, 4]],
  ])('%s → %j', (hand, discard) => {
    expect(adviseDraw(parseCards(hand)).discard).toEqual(discard);
  });
});

describe('adviseDraw – komunikaty', () => {
  it('cztery karty do koloru', () => {
    expect(adviseDraw(parseCards('2H 7H 9H JH KS')).reason).toBe(
      'Masz cztery karty w kolorze kier (♥). Wymień kartę w innym kolorze. Szansa na kolor około 19% (mniej więcej 1 na 5).',
    );
  });
  it('otwarty strit', () => {
    expect(adviseDraw(parseCards('5S 6H 7D 8C KS')).reason).toContain('Masz cztery kolejne karty: 5-6-7-8. Wymień kartę spoza ciągu. Strita da każda karta 4 albo 9');
  });
  it('dwie pary', () => {
    expect(adviseDraw(parseCards('QS QH 9D 9C 3S')).reason).toContain('wymień kartę spoza par. Szansa na fulla około 8,5%');
  });
});

describe('boty', () => {
  it('rozgrywają tysiące rozdań bez błędów i bez utraty żetonów', () => {
    const rng = createRng(42);
    const levels: BotLevel[] = ['easy', 'medium', 'hard', 'medium'];
    for (let g = 0; g < 3000; g++) {
      const n = 2 + (g % 3);
      const seats: PlayerSeat[] = Array.from({ length: n }, (_, i) => ({
        id: `b${i}`, name: `Bot ${i}`, isHuman: false, stack: 5 + Math.floor(rng() * 50),
      }));
      const before = seats.reduce((a, p) => a + p.stack, 0);
      let s = startHand(FULL_RULES, seats, g % n, scriptedDeck('', rng));
      while (s.toAct !== null) s = applyAction(s, botDecide(s, s.toAct, levels[s.toAct], rng));
      expect(s.players.reduce((a, p) => a + p.stack, 0)).toBe(before);
    }
  });
});
