import { createRng, parseCards } from '../engine/cards';
import { applyAction, startHand } from '../engine/game';
import { makeRules } from '../engine/rules';
import { legalActions } from '../engine/game';
import { evaluateHand } from '../engine/handEvaluator';
import { coachAdvice } from './coach';
import { LESSONS, freePlayLesson } from './lessons';
import { act, botStep, createSession, deckForSeats, evaluateGoal, finishHand, HUMAN, lessonOver, nextHand, Session } from './session';

const seatsFor = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: i ? `Bot ${i}` : 'Ty', isHuman: i === 0, stack: 40 }));
import { Lesson } from './types';

/** Wzorowy uczeń: słucha trenera (w trybie „full”), a w quizie odpowiada poprawnie. */
function playLesson(lesson: Lesson, coached = true): Session {
  let s = createSession(lesson);
  for (;;) {
    let guard = 0;
    while (s.game.toAct !== null) {
      if (++guard > 300) throw new Error('pętla');
      if (s.game.toAct === HUMAN) {
        const adv = coachAdvice(s.game, HUMAN, coached ? 'full' : 'off');
        const acts = legalActions(s.game);
        if (acts.includes('draw')) s = act(s, { type: 'draw', discard: adv?.discard ?? [] });
        else s = act(s, { type: (adv?.suggested as never) ?? (acts.includes('check') ? 'check' : 'call') });
      } else s = botStep(s);
    }
    const w = s.game.winners;
    s = finishHand(s, lesson.quiz ? (w.length > 1 ? 'tie' : w[0]) : undefined);
    if (lessonOver(s)) return s;
    s = nextHand(s);
  }
}

describe('lekcje', () => {
  it('scenariusze nie zawierają powtórzonych kart', () => {
    for (const l of LESSONS) expect(() => createSession(l)).not.toThrow();
  });

  it.each(LESSONS.map((l) => [l.id, l] as const))('%s można zaliczyć grając zgodnie z radami trenera', (_, lesson) => {
    const s = playLesson(lesson);
    expect(s.results.length).toBe(lesson.handCount);
    expect(evaluateGoal(s)).toMatchObject({ passed: true, hint: undefined });
  });

  it('scenariusze dają zapowiedziane wyniki', () => {
    const byId = Object.fromEntries(LESSONS.map((l) => [l.id, l]));
    const winners = (id: string) => playLesson(byId[id]).results.map((r) => [...r.winners].sort().join('+'));
    expect(winners('l01')).toEqual(['0', '1', '0']);
    expect(winners('l02')).toEqual(['0', '1', '0', '0', '0+1']);
    expect(winners('l03')).toEqual(['0', '1', '0', '1', '0+1']);
    expect(winners('l04')).toEqual(['0', '1', '1', '0', '0']);
    expect(winners('l05')).toEqual(['0', '0', '0']);
    expect(playLesson(byId['l05']).results.map((r) => r.improved)).toEqual([true, true, false]);
    expect(winners('l10').slice(0, 2)).toEqual(['0', '0+1']);
    expect(winners('l00')).toEqual(['0']);
  });

  it('egzamin oblewa uczeń, który zawsze sprawdza i nigdy nie wymienia kart', () => {
    const exam = LESSONS.find((l) => l.id === 'l13')!;
    let s = createSession(exam);
    for (;;) {
      while (s.game.toAct !== null) {
        if (s.game.toAct === HUMAN) {
          const acts = legalActions(s.game);
          const t = acts.includes('draw') ? 'draw' : acts.includes('call') ? 'call' : 'check';
          s = act(s, { type: t, discard: [] } as never);
        } else s = botStep(s);
      }
      s = finishHand(s);
      if (lessonOver(s)) break;
      s = nextHand(s);
    }
    const g = evaluateGoal(s);
    expect(g.passed).toBe(false);
    expect(g.details!.length).toBeGreaterThan(0);
    expect(g.hint).toContain('omówienie błędów');
    expect(g.text).toMatch(/w licytacji \d+ z \d+, przy wymianie \d+ z \d+/);
    expect(g.details!.some((t) => /Twój ruch: bez wymiany\. Lepszy ruch: wymiana \d kart/.test(t))).toBe(true);
  });

  it('ćwiczenia z układami mają odpowiedź wśród dostępnych opcji', () => {
    for (const l of LESSONS) {
      for (const h of l.drill?.hands ?? []) {
        expect(l.drill!.options).toContain(evaluateHand(parseCards(h)).category);
      }
    }
  });

  it('trener: para waletów jeden na jednego – zakład; z dwoma rywalami – czekanie', () => {
    const rules = makeRules({});
    const deck = (cards: string[]) => deckForSeats(cards, cards.length - 1, '', createRng(1));
    const heads = startHand(rules, seatsFor(2), 1, deck(['JS JD AC 8H 4D', 'TS 9H 6C 4C 2D']));
    expect(coachAdvice(heads, HUMAN, 'full')?.suggested).toBe('bet');
    const multi = startHand(rules, seatsFor(3), 2, deck(['JS JD AC 8H 4D', 'TS 9H 6C 4C 2D', 'KS QH 7C 5S 3D']));
    expect(coachAdvice(multi, HUMAN, 'full')?.suggested).toBe('check');
    expect(coachAdvice(multi, HUMAN, 'full')?.text).toContain('Pasując teraz, oddajesz szansę na pulę, a nic nie oszczędzasz.');
  });

  it('trener: szansa na kolor przed wymianą – pas przy małej puli, sprawdzenie przy dużej', () => {
    const rules = makeRules({});
    const flush = '2H 7H 9H JH KS';
    // jeden na jednego: pula 4, dopłata 2 (trzeba wygrywać w 33%) – za mało
    let g = startHand(rules, seatsFor(2), 0, deckForSeats([flush, 'AS AD 8S 6D 3C'], 0, '', createRng(1)));
    g = applyAction(g, { type: 'bet' });
    const small = coachAdvice(g, HUMAN, 'full', true)!;
    expect(small.suggested).toBe('fold');
    expect(small.text).toContain('liczysz na kolor (szansa około 19%)');
    expect(small.text).toContain('szansa na trafienie jest za mała');
    // trzech graczy: zakład i sprawdzenie przed uczniem – pula 7, dopłata 2 (trzeba 22%) – opłaca się
    g = startHand(rules, seatsFor(3), 0, deckForSeats([flush, 'AS AD 8S 6D 3C', 'KC KD QS 5D 4C'], 0, '', createRng(1)));
    g = applyAction(g, { type: 'bet' });
    g = applyAction(g, { type: 'call' });
    const big = coachAdvice(g, HUMAN, 'full', true)!;
    expect(big.suggested).toBe('call');
    expect(big.text).toContain('przy wymianie możesz trafić kolor (szansa około 19%)');
  });

  it('trener: rywal bez wymiany – ostrzeżenie z imieniem i ostrożniejsza rada', () => {
    const rules = makeRules({});
    let g = startHand(rules, seatsFor(2), 1, deckForSeats(['JS JD AC 8H 4D', '5S 6H 7D 8C 9S'], 1, '2C 3D 4S', createRng(1)));
    g = applyAction(g, { type: 'check' });
    g = applyAction(g, { type: 'check' });
    g = applyAction(g, { type: 'draw', discard: [2, 3, 4] });
    g = applyAction(g, { type: 'draw', discard: [] }); // Bot 1 stoi
    const adv = coachAdvice(g, HUMAN, 'full')!;
    expect(adv.text.startsWith('Bot 1 gra bez wymiany kart („stoi”) – pewnie ma gotowy układ albo blefuje')).toBe(true);
    expect(adv.suggested).toBe('check'); // para waletów bez ostrzeżenia dałaby zakład
  });

  it('bot bez żetonów dostaje nowe, a sesja zapisuje, kto je dostał', () => {
    const s = createSession(freePlayLesson(2, 'easy', false, 1));
    s.game.players[2].stack = 0;
    const next = nextHand(s);
    expect(next.rebuys).toEqual([s.game.players[2].name]);
    expect(next.seats[2].stack).toBe(50);
    expect(nextHand(next).rebuys).toEqual([]);
  });

  it('wolna gra działa dla różnych ustawień', () => {
    for (let n = 1; n <= 5; n++) {
      let s = createSession(freePlayLesson(n, 'hard', false, n));
      for (let h = 0; h < 20; h++) {
        while (s.game.toAct !== null) {
          const acts = legalActions(s.game);
          const t = acts.includes('draw') ? 'draw' : acts.includes('check') ? 'check' : 'call';
          s = s.game.toAct === HUMAN ? act(s, { type: t, discard: [] } as never) : botStep(s);
        }
        s = finishHand(s);
        if (s.failed) break;
        s = nextHand(s);
      }
    }
  });
});
