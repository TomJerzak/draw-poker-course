import { createRng, parseCards, scriptedDeck, cardCode } from './cards';
import { applyAction, GameState, legalActions, PlayerSeat, pot, startHand } from './game';
import { FULL_RULES, makeRules } from './rules';

const seats = (n: number, stack = 100): PlayerSeat[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Gracz ${i}`, isHuman: i === 0, stack }));

/** Ułóż talię tak, by gracze (od lewej rozdającego) dostali dane ręce, a dobierane karty były w `drawPile`. */
function deckFor(hands: string[], drawPile = ''): ReturnType<typeof scriptedDeck> {
  const hs = hands.map(parseCards);
  const order: string[] = [];
  for (let r = 0; r < 5; r++) hs.forEach((h) => order.push(cardCode(h[r])));
  return scriptedDeck([...order, drawPile].join(' '), createRng(7));
}

const total = (s: GameState) => s.players.reduce((a, p) => a + p.stack, 0) + (s.phase === 'complete' ? 0 : pot(s));

describe('startHand', () => {
  it('pobiera ante i rozdaje po 5 kart zaczynając od lewej rozdającego', () => {
    // dealer = 1, więc pierwszą kartę dostaje gracz 0
    const s = startHand(FULL_RULES, seats(2), 1, deckFor(['AS AH AD AC KS', '2S 3S 4S 5S 7H']));
    expect(pot(s)).toBe(2);
    expect(s.players[0].hand.map(cardCode)).toEqual(['AS', 'AH', 'AD', 'AC', 'KS']);
    expect(s.phase).toBe('bet1');
    expect(s.toAct).toBe(0);
  });

  it('bez licytacji i wymiany od razu kończy się showdownem', () => {
    const rules = makeRules({ ante: 0, betting: false, draw: false });
    const s = startHand(rules, seats(2), 1, deckFor(['AS AH 9D 4C 2S', 'KS KH QD JC 3S']));
    expect(s.phase).toBe('complete');
    expect(s.winners).toEqual([0]);
  });
});

describe('licytacja', () => {
  it('check-check przechodzi do wymiany', () => {
    let s = startHand(FULL_RULES, seats(2), 1, deckFor(['AS AH 9D 4C 2S', 'KS KH QD JC 3S']));
    expect(legalActions(s)).toEqual(['check', 'bet', 'fold']);
    s = applyAction(s, { type: 'check' });
    s = applyAction(s, { type: 'check' });
    expect(s.phase).toBe('draw');
    expect(s.toAct).toBe(0);
  });

  it('bet-fold daje pulę bez showdownu', () => {
    let s = startHand(FULL_RULES, seats(2), 1, deckFor(['2S 3H 9D 4C 7S', 'KS KH QD JC 3S']));
    s = applyAction(s, { type: 'bet' });
    expect(legalActions(s)).toEqual(['fold', 'call', 'raise']);
    s = applyAction(s, { type: 'fold' });
    expect(s.phase).toBe('complete');
    expect(s.winners).toEqual([0]);
    expect(s.players[0].stack).toBe(101);
    expect(s.players[1].stack).toBe(99);
  });

  it('limit zakładów w rundzie blokuje dalsze podbicia', () => {
    let s = startHand(FULL_RULES, seats(2), 1, deckFor(['AS AH 9D 4C 2S', 'KS KH QD JC 3S']));
    s = applyAction(s, { type: 'bet' });
    s = applyAction(s, { type: 'raise' });
    s = applyAction(s, { type: 'raise' });
    s = applyAction(s, { type: 'raise' });
    expect(legalActions(s)).toEqual(['fold', 'call']);
    s = applyAction(s, { type: 'call' });
    expect(s.phase).toBe('draw');
    expect(pot(s)).toBe(2 + 2 * 8);
  });

  it('niedozwolona akcja rzuca błąd', () => {
    const s = startHand(FULL_RULES, seats(2), 1, deckFor(['AS AH 9D 4C 2S', 'KS KH QD JC 3S']));
    expect(() => applyAction(s, { type: 'call' })).toThrow();
  });
});

describe('wymiana i showdown', () => {
  it('wymienia wskazane karty z góry talii i druga licytacja ma wyższą stawkę', () => {
    let s = startHand(FULL_RULES, seats(2), 1, deckFor(['AS AH 9D 4C 2S', 'KS KH QD JC 3S'], 'AD 8C 7C TD'));
    s = applyAction(s, { type: 'check' });
    s = applyAction(s, { type: 'check' });
    s = applyAction(s, { type: 'draw', discard: [2, 3, 4] });
    expect(s.players[0].hand.map(cardCode)).toEqual(['AS', 'AH', 'AD', '8C', '7C']);
    s = applyAction(s, { type: 'draw', discard: [4] });
    expect(s.players[1].hand[4]).toEqual({ rank: 10, suit: 'D' });
    expect(s.phase).toBe('bet2');
    s = applyAction(s, { type: 'bet' });
    expect(s.players[0].contributed).toBe(1 + 4);
    s = applyAction(s, { type: 'call' });
    expect(s.phase).toBe('complete');
    expect(s.winners).toEqual([0]);
    expect(s.players[0].handValue?.name).toBe('Trójka asów');
    expect(s.players[0].stack).toBe(105);
  });

  it('nie pozwala wymienić więcej niż maxDraw', () => {
    let s = startHand(makeRules({ betting: false }), seats(2), 1, deckFor(['AS AH 9D 4C 2S', 'KS KH QD JC 3S']));
    expect(() => applyAction(s, { type: 'draw', discard: [0, 1, 2, 3] })).toThrow();
    s = applyAction(s, { type: 'draw', discard: [] });
    expect(s.players[0].drawCount).toBe(0);
  });

  it('remis dzieli pulę', () => {
    const rules = makeRules({ betting: false, draw: false, ante: 5 });
    const s = startHand(rules, seats(2), 1, deckFor(['AS KH 9D 7C 3S', 'AH KD 9C 7S 3H']));
    expect(s.winners.sort()).toEqual([0, 1]);
    expect(s.players[0].stack).toBe(100);
    expect(s.players[1].stack).toBe(100);
  });
});

describe('all-in i pule boczne', () => {
  it('krótki stack wygrywa tylko pulę główną', () => {
    const rules = makeRules({ ante: 1, draw: false, betSize: [10, 10] });
    const st = [...seats(3)];
    st[0] = { ...st[0], stack: 6 };
    // dealer = 2 → kolejność: 0, 1, 2
    let s = startHand(rules, st, 2, deckFor(['AS AH AD 4C 2S', 'KS KH QD JC 3S', 'QS QH 9D 8C 3D']));
    s = applyAction(s, { type: 'bet' }); // gracz 0 all-in za 5
    expect(s.players[0].allIn).toBe(true);
    s = applyAction(s, { type: 'raise' }); // gracz 1 do 15
    s = applyAction(s, { type: 'call' }); // gracz 2
    expect(s.phase).toBe('complete');
    // pula główna: 6*3 = 18 dla gracza 0; boczna: 10*2 = 20 dla gracza 1 (para króli > para dam)
    expect(s.players[0].stack).toBe(18);
    expect(s.players[1].stack).toBe(100 - 16 + 20);
    expect(s.players[2].stack).toBe(100 - 16);
  });
});

describe('symulacja losowa', () => {
  it('zachowuje sumę żetonów i zawsze się kończy', () => {
    const rng = createRng(123);
    for (let g = 0; g < 2000; g++) {
      const n = 2 + (g % 4);
      const st = seats(n).map((p) => ({ ...p, stack: 1 + Math.floor(rng() * 30) }));
      const before = st.reduce((a, p) => a + p.stack, 0);
      let s = startHand(FULL_RULES, st, g % n, scriptedDeck('', rng));
      let steps = 0;
      while (s.toAct !== null) {
        const acts = legalActions(s);
        const t = acts[Math.floor(rng() * acts.length)];
        s = applyAction(
          s,
          t === 'draw' ? { type: 'draw', discard: [0, 1, 2].filter(() => rng() < 0.5) } : ({ type: t } as never),
        );
        if (++steps > 200) throw new Error('Pętla');
      }
      expect(total(s)).toBe(before);
    }
  });
});
