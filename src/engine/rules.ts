/**
 * Konfiguracja reguł rozdania. Lekcje włączają kolejne elementy gry
 * (licytacja, wymiana, ante), dzięki czemu wszystkie rozdania używają tego samego silnika.
 */
export interface RulesConfig {
  /** Wpisowe pobierane od każdego gracza przed rozdaniem (0 = brak). */
  ante: number;
  /** Czy odbywają się rundy licytacji. */
  betting: boolean;
  /** Czy odbywa się wymiana kart. */
  draw: boolean;
  /** Maksymalna liczba wymienianych kart. */
  maxDraw: number;
  /** Fixed-limit: [stawka przed wymianą, stawka po wymianie]. */
  betSize: [number, number];
  /** Maksymalna liczba zakładów w rundzie (zakład + podbicia). */
  maxBetsPerRound: number;
}

export const FULL_RULES: RulesConfig = {
  ante: 1,
  betting: true,
  draw: true,
  maxDraw: 3,
  betSize: [2, 4],
  maxBetsPerRound: 4,
};

export function makeRules(partial: Partial<RulesConfig>): RulesConfig {
  return { ...FULL_RULES, ...partial };
}
