import { BotLevel } from '../bots/bot';
import { HandCategory } from '../engine/handEvaluator';
import { RulesConfig } from '../engine/rules';

export interface ScriptedHand {
  /** Karty dla każdego miejsca przy stole (0 = uczeń), np. "AS KH 9D 7C 3S". */
  cards?: string[];
  /** Karty leżące na górze talii po rozdaniu – trafią do graczy przy wymianie, po kolei. */
  drawPile?: string;
  /** Komentarz trenera na początku rozdania. */
  before?: string;
  /** Komentarz trenera po zakończeniu rozdania. */
  after?: string;
  /**
   * Kiedy pokazać komentarz `after` – gdy opisuje konkretny przebieg rozdania:
   * 'showdown' – doszło do odkrycia kart, 'humanWins' – uczeń wygrał. Brak = zawsze.
   */
  afterRequires?: ('showdown' | 'humanWins')[];
}

/** Ćwiczenie „znajdź układ”: uczeń nazywa układ i zaznacza tworzące go karty. */
export interface Drill {
  hands: string[];
  /** Układy do wyboru (tylko te, które uczeń już poznał). */
  options: HandCategory[];
}

export type Goal =
  | { type: 'finish' }
  | { type: 'quiz'; min: number }
  | { type: 'improve'; min: number }
  | { type: 'wins'; min: number }
  | { type: 'profit'; min: number }
  /** Odsetek decyzji zgodnych z oceną trenera. */
  | { type: 'decisions'; minPercent: number };

export type CoachMode = 'off' | 'draw' | 'full';

export interface Lesson {
  id: string;
  title: string;
  /** Krótko: czego uczy lekcja (na mapie kursu). */
  teaches: string;
  intro: string[];
  rules: RulesConfig;
  opponents: { name: string; level: BotLevel }[];
  startingStack: number;
  /** Liczba rozdań (Infinity dla wolnej gry). */
  handCount: number;
  scripted?: ScriptedHand[];
  /** Wszystkie karty odkryte (lekcje o układach i wymianie). */
  revealAll?: boolean;
  /** Przed pokazaniem wyniku uczeń wskazuje zwycięzcę. */
  quiz?: boolean;
  /** Ćwiczenie przed rozdaniami. */
  drill?: Drill;
  /** Pokazowe rozdanie: ruchy wykonują się po kliknięciu „Dalej”, z objaśnieniem każdego kroku. */
  autoplay?: boolean;
  coach: CoachMode;
  /** Czy trener posługuje się procentami (pot odds) – dopiero od lekcji strategii. */
  coachOdds?: boolean;
  goal: Goal;
  goalText: string;
  summary: string[];
  /** Pokaż ściągę z układami. */
  showRankings?: boolean;
  seed: number;
}
