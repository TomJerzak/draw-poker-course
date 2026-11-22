import { Action, GameState, legalActions, pot, toCall } from '../engine/game';
import { adviseDraw, handStrength } from './strategy';

export type BotLevel = 'easy' | 'medium' | 'hard';

export interface BotProfile {
  /** Jak chętnie wchodzi do gry (0 = tylko mocne ręce, 1 = wszystko sprawdza). */
  looseness: number;
  /** Jak chętnie podbija mocne ręce. */
  aggression: number;
  /** Prawdopodobieństwo blefu ze słabą ręką. */
  bluff: number;
  /** Czy bierze pod uwagę liczbę kart wymienionych przez rywali. */
  readsDraws: boolean;
}

export const BOT_PROFILES: Record<BotLevel, BotProfile> = {
  easy: { looseness: 0.8, aggression: 0.2, bluff: 0.02, readsDraws: false },
  medium: { looseness: 0.45, aggression: 0.55, bluff: 0.08, readsDraws: false },
  hard: { looseness: 0.3, aggression: 0.8, bluff: 0.15, readsDraws: true },
};

export function botDecide(state: GameState, player: number, level: BotLevel, rng: () => number): Action {
  const profile = BOT_PROFILES[level];
  const me = state.players[player];
  const acts = legalActions(state, player);

  if (acts.includes('draw')) {
    return { type: 'draw', discard: adviseDraw(me.hand, state.rules.maxDraw).discard };
  }

  let strength = handStrength(me.hand, state.phase === 'bet1');
  if (profile.readsDraws && state.phase === 'bet2') {
    // Rywal, który „stoi” (nic nie wymienił), zwykle ma gotowy układ.
    const standPat = state.players.some((p, i) => i !== player && !p.folded && p.drawCount === 0);
    if (standPat) strength -= 0.15;
  }
  // Więcej rywali = trudniej wygrać.
  const opponents = state.players.filter((p, i) => i !== player && !p.folded).length;
  strength -= (opponents - 1) * 0.07;

  const owe = toCall(state, player);
  const potOdds = owe > 0 ? owe / (pot(state) + owe) : 0;
  const r = rng();

  if (acts.includes('check')) {
    if (acts.includes('bet') && (strength > 0.75 - profile.aggression * 0.2 || r < profile.bluff)) return { type: 'bet' };
    return { type: 'check' };
  }
  // Musimy dopłacić.
  if (acts.includes('raise') && strength > 0.88 - profile.aggression * 0.15 && r < 0.4 + profile.aggression * 0.5) {
    return { type: 'raise' };
  }
  const callThreshold = potOdds + (1 - profile.looseness) * 0.25;
  if (strength >= callThreshold || r < profile.looseness * 0.15) return { type: 'call' };
  return { type: 'fold' };
}
