import { useState } from 'react';
import { BotLevel } from '../bots/bot';
import { LESSONS } from '../lessons/lessons';
import { GoalStatus } from '../lessons/session';
import { Lesson } from '../lessons/types';
import { Progress } from '../state/progress';
import { HandRankings } from './HandRankings';
import { Glossary, RichText } from './RichText';
import { splitTerms } from '../lessons/glossary';
import { pluralPl } from '../engine/cards';

/** Numer lekcji widoczny dla ucznia (od 1). */
function lessonNo(l: Lesson): number {
  return LESSONS.indexOf(l) + 1;
}

/** Krótki opis rodzaju i długości lekcji na liście w menu. */
function lessonKind(l: Lesson): string {
  const hands = pluralPl(l.handCount, 'rozdanie', 'rozdania', 'rozdań');
  if (l.autoplay) return 'Pokaz z objaśnieniami · 1 rozdanie';
  if (l.goal.type === 'decisions' && l.coach === 'off') return `Egzamin bez podpowiedzi · ${hands}`;
  if (l.drill) return `Ćwiczenie + quiz · ${pluralPl(l.drill.hands.length, 'ręka', 'ręce', 'rąk')} i ${hands}`;
  if (l.quiz) return `Quiz · ${hands}`;
  if (!l.rules.betting && !l.rules.draw) return `Oglądanie · ${hands}`;
  const coach = { off: 'bez podpowiedzi', draw: 'z podpowiedziami przy wymianie', full: 'z podpowiedziami trenera' }[l.coach];
  return `Gra ${coach} · ${hands}`;
}

export function LessonMap({
  progress,
  onOpen,
  onFreePlay,
  onReset,
}: {
  progress: Progress;
  onOpen: (l: Lesson) => void;
  onFreePlay: () => void;
  onReset: () => void;
}) {
  const done = new Set(progress.completed);
  const [glossary, setGlossary] = useState(false);
  const [rankings, setRankings] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const completedCount = LESSONS.filter((l) => done.has(l.id)).length;
  const next = LESSONS.find((l, i) => !done.has(l.id) && (i === 0 || done.has(LESSONS[i - 1].id)));
  const nextNo = next ? lessonNo(next) : -1;
  return (
    <div className="screen">
      <h1>♠ Kurs Pokera ♥</h1>
      <p className="lead">
        Kurs pokera dobieranego dla początkujących. Zasady poznajesz krok po kroku, lekcja po lekcji.
      </p>

      <div className="row menu-bar">
        <button className="btn ghost" onClick={() => setRankings(true)}>Układy</button>
        <button className="btn ghost" onClick={() => setGlossary(true)}>Słowniczek</button>
      </div>

      <div className="goal">
        {completedCount === 0 ? (
          <>Zacznij od lekcji 1. Kolejne lekcje odblokowują się po zaliczeniu poprzednich.</>
        ) : next ? (
          <>
            Ukończone lekcje: <strong>{completedCount} z {LESSONS.length}</strong>. Następna: lekcja {nextNo} – {next.title}.
          </>
        ) : (
          <>
            🎉 Kurs ukończony ({completedCount} z {LESSONS.length} lekcji). Ćwicz dalej w wolnej grze albo powtórz dowolną lekcję.
          </>
        )}
        {next && (
          <div className="row">
            <button className="btn primary" onClick={() => onOpen(next)}>
              {completedCount === 0 ? 'Zacznij kurs →' : `Kontynuuj: lekcja ${nextNo} →`}
            </button>
          </div>
        )}
        <div className="muted small" style={{ marginTop: 8 }}>
          Postęp zapisuje się w tej przeglądarce. Zaliczone lekcje możesz powtarzać.
        </div>
      </div>

      <ol className="lesson-list">
        {LESSONS.map((l, i) => {
          const unlocked = i === 0 || done.has(LESSONS[i - 1].id);
          const completed = done.has(l.id);
          return (
            <li key={l.id}>
              <button
                className={`lesson ${completed ? 'done' : ''} ${l === next ? 'next' : ''}`}
                disabled={!unlocked}
                onClick={() => onOpen(l)}
                aria-label={`Lekcja ${i + 1}: ${l.title}${completed ? ' (zaliczona)' : unlocked ? '' : ` (zablokowana – najpierw zalicz lekcję ${i})`}`}
              >
                <span className="num">{completed ? '✔' : unlocked ? i + 1 : '🔒'}</span>
                <span>
                  <strong>{l.title}</strong>
                  <span className="muted">{l.teaches}</span>
                  <span className="muted small">{lessonKind(l)}</span>
                  {!unlocked && <span className="muted small">Odblokuje się po zaliczeniu lekcji {i}.</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="row">
        <button className={`btn ${next ? 'ghost' : 'primary'}`} onClick={onFreePlay}>
          Wolna gra z botami{next ? ' (najlepiej po kursie)' : ''}
        </button>
      </div>

      {completedCount > 0 && !confirmReset && (
        <div className="row">
          <button className="btn ghost" onClick={() => setConfirmReset(true)}>Wyzeruj postęp</button>
        </div>
      )}
      {confirmReset && (
        <div className="goal danger-box">
          Na pewno wyzerować postęp? Wszystkie zaliczone lekcje ({completedCount}) zostaną usunięte i znowu będzie dostępna tylko lekcja 1. Tego nie da się cofnąć.
          <div className="row">
            <button className="btn ghost" onClick={() => setConfirmReset(false)}>Anuluj</button>
            <button
              className="btn danger"
              onClick={() => {
                setConfirmReset(false);
                onReset();
              }}
            >
              Tak, wyzeruj postęp
            </button>
          </div>
        </div>
      )}
      <p className="muted small contact">
        Błąd w kursie albo coś niejasnego? Napisz na <a href="mailto:tejastudio@gmail.com">tejastudio@gmail.com</a>.
      </p>
      {glossary && <Glossary onClose={() => setGlossary(false)} />}
      {rankings && <HandRankings onClose={() => setRankings(false)} />}
    </div>
  );
}

/** Opis przebiegu lekcji wyliczony z jej ustawień – żeby uczeń wiedział, czego się spodziewać. */
function lessonPlan(lesson: Lesson): string[] {
  const plan: string[] = [];
  const names = ['Ty', ...lesson.opponents.map((o) => o.name)];
  const table = `${names.slice(0, -1).join(', ')} i ${names[names.length - 1]}`;
  const chips = lesson.rules.ante > 0 || lesson.rules.betting;
  const watchOnly = !lesson.rules.betting && !lesson.rules.draw && !lesson.quiz;
  if (lesson.autoplay) {
    plan.push('W pokazowym rozdaniu klikasz „Dalej”, a trener objaśnia każdy krok. Nic nie musisz robić.');
    return plan;
  }
  if (lesson.drill) plan.push(`Najpierw ćwiczenie „znajdź układ”: ${pluralPl(lesson.drill.hands.length, 'ręka', 'ręce', 'rąk')} do rozpoznania.`);
  if (lesson.quiz) plan.push(`Potem quiz: ${pluralPl(lesson.handCount, 'rozdanie', 'rozdania', 'rozdań')} – przy każdym wskazujesz zwycięzcę.`);
  else if (watchOnly) plan.push(`${pluralPl(lesson.handCount, 'rozdanie', 'rozdania', 'rozdań')} z odkrytymi kartami – tylko patrzysz.`);
  else plan.push(`${pluralPl(lesson.handCount, 'rozdanie', 'rozdania', 'rozdań')}. Przy stole: ${table}.`);
  if (lesson.revealAll && !watchOnly && !lesson.quiz) plan.push('Karty pozostałych graczy są odkryte.');
  if (chips) plan.push(`Zaczynasz z ${pluralPl(lesson.startingStack, 'żetonem', 'żetonami', 'żetonami')}.`);
  if (!watchOnly && !lesson.quiz) {
    plan.push(
      {
        off: 'Bez podpowiedzi trenera.',
        draw: 'Trener podpowiada przy wymianie kart (podświetla karty do wymiany).',
        full: 'Trener podpowiada każdy ruch i podświetla sugerowany przycisk.',
      }[lesson.coach],
    );
  }
  return plan;
}

export function LessonIntro({
  lesson,
  completed,
  onStart,
  onBack,
}: {
  lesson: Lesson;
  completed: boolean;
  onStart: () => void;
  onBack: () => void;
}) {
  const n = lessonNo(lesson);
  const [panel, setPanel] = useState<'rankings' | 'glossary' | null>(null);
  const hasTerms = lesson.intro.some((p) => splitTerms(p).some((x) => typeof x !== 'string'));
  return (
    <div className="screen narrow">
      <p className="muted">Lekcja {n}</p>
      <h1>{lesson.title}</h1>
      {completed && (
        <p className="pos small">✔ Ta lekcja jest już zaliczona. Możesz ją powtórzyć – słabszy wynik nie cofnie zaliczenia.</p>
      )}
      {lesson.intro.map((p, i) => (
        <p key={i}>
          <RichText text={p} />
        </p>
      ))}
      {hasTerms && (
        <p className="muted small">Podkreślone słowa to pojęcia – najedź na nie lub dotknij, żeby zobaczyć wyjaśnienie.</p>
      )}
      <h2>Jak przebiega lekcja</h2>
      <ul>
        {lessonPlan(lesson).map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <div className="goal">🎯 Cel: {lesson.goalText}</div>
      <div className="row">
        <button className="btn ghost" onClick={onBack}>← Menu</button>
        <button className="btn ghost" onClick={() => setPanel('rankings')}>Układy</button>
        <button className="btn ghost" onClick={() => setPanel('glossary')}>Słowniczek</button>
        <button className="btn primary" onClick={onStart}>
          {lesson.drill ? 'Zacznij od ćwiczenia' : lesson.autoplay ? 'Oglądaj rozdanie' : 'Rozdaj karty'}
        </button>
      </div>
      {panel === 'rankings' && <HandRankings onClose={() => setPanel(null)} />}
      {panel === 'glossary' && <Glossary onClose={() => setPanel(null)} />}
    </div>
  );
}

export function LessonSummary({
  lesson,
  status,
  onRetry,
  onNext,
  onMenu,
  onFreePlay,
  completedCount,
}: {
  lesson: Lesson;
  status: GoalStatus;
  onRetry: () => void;
  onNext?: () => void;
  onMenu: () => void;
  onFreePlay: () => void;
  completedCount: number;
}) {
  const n = lessonNo(lesson);
  const last = n === LESSONS.length;
  const next = LESSONS[n];
  return (
    <div className="screen narrow">
      <p className="muted">
        Lekcja {n}: {lesson.title}
      </p>
      <h1>{status.passed ? (last ? '🎉 Kurs ukończony!' : '🎉 Lekcja zaliczona!') : 'Lekcja niezaliczona'}</h1>
      <p className={status.passed ? 'pos' : 'neg'}>{status.text}</p>
      {status.extra && <p className="muted">{status.extra}</p>}
      {status.passed && !last && (
        <p className="muted small">
          Ukończone lekcje: {completedCount} z {LESSONS.length}.
        </p>
      )}
      {status.passed && last && (
        <p>Znasz już zasady pokera dobieranego. Dalej możesz ćwiczyć w wolnej grze – z wybraną liczbą rywali i poziomem trudności.</p>
      )}
      {!status.passed && (
        <div className="goal">
          💡 <RichText text={status.hint ?? ''} />
          {lesson.drill && (
            <div className="muted small">„Spróbuj jeszcze raz” zaczyna od quizu – ćwiczenie powtórzysz, wchodząc do lekcji z menu.</div>
          )}
          {!last && <div className="muted small">Następna lekcja odblokuje się po zaliczeniu tej.</div>}
        </div>
      )}
      {status.passed && status.details && status.details.length === 0 && (
        <p>🏆 Wszystkie decyzje były dobre{last ? ' – bezbłędny egzamin' : ''}!</p>
      )}
      {status.details && status.details.length > 0 && (
        <>
          <h2>Omówienie błędów</h2>
          <ul className="details">
            {status.details.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </>
      )}
      {lesson.summary.length > 0 && (
        <>
          <h2>{status.passed ? 'Zapamiętaj' : 'Najważniejsze zasady tej lekcji'}</h2>
          <ul>
            {lesson.summary.map((s, i) => (
              <li key={i}>
                <RichText text={s} />
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="row">
        <button className="btn ghost" onClick={onMenu}>Menu</button>
        <button className={`btn ${status.passed ? 'ghost' : 'primary'}`} onClick={onRetry}>
          {status.passed ? 'Zagraj ponownie' : 'Spróbuj jeszcze raz'}
        </button>
        {status.passed && onNext && (
          <button className="btn primary" onClick={onNext}>
            Dalej: lekcja {n + 1} – {next?.title} →
          </button>
        )}
        {status.passed && last && (
          <button className="btn primary" onClick={onFreePlay}>Wolna gra →</button>
        )}
      </div>
    </div>
  );
}

export const LEVEL_PL: Record<BotLevel, string> = { easy: 'Łatwy', medium: 'Średni', hard: 'Trudny' };

const LEVEL_DESC: Record<BotLevel, string> = {
  easy: 'Często sprawdza nawet słabymi rękami, rzadko podbija i prawie nie blefuje. Dobry na początek.',
  medium: 'Gra rozważnie: pasuje ze słabymi rękami, z mocnymi stawia i podbija, czasem blefuje.',
  hard: 'Gra agresywnie, częściej blefuje i zwraca uwagę na to, ile kart wymieniają rywale.',
};

export interface FreeSettings {
  opponents: number;
  level: BotLevel;
  coach: boolean;
}

export function FreePlaySetup({
  initial,
  courseDone,
  onStart,
  onBack,
}: {
  initial?: FreeSettings;
  courseDone: boolean;
  onStart: (settings: FreeSettings) => void;
  onBack: () => void;
}) {
  const [opponents, setOpponents] = useState(initial?.opponents ?? 2);
  const [level, setLevel] = useState<BotLevel>(initial?.level ?? 'medium');
  const [coach, setCoach] = useState(initial?.coach ?? false);
  return (
    <div className="screen narrow">
      <h1>Wolna gra</h1>
      <p>
        <RichText text="Pełne zasady pokera dobieranego, tak jak w kursie: ante 1 żeton, zakłady po 2 przed wymianą i po 4 po wymianie. Zaczynasz z 50 żetonami. Nie ma celu ani limitu rozdań – grasz, dopóki chcesz albo dopóki starczy Ci żetonów." />
      </p>
      <p className="muted small">
        Rywale po przegraniu wszystkich żetonów dostają nowe. Wolna gra nie jest zapisywana – po wyjściu do menu zaczynasz od nowa.
      </p>
      {!courseDone && (
        <div className="goal">
          💡 Nie znasz jeszcze zasad? Zacznij od kursu – wolna gra zakłada, że wiesz, jak przebiega rozdanie i jakie są układy.
        </div>
      )}
      <label className="field">
        Liczba rywali: <strong>{opponents}</strong>
        <input type="range" min={1} max={5} value={opponents} onChange={(e) => setOpponents(+e.target.value)} />
        <span className="muted small">Im więcej rywali, tym silniejszej ręki potrzeba do wygranej.</span>
      </label>
      <div className="field">
        Poziom rywali:
        <div className="row">
          {(['easy', 'medium', 'hard'] as BotLevel[]).map((l) => (
            <button key={l} className={`btn ${level === l ? 'primary' : 'ghost'}`} onClick={() => setLevel(l)}>
              {LEVEL_PL[l]}
            </button>
          ))}
        </div>
        <span className="muted small">{LEVEL_DESC[level]}</span>
      </div>
      <label className="field checkbox">
        <input type="checkbox" checked={coach} onChange={(e) => setCoach(e.target.checked)} /> Podpowiedzi trenera
      </label>
      <p className="muted small">
        <RichText text="Trener podświetla sugerowany ruch i wyjaśnia go, łącznie z procentami (outs i pot odds) – tak jak w lekcji o strategii." />
      </p>
      <div className="row">
        <button className="btn ghost" onClick={onBack}>← Wróć</button>
        <button className="btn primary" onClick={() => onStart({ opponents, level, coach })}>Graj</button>
      </div>
    </div>
  );
}

export interface FreeStats {
  hands: number;
  wins: number;
  balance: number;
  finalStack: number;
  busted: boolean;
  /** Gra zakończona w trakcie rozdania, w którym uczeń już coś zagrał. */
  abandoned: boolean;
}

export function FreePlaySummary({
  stats,
  onAgain,
  onSettings,
  onMenu,
}: {
  stats: FreeStats;
  onAgain: () => void;
  onSettings: () => void;
  onMenu: () => void;
}) {
  const { hands, wins, balance, finalStack, busted, abandoned } = stats;
  return (
    <div className="screen narrow">
      <h1>{busted ? 'Skończyły Ci się żetony' : 'Koniec gry'}</h1>
      {hands === 0 ? (
        <p>Nie rozegrano do końca żadnego rozdania – bilans bez zmian (50 żetonów).</p>
      ) : (
        <ul>
          <li>Rozegrane rozdania: {hands}</li>
          <li>Wygrane rozdania: {wins} z {hands}</li>
          <li>
            Bilans żetonów:{' '}
            <span className={balance >= 0 ? 'pos' : 'neg'}>
              {balance > 0 ? '+' : ''}
              {balance}
            </span>{' '}
            (start: 50, na koniec: {pluralPl(finalStack, 'żeton', 'żetony', 'żetonów')})
          </li>
        </ul>
      )}
      {abandoned && <p className="muted small">Ostatnie, przerwane rozdanie nie jest liczone.</p>}
      {busted && (
        <div className="goal">
          💡 Ze słabą ręką czekaj albo pasuj, a stawiaj dopiero z dobrą. Pomocne mogą być podpowiedzi trenera albo łatwiejsi rywale.
        </div>
      )}
      <div className="row">
        <button className="btn ghost" onClick={onMenu}>Menu</button>
        <button className="btn ghost" onClick={onSettings}>Zmień ustawienia</button>
        <button className="btn primary" onClick={onAgain}>Zagraj jeszcze raz</button>
      </div>
    </div>
  );
}

/** Jednorazowy komunikat przed pierwszym uruchomieniem kursu. */
export function StartNotice({ onAccept }: { onAccept: () => void }) {
  return (
    <div className="screen narrow start-notice">
      <h1>Zanim zaczniesz</h1>
      <p>
        Ten kurs służy wyłącznie nauce zasad pokera. Nie gra się tu na pieniądze. Żetony w kursie nie mają żadnej
        wartości.
      </p>
      <p>Poker traktowany jako gra strategiczna jest dobrym treningiem dla umysłu. Uczy:</p>
      <ul>
        <li>liczenia szans i oceny ryzyka,</li>
        <li>podejmowania decyzji, gdy nie znasz wszystkich informacji,</li>
        <li>panowania nad emocjami, także po przegranej,</li>
        <li>koncentracji i obserwacji rywali.</li>
      </ul>
      <div className="goal notice-warning">
        <p>
          <strong>Pamiętaj:</strong> gra na pieniądze to hazard. Może prowadzić do uzależnienia i poważnych strat. Kurs
          nie zachęca do gry na pieniądze.
        </p>
        <p>W Polsce hazard jest dozwolony tylko dla osób pełnoletnich.</p>
        <p>
          Jeśli hazard staje się problemem dla Ciebie lub bliskiej osoby, zadzwoń pod bezpłatny numer{' '}
          <a href="tel:800199990">800 199 990</a> (Ogólnopolski Telefon Zaufania Uzależnienia).
        </p>
      </div>
      <div className="row">
        <button className="btn primary" onClick={onAccept}>
          Rozumiem, zaczynam
        </button>
      </div>
    </div>
  );
}
