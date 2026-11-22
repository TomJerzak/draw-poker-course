import { botDecide } from '../bots/bot';
import { Card, cardCode, cardLabel, createRng, parseCards, pluralPl, scriptedDeck } from '../engine/cards';
import { Action, ActionType, applyAction, GameState, Phase, PlayerSeat, startHand } from '../engine/game';
import { evaluateHand } from '../engine/handEvaluator';
import { coachAdvice } from './coach';
import { Lesson } from './types';

export const HUMAN = 0;

export interface HandResult {
  winners: number[];
  humanWon: boolean;
  /** Czy wymiana poprawiła kategorię układu ucznia. */
  improved: boolean;
  quizCorrect?: boolean;
  stackAfter: number;
}

/** Decyzja ucznia porównana z oceną trenera (podstawa egzaminu). */
export interface Decision {
  handNo: number;
  phase: Phase;
  action: Action;
  suggested?: ActionType;
  /** Karty sugerowane do wymiany (gdy decyzja dotyczyła wymiany). */
  suggestedDiscard?: number[];
  /** Ręka ucznia w chwili decyzji – do omówienia wymiany. */
  hand: Card[];
  ok: boolean;
  advice: string;
}

export interface Session {
  lesson: Lesson;
  handNo: number;
  seats: PlayerSeat[];
  game: GameState;
  results: HandResult[];
  failed: boolean;
  decisions: Decision[];
  /** Boty, które przed bieżącym rozdaniem dostały nowe żetony (po przegraniu wszystkich). */
  rebuys: string[];
  rng: () => number;
}

export function dealerFor(lesson: Lesson, handNo: number): number {
  const n = lesson.opponents.length + 1;
  // Pierwszym rozdającym jest ostatni przeciwnik, więc uczeń zaczyna licytację.
  return (n - 1 + handNo) % n;
}

/** Talia, w której miejsca przy stole dostają zadane karty (rozdawane od lewej rozdającego). */
export function deckForSeats(cards: string[], dealer: number, drawPile: string, rng: () => number): Card[] {
  const n = cards.length;
  const hands = cards.map(parseCards);
  const order: string[] = [];
  for (let r = 0; r < 5; r++) {
    for (let k = 1; k <= n; k++) order.push(cardCode(hands[(dealer + k) % n][r]));
  }
  return scriptedDeck([...order, drawPile].join(' '), rng);
}

function deal(lesson: Lesson, seats: PlayerSeat[], handNo: number, rng: () => number): GameState {
  const dealer = dealerFor(lesson, handNo);
  const script = lesson.scripted?.[handNo];
  const deck = script?.cards
    ? deckForSeats(script.cards, dealer, script.drawPile ?? '', rng)
    : scriptedDeck('', rng);
  return startHand(lesson.rules, seats, dealer, deck);
}

export function createSession(lesson: Lesson, seed = lesson.seed): Session {
  const rng = createRng(seed);
  const seats: PlayerSeat[] = [
    { id: 'you', name: 'Ty', isHuman: true, stack: lesson.startingStack },
    ...lesson.opponents.map((o, i) => ({ id: `bot${i}`, name: o.name, isHuman: false, stack: lesson.startingStack })),
  ];
  return { lesson, handNo: 0, seats, game: deal(lesson, seats, 0, rng), results: [], failed: false, decisions: [], rebuys: [], rng };
}

export function isHumanTurn(s: Session): boolean {
  return s.game.toAct === HUMAN;
}

const sameSet = (a: number[], b: number[]) => a.length === b.length && a.every((x) => b.includes(x));

/** Podbicie zamiast sugerowanego sprawdzenia (i odwrotnie) uznajemy za dopuszczalne. */
function acceptable(action: Action, suggested: ActionType | undefined, discard: number[] | undefined): boolean {
  if (!suggested) return true;
  if (action.type === 'draw') return sameSet(action.discard, discard ?? []);
  if (suggested === 'raise') return action.type === 'raise' || action.type === 'call';
  return action.type === suggested;
}

export function act(s: Session, action: Action): Session {
  let decisions = s.decisions;
  if (s.game.toAct === HUMAN) {
    const adv = coachAdvice(s.game, HUMAN, 'full', true);
    if (adv) {
      decisions = [
        ...decisions,
        {
          handNo: s.handNo,
          phase: s.game.phase,
          action,
          suggested: adv.suggested,
          suggestedDiscard: adv.discard,
          hand: s.game.players[HUMAN].hand.slice(),
          ok: acceptable(action, adv.suggested, adv.discard),
          advice: adv.text,
        },
      ];
    }
  }
  return { ...s, decisions, game: applyAction(s.game, action) };
}

/** Ruch bota, jeśli to jego kolej. */
export function botStep(s: Session): Session {
  const p = s.game.toAct;
  if (p === null || p === HUMAN) return s;
  return act(s, botDecide(s.game, p, s.lesson.opponents[p - 1].level, s.rng));
}

/** Kto ma najlepszą rękę przy odkrytych kartach (do quizu). */
export function quizAnswer(s: Session): number[] {
  return s.game.winners;
}

/** Zapisuje wynik zakończonego rozdania. */
export function finishHand(s: Session, quizPick?: number | 'tie'): Session {
  const g = s.game;
  if (g.phase !== 'complete') throw new Error('Rozdanie jeszcze trwa');
  const dealt = g.events.find((e) => e.type === 'deal' && e.player === HUMAN);
  const before = dealt && dealt.type === 'deal' ? evaluateHand(dealt.cards).category : 0;
  const after = evaluateHand(g.players[HUMAN].hand).category;
  let quizCorrect: boolean | undefined;
  if (quizPick !== undefined) {
    quizCorrect = quizPick === 'tie' ? g.winners.length > 1 : g.winners.length === 1 && g.winners[0] === quizPick;
  }
  const result: HandResult = {
    winners: g.winners,
    humanWon: g.winners.includes(HUMAN),
    improved: g.players[HUMAN].drawCount !== null && after > before,
    quizCorrect,
    stackAfter: g.players[HUMAN].stack,
  };
  return { ...s, results: [...s.results, result], failed: g.players[HUMAN].stack <= 0 && (s.lesson.rules.ante > 0 || s.lesson.rules.betting) };
}

export function lessonOver(s: Session): boolean {
  return s.failed || s.results.length >= s.lesson.handCount;
}

/** Przechodzi do następnego rozdania; przegrani boty dostają nowe żetony. */
export function nextHand(s: Session): Session {
  const handNo = s.handNo + 1;
  const rebuys: string[] = [];
  const seats = s.game.players.map((p, i) => {
    const rebuy = i !== HUMAN && p.stack <= s.lesson.rules.ante;
    if (rebuy) rebuys.push(p.name);
    return { id: p.id, name: p.name, isHuman: p.isHuman, stack: rebuy ? s.lesson.startingStack : p.stack };
  });
  return { ...s, handNo, seats, rebuys, game: deal(s.lesson, seats, handNo, s.rng) };
}

export interface GoalStatus {
  passed: boolean;
  text: string;
  /** Dodatkowe uwagi, np. lista błędnych decyzji na egzaminie. */
  details?: string[];
  /** Co zrobić inaczej przy następnym podejściu (tylko po porażce). */
  hint?: string;
  /** Dodatkowa informacja o przebiegu, np. bilans żetonów. */
  extra?: string;
}

const PHASE_PL: Record<Phase, string> = {
  bet1: 'licytacja przed wymianą',
  draw: 'wymiana',
  bet2: 'licytacja po wymianie',
  showdown: 'odkrycie kart',
  complete: 'koniec',
};

const ACTION_PL: Record<ActionType, string> = {
  fold: 'pas', check: 'czekanie', call: 'sprawdzenie', bet: 'zakład', raise: 'podbicie', draw: 'wymiana',
};

function describeDraw(discard: number[], hand: Card[]): string {
  const n = discard.length;
  if (n === 0) return 'bez wymiany';
  const cards = [...discard].sort((a, b) => a - b).map((i) => cardLabel(hand[i])).join(', ');
  return `wymiana ${n === 1 ? '1 karty' : `${n} kart`}: ${cards}`;
}

function describeAction(a: Action, hand: Card[]): string {
  return a.type === 'draw' ? describeDraw(a.discard, hand) : ACTION_PL[a.type];
}

function describeBetter(d: Decision): string {
  if (d.suggested === 'draw') return describeDraw(d.suggestedDiscard ?? [], d.hand);
  return d.suggested ? ACTION_PL[d.suggested] : '';
}

const SAME_DEALS = 'Karty rozdawane na start ustawionych rozdań będą te same, ale ruchy rywali i karty z wymiany mogą być inne.';

export function evaluateGoal(s: Session): GoalStatus {
  const status = evaluateGoalRaw(s);
  const { rules, startingStack, goal } = s.lesson;
  const r = s.results;
  let extra: string | undefined;
  if ((rules.ante > 0 || rules.betting) && r.length > 0 && goal.type !== 'profit' && !s.lesson.autoplay) {
    const end = r[r.length - 1].stackAfter;
    const diff = end - startingStack;
    extra = `Bilans żetonów: ${diff > 0 ? '+' : ''}${diff} (start: ${startingStack}, na koniec: ${pluralPl(end, 'żeton', 'żetony', 'żetonów')}).`;
  }
  return { ...status, extra, hint: status.passed ? undefined : status.hint };
}

function evaluateGoalRaw(s: Session): GoalStatus {
  const { goal, startingStack } = s.lesson;
  const r = s.results;
  if (s.failed) {
    return {
      passed: false,
      text: 'Skończyły Ci się żetony.',
      hint: `Słuchaj rad trenera: z mocną ręką stawiaj, ze słabą – czekaj, a gdy ktoś postawi, pasuj. Każde niepotrzebne sprawdzenie kosztuje żetony. ${SAME_DEALS}`,
    };
  }
  const finalStack = r.length ? r[r.length - 1].stackAfter : startingStack;
  switch (goal.type) {
    case 'finish': {
      const passed = r.length >= s.lesson.handCount;
      if (s.lesson.autoplay) return { passed, text: 'Pokazowe rozdanie obejrzane do końca.' };
      const watched = !s.lesson.rules.betting && !s.lesson.rules.draw;
      return { passed, text: `${watched ? 'Obejrzane' : 'Rozegrane'} rozdania: ${r.length} z ${s.lesson.handCount}` };
    }
    case 'quiz': {
      const ok = r.filter((x) => x.quizCorrect).length;
      return {
        passed: ok >= goal.min,
        text: `Poprawne odpowiedzi: ${ok} z ${r.length} (wymagane ${goal.min})`,
        hint: 'Przed odpowiedzią porównaj najpierw rodzaj układu (ściąga „Układy”), a dopiero przy takim samym układzie – wartość kart. Przy powtórce rozdania będą te same.',
      };
    }
    case 'improve': {
      const ok = r.filter((x) => x.improved).length;
      return {
        passed: ok >= goal.min,
        text: `Rozdania z poprawionym układem: ${ok} z ${r.length} (wymagane ${goal.min})`,
        hint: 'Przy wymianie kliknij „Zaznacz sugerowane” – trener wskaże karty, których wymiana daje największą szansę na poprawę. Przy powtórce rozdania będą te same.',
      };
    }
    case 'wins': {
      const ok = r.filter((x) => x.humanWon).length;
      return {
        passed: ok >= goal.min,
        text: `Wygrane rozdania: ${ok} z ${r.length} (wymagane ${goal.min})`,
        hint: `Grając z podpowiedziami, wybieraj przycisk podświetlony przez trenera. Nie pasuj, gdy możesz czekać za darmo – pasując, oddajesz rozdanie. ${SAME_DEALS}`,
      };
    }
    case 'decisions': {
      const d = s.decisions;
      const ok = d.filter((x) => x.ok).length;
      const pct = d.length ? Math.round((ok / d.length) * 100) : 0;
      const bets = d.filter((x) => x.phase !== 'draw');
      const draws = d.filter((x) => x.phase === 'draw');
      const part = (xs: Decision[]) => `${xs.filter((x) => x.ok).length} z ${xs.length}`;
      return {
        passed: d.length > 0 && pct >= goal.minPercent,
        text: `Dobre decyzje: ${ok} z ${d.length} (${pct}%, wymagane ${goal.minPercent}%) – w licytacji ${part(bets)}, przy wymianie ${part(draws)}.`,
        hint: 'Przeczytaj omówienie błędów poniżej. Jeśli któraś zasada jest niejasna, wróć do lekcji, której dotyczy – zaliczone lekcje można powtarzać. Przy powtórce dostaniesz te same karty na start, ale ruchy rywali i karty z wymiany mogą być inne.',
        details: d
          .filter((x) => !x.ok)
          .map(
            (x) =>
              `Rozdanie ${x.handNo + 1}, ${PHASE_PL[x.phase]}. Twój ruch: ${describeAction(x.action, x.hand)}. Lepszy ruch: ${describeBetter(x)}. Dlaczego: ${x.advice}`,
          ),
      };
    }
    case 'profit': {
      const diff = finalStack - startingStack;
      return {
        passed: diff >= goal.min,
        text: `Bilans żetonów: ${diff >= 0 ? '+' : ''}${diff} (wymagane ${goal.min >= 0 ? '+' : ''}${goal.min})`,
      };
    }
  }
}
