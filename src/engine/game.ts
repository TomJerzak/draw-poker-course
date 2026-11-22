import { Card, pluralPl } from './cards';
import { compareHands, evaluateHand, HandValue } from './handEvaluator';
import { RulesConfig } from './rules';

export type Phase = 'bet1' | 'draw' | 'bet2' | 'showdown' | 'complete';

export interface PlayerSeat {
  id: string;
  name: string;
  isHuman: boolean;
  stack: number;
}

export interface PlayerState extends PlayerSeat {
  hand: Card[];
  folded: boolean;
  allIn: boolean;
  /** Wpłacone w bieżącej rundzie licytacji. */
  betThisRound: number;
  /** Wpłacone łącznie w całym rozdaniu (ante + zakłady). */
  contributed: number;
  hasActed: boolean;
  /** Liczba wymienionych kart, null = jeszcze nie wymieniał. */
  drawCount: number | null;
  /** Wynik po showdownie. */
  handValue?: HandValue;
}

export type Action =
  | { type: 'fold' }
  | { type: 'check' }
  | { type: 'call' }
  | { type: 'bet' }
  | { type: 'raise' }
  | { type: 'draw'; discard: number[] };

export type ActionType = Action['type'];

export type GameEvent =
  | { type: 'ante'; player: number; amount: number }
  | { type: 'deal'; player: number; cards: Card[] }
  | { type: 'phase'; phase: Phase }
  | { type: 'action'; player: number; action: Action; amount: number }
  | { type: 'drawn'; player: number; discarded: Card[]; received: Card[] }
  | { type: 'showdown'; players: number[] }
  | { type: 'win'; player: number; amount: number; uncontested: boolean; handName?: string };

export interface GameState {
  rules: RulesConfig;
  players: PlayerState[];
  deck: Card[];
  deckIndex: number;
  dealer: number;
  phase: Phase;
  /** Gracz, na którego ruch czekamy (null, gdy rozdanie zakończone). */
  toAct: number | null;
  /** Najwyższa kwota wpłacona w bieżącej rundzie. */
  currentBet: number;
  betsThisRound: number;
  events: GameEvent[];
  winners: number[];
}

export function pot(state: GameState): number {
  return state.players.reduce((s, p) => s + p.contributed, 0);
}

const nextIndex = (state: GameState, i: number) => (i + 1) % state.players.length;

function canAct(p: PlayerState): boolean {
  return !p.folded && !p.allIn;
}

function live(state: GameState): number[] {
  return state.players.map((p, i) => (p.folded ? -1 : i)).filter((i) => i >= 0);
}

/** Pierwszy gracz spełniający warunek, licząc od lewej strony gracza `from` (z pominięciem jego samego). */
function firstFrom(state: GameState, from: number, pred: (p: PlayerState) => boolean): number | null {
  let i = from;
  for (let n = 0; n < state.players.length; n++) {
    i = nextIndex(state, i);
    if (pred(state.players[i])) return i;
  }
  return null;
}

function put(state: GameState, player: number, amount: number): number {
  const p = state.players[player];
  const paid = Math.min(amount, p.stack);
  p.stack -= paid;
  p.betThisRound += paid;
  p.contributed += paid;
  if (p.stack === 0) p.allIn = true;
  return paid;
}

function draw(state: GameState, n: number): Card[] {
  const cards = state.deck.slice(state.deckIndex, state.deckIndex + n);
  if (cards.length < n) throw new Error('Skończyła się talia');
  state.deckIndex += n;
  return cards;
}

export function startHand(
  rules: RulesConfig,
  seats: PlayerSeat[],
  dealer: number,
  deck: Card[],
): GameState {
  if (seats.length < 2) throw new Error('Potrzeba co najmniej dwóch graczy');
  const state: GameState = {
    rules,
    players: seats.map((s) => ({
      ...s,
      hand: [],
      folded: false,
      allIn: false,
      betThisRound: 0,
      contributed: 0,
      hasActed: false,
      drawCount: null,
    })),
    deck,
    deckIndex: 0,
    dealer,
    phase: 'bet1',
    toAct: null,
    currentBet: 0,
    betsThisRound: 0,
    events: [],
    winners: [],
  };

  if (rules.ante > 0) {
    state.players.forEach((_, i) => {
      const paid = put(state, i, rules.ante);
      state.events.push({ type: 'ante', player: i, amount: paid });
    });
    state.players.forEach((p) => (p.betThisRound = 0));
  }

  // Rozdanie po jednej karcie, zaczynając od gracza po lewej stronie rozdającego.
  for (let round = 0; round < 5; round++) {
    let i = dealer;
    for (let n = 0; n < state.players.length; n++) {
      i = nextIndex(state, i);
      state.players[i].hand.push(draw(state, 1)[0]);
    }
  }
  state.players.forEach((p, i) => state.events.push({ type: 'deal', player: i, cards: p.hand.slice() }));

  enterPhase(state, rules.betting ? 'bet1' : rules.draw ? 'draw' : 'showdown');
  return state;
}

function enterPhase(state: GameState, phase: Phase): void {
  state.phase = phase;
  state.events.push({ type: 'phase', phase });
  state.players.forEach((p) => {
    p.betThisRound = 0;
    p.hasActed = false;
  });
  state.currentBet = 0;
  state.betsThisRound = 0;

  if (phase === 'bet1' || phase === 'bet2') {
    // Licytacja ma sens tylko, gdy co najmniej dwóch graczy może jeszcze działać.
    if (state.players.filter(canAct).length < 2) return advance(state);
    state.toAct = firstFrom(state, state.dealer, canAct);
  } else if (phase === 'draw') {
    state.toAct = firstFrom(state, state.dealer, (p) => !p.folded);
  } else if (phase === 'showdown') {
    showdown(state);
  }
}

function advance(state: GameState): void {
  const order: Phase[] = ['bet1', 'draw', 'bet2', 'showdown'];
  let idx = order.indexOf(state.phase) + 1;
  while (idx < order.length) {
    const ph = order[idx];
    if ((ph === 'bet1' || ph === 'bet2') && !state.rules.betting) idx++;
    else if (ph === 'draw' && !state.rules.draw) idx++;
    // Bez wymiany druga runda licytacji nie ma sensu – gramy jedną.
    else if (ph === 'bet2' && !state.rules.draw) idx++;
    else break;
  }
  enterPhase(state, order[idx]);
}

function bettingRoundDone(state: GameState): boolean {
  return state.players.every((p) => !canAct(p) || (p.hasActed && p.betThisRound === state.currentBet));
}

export function betSize(state: GameState): number {
  return state.phase === 'bet2' ? state.rules.betSize[1] : state.rules.betSize[0];
}

export function toCall(state: GameState, player: number): number {
  const p = state.players[player];
  return Math.min(state.currentBet - p.betThisRound, p.stack);
}

export function legalActions(state: GameState, player: number = state.toAct ?? -1): ActionType[] {
  if (state.toAct !== player || player < 0) return [];
  const p = state.players[player];
  if (state.phase === 'draw') return ['draw'];
  if (state.phase !== 'bet1' && state.phase !== 'bet2') return [];
  const owe = state.currentBet - p.betThisRound;
  const acts: ActionType[] = [];
  if (owe > 0) {
    acts.push('fold', 'call');
    const others = state.players.some((o, i) => i !== player && canAct(o));
    if (state.betsThisRound < state.rules.maxBetsPerRound && p.stack > owe && others) acts.push('raise');
  } else {
    acts.push('check');
    if (state.betsThisRound < state.rules.maxBetsPerRound) acts.push('bet');
    acts.push('fold');
  }
  return acts;
}

/** Stosuje akcję gracza `toAct`. Zwraca nowy stan (wejściowy pozostaje niezmieniony). */
export function applyAction(prev: GameState, action: Action): GameState {
  const state: GameState = structuredClone(prev);
  const player = state.toAct;
  if (player === null) throw new Error('Rozdanie jest zakończone');
  if (!legalActions(state, player).includes(action.type)) {
    throw new Error(`Niedozwolona akcja ${action.type} w fazie ${state.phase}`);
  }
  const p = state.players[player];

  if (action.type === 'draw') {
    const discard = [...new Set(action.discard)].sort((a, b) => a - b);
    if (discard.length > state.rules.maxDraw) throw new Error(`Można wymienić najwyżej ${pluralPl(state.rules.maxDraw, 'kartę', 'karty', 'kart')}`);
    if (discard.some((i) => i < 0 || i > 4)) throw new Error('Nieprawidłowy indeks karty');
    const discarded = discard.map((i) => p.hand[i]);
    const received = draw(state, discard.length);
    discard.forEach((idx, k) => (p.hand[idx] = received[k]));
    p.drawCount = discard.length;
    state.events.push({ type: 'drawn', player, discarded, received });
    const next = firstFrom(state, player, (o) => !o.folded && o.drawCount === null);
    if (next === null) advance(state);
    else state.toAct = next;
    return state;
  }

  let amount = 0;
  switch (action.type) {
    case 'fold':
      p.folded = true;
      break;
    case 'check':
      break;
    case 'call':
      amount = put(state, player, state.currentBet - p.betThisRound);
      break;
    case 'bet':
    case 'raise': {
      const target = state.currentBet + betSize(state);
      amount = put(state, player, target - p.betThisRound);
      state.currentBet = Math.max(state.currentBet, p.betThisRound);
      state.betsThisRound++;
      // Podbicie otwiera akcję pozostałym graczom.
      state.players.forEach((o, i) => {
        if (i !== player) o.hasActed = false;
      });
      break;
    }
  }
  p.hasActed = true;
  state.events.push({ type: 'action', player, action, amount });

  const remaining = live(state);
  if (remaining.length === 1) {
    awardUncontested(state, remaining[0]);
    return state;
  }
  if (bettingRoundDone(state)) {
    advance(state);
  } else {
    state.toAct = firstFrom(state, player, (o) => canAct(o) && (!o.hasActed || o.betThisRound < state.currentBet));
  }
  return state;
}

function finish(state: GameState): void {
  state.phase = 'complete';
  state.toAct = null;
  state.events.push({ type: 'phase', phase: 'complete' });
}

function awardUncontested(state: GameState, winner: number): void {
  const amount = pot(state);
  state.players[winner].stack += amount;
  state.winners = [winner];
  state.events.push({ type: 'win', player: winner, amount, uncontested: true });
  finish(state);
}

function showdown(state: GameState): void {
  state.toAct = null;
  const contenders = live(state);
  contenders.forEach((i) => (state.players[i].handValue = evaluateHand(state.players[i].hand)));
  state.events.push({ type: 'showdown', players: contenders });

  // Pule boczne: kolejne poziomy wpłat.
  const levels = [...new Set(state.players.map((p) => p.contributed).filter((c) => c > 0))].sort((a, b) => a - b);
  const won = new Map<number, number>();
  let prevLevel = 0;
  for (const level of levels) {
    const slice = level - prevLevel;
    const payers = state.players.filter((p) => p.contributed >= level).length;
    let amount = slice * payers;
    prevLevel = level;
    let eligible = contenders.filter((i) => state.players[i].contributed >= level);
    // Część wpłacona tylko przez graczy, którzy spasowali, trafia do pozostałych w grze.
    if (eligible.length === 0) eligible = contenders;
    if (amount === 0) continue;
    let best: number[] = [];
    for (const i of eligible) {
      if (best.length === 0) best = [i];
      else {
        const c = compareHands(state.players[i].handValue!, state.players[best[0]].handValue!);
        if (c > 0) best = [i];
        else if (c === 0) best.push(i);
      }
    }
    // Nieparzysty żeton trafia do pierwszego zwycięzcy po lewej rozdającego.
    best.sort((a, b) => seatDistance(state, a) - seatDistance(state, b));
    const share = Math.floor(amount / best.length);
    best.forEach((i) => won.set(i, (won.get(i) ?? 0) + share));
    amount -= share * best.length;
    if (amount > 0) won.set(best[0], (won.get(best[0]) ?? 0) + amount);
  }
  // Bez puli (rozdania pokazowe) nadal wskazujemy najlepszą rękę.
  if (won.size === 0) {
    const top = contenders.filter((i) =>
      contenders.every((j) => compareHands(state.players[i].handValue!, state.players[j].handValue!) >= 0),
    );
    top.forEach((i) => won.set(i, 0));
  }
  for (const [i, amount] of won) {
    state.players[i].stack += amount;
    state.events.push({ type: 'win', player: i, amount, uncontested: false, handName: state.players[i].handValue!.name });
  }
  state.winners = [...won.keys()];
  finish(state);
}

function seatDistance(state: GameState, i: number): number {
  return (i - state.dealer + state.players.length) % state.players.length || state.players.length;
}
