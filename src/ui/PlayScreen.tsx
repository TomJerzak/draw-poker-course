import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ActionType, betSize, GameState, legalActions, pot, toCall } from '../engine/game';
import { CATEGORY_NAME_PL, evaluateHand, type HandValue } from '../engine/handEvaluator';
import { coachAdvice, DEMO_OUTRO, explainEvent, explainShowdown, narrate } from '../lessons/coach';
import {
  act,
  botStep,
  createSession,
  evaluateGoal,
  finishHand,
  GoalStatus,
  HUMAN,
  lessonOver,
  nextHand,
  Session,
} from '../lessons/session';
import { Lesson } from '../lessons/types';
import { pluralPl } from '../engine/cards';
import { FreeStats, LEVEL_PL } from './screens';
import type { Card as CardT } from '../engine/cards';
import { Card } from './Card';
import { AnimatedNumber, ChipStack } from './Chips';
import { HandRankings } from './HandRankings';
import { Glossary, RichText } from './RichText';

interface Props {
  lesson: Lesson;
  seed?: number;
  onFinish: (status: GoalStatus, session: Session) => void;
  onExit: () => void;
  /** Wolna gra: wyjście z gry albo utrata żetonów prowadzi do podsumowania. */
  onFreeEnd?: (stats: FreeStats) => void;
}

const BOT_DELAY = 750;

function revealedSeats(g: GameState, revealAll: boolean): Set<number> {
  if (revealAll) return new Set(g.players.map((_, i) => i));
  const sd = g.events.find((e) => e.type === 'showdown');
  return new Set(sd && sd.type === 'showdown' ? sd.players : []);
}

function lastAction(g: GameState, player: number): { label: string; at: number } | null {
  for (let i = g.events.length - 1; i >= 0; i--) {
    const e = g.events[i];
    if (e.type === 'phase' && e.phase !== 'complete' && e.phase !== 'showdown') break;
    if (e.type === 'action' && e.player === player) {
      const labels: Record<string, string> = { fold: 'Pas', check: 'Czeka', call: 'Sprawdza', bet: 'Stawia', raise: 'Podbija' };
      return labels[e.action.type] ? { label: labels[e.action.type], at: i } : null;
    }
    if (e.type === 'drawn' && e.player === player) {
      return { label: e.discarded.length === 0 ? 'Stoi' : `Wymienia ${e.discarded.length}`, at: i };
    }
  }
  return null;
}

/** Wymiana gracza w bieżącym rozdaniu: odrzucone karty i miejsca w ręce, na które trafiły nowe. */
function drawOf(events: GameState['events'], hand: CardT[], player: number): { slots: number[]; discarded: CardT[] } {
  const ev = events.find((e) => e.type === 'drawn' && e.player === player);
  if (!ev || ev.type !== 'drawn' || ev.discarded.length === 0) return { slots: [], discarded: [] };
  const received = new Set(ev.received.map((c) => c.rank + c.suit));
  const slots = hand.map((c, i) => (received.has(c.rank + c.suit) ? i : -1)).filter((i) => i >= 0);
  return { slots, discarded: ev.discarded };
}

/** Indeks następnego zdarzenia (od `from`), które ma objaśnienie dla początkujących, albo -1. */
function nextExplained(s: Session, from: number): number {
  const names = s.game.players.map((p) => p.name);
  for (let i = from; i < s.game.events.length; i++) {
    if (explainEvent(s.game.events[i], names, s.game)) return i;
  }
  return -1;
}

const AVATAR_COLORS = ['#a0522d', '#3b6ea5', '#6b4c9a', '#2e7d5b', '#9a3b5c'];
/** Odstęp między kolejnymi kartami przy animacji rozdawania. */
const DEAL_STEP_MS = 45;
/** Czas odjazdu odrzuconych kart – nowe karty wjeżdżają dopiero po nim. */
const DISCARD_MS = 320;

/** Położenie rywala na łuku nad stołem (w procentach szerokości i wysokości stołu). */
function seatPosition(k: number, n: number): { x: number; y: number } {
  const theta = Math.PI * (1 - (k + 1) / (n + 1));
  return { x: 50 + 42 * Math.cos(theta), y: 44 - 38 * Math.sin(theta) };
}

/** Którą z kolei kartę w rundzie rozdawania dostaje gracz (od lewej strony rozdającego). */
function dealOrder(player: number, dealer: number, n: number): number {
  return (player - dealer - 1 + n) % n;
}

/** Miejsce na żetony zakładu: między graczem a środkiem stołu. */
function betSpotPosition(player: number, opponents: number): CSSProperties {
  if (player === HUMAN) return { left: '50%', top: 'calc(100% - 238px)' };
  const p = seatPosition(player - 1, opponents);
  // Rywal z boku: żetony pod jego miejscem, przesunięte po skosie w stronę środka stołu.
  if (Math.abs(p.x - 50) > 5) return { left: `${p.x + (50 - p.x) * 0.25}%`, top: `calc(${p.y}% + 190px)` };
  // Rywal pośrodku: tuż pod jego miejscem.
  return { left: `${p.x}%`, top: `calc(${p.y}% + 168px)` };
}

/** Dokąd lecą żetony wygranej: do miejsca zwycięzcy. */
function winTarget(player: number, opponents: number): CSSProperties {
  if (player === HUMAN) return { ['--to-x' as string]: '50%', ['--to-y' as string]: 'calc(100% - 40px)' };
  const p = seatPosition(player - 1, opponents);
  return { ['--to-x' as string]: `${p.x}%`, ['--to-y' as string]: `calc(${p.y}% + 30px)` };
}

/** Położenie krążka rozdającego: obok awatara rozdającego. */
function dealerPuckPosition(dealer: number, opponents: number): CSSProperties {
  if (dealer === HUMAN) return { left: 'calc(50% + 150px)', top: 'calc(100% - 30px)' };
  const p = seatPosition(dealer - 1, opponents);
  return { left: `calc(${p.x}% + 44px)`, top: `calc(${p.y}% + 22px)` };
}

/** Czas animacji ante (wjazd i zsunięcie do puli) – zgodny ze styles.css. */
const ANTE_ANIM_MS = 900;

/** Czy żetony zakładów i ante są animowane na stole (szeroki ekran, bez ograniczenia ruchu). */
function tableChipsAnimate(): boolean {
  try {
    return !window.matchMedia('(max-width: 760px)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Zakłady z rundy licytacji, która właśnie się zakończyła (np. ostatnim sprawdzeniem rywala).
 * Silnik od razu przenosi je do puli, więc odtwarzamy je z zapisu akcji, żeby pokazać,
 * jak żetony trafiają do puli. Gdy rozdanie skończyło się pasem, zwraca null.
 */
function closedRoundBets(events: GameState['events']): { start: number; bets: number[]; last: number } | null {
  if (events.some((e) => e.type === 'win' && e.uncontested)) return null;
  let start = -1;
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.type === 'phase' && (e.phase === 'bet1' || e.phase === 'bet2')) {
      start = i;
      break;
    }
  }
  if (start < 0) return null;
  const end = events.findIndex((e, i) => i > start && e.type === 'phase');
  if (end < 0) return null;
  const bets: number[] = [];
  let last = -1;
  for (let i = start + 1; i < end; i++) {
    const e = events[i];
    if (e.type !== 'action') continue;
    bets[e.player] = (bets[e.player] ?? 0) + e.amount;
    last = e.player;
  }
  return bets.some((b) => b > 0) ? { start, bets, last } : null;
}

/** Nazwa układu w dwóch częściach: rodzaj układu (wyróżniony) i szczegół,
 * np. „Dwie pary” + „króli i waletów”. Tekst jest ten sam co w pełnej nazwie.
 */
function HandLabel({ value }: { value: HandValue }) {
  const kind = CATEGORY_NAME_PL[value.category];
  const detail = (value.name.startsWith(kind) ? value.name.slice(kind.length) : '')
    .replace(/^[\s:]+/, '')
    .replace(/^\((.*)\)$/, '$1')
    .trim();
  return (
    <>
      <span className="hn-kind">{kind}</span>
      {detail && <span className="hn-detail">{detail}</span>}
    </>
  );
}

function DealerBadge() {
  return (
    <span className="term dealer-term" tabIndex={0}>
      <span className="dealer">D</span>
      <span className="tip" role="tooltip">
        <strong>Rozdający (dealer button):</strong> w każdym rozdaniu ktoś inny. Licytację zaczyna gracz po jego lewej stronie, a rozdający decyduje ostatni.
      </span>
    </span>
  );
}

export function PlayScreen({ lesson, seed, onFinish, onExit, onFreeEnd }: Props) {
  const [session, setSession] = useState<Session>(() => createSession(lesson, seed));
  const [selected, setSelected] = useState<number[]>([]);
  const [quizPick, setQuizPick] = useState<number | 'tie' | null>(null);
  const [panel, setPanel] = useState<'rankings' | 'glossary' | null>(null);
  // Pokazowe rozdanie: ile zdarzeń już objaśniono i jaki tekst pokazuje trener.
  const [shown, setShown] = useState(() => {
    const i = lesson.autoplay ? nextExplained(session, 0) : -1;
    return i >= 0 ? i + 1 : 0;
  });
  const [autoText, setAutoText] = useState<string | null>(() => {
    if (!lesson.autoplay) return null;
    const i = nextExplained(session, 0);
    return i >= 0 ? explainEvent(session.game.events[i], session.game.players.map((p) => p.name), session.game) : null;
  });
  const [humanExplained, setHumanExplained] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [maxNote, setMaxNote] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const g = session.game;
  const names = g.players.map((p) => p.name);
  const free = lesson.handCount === Infinity;
  const auto = !!lesson.autoplay;
  const script = lesson.scripted?.[session.handNo];
  const complete = g.phase === 'complete';
  const autoDone = !auto || (complete && nextExplained(session, shown) < 0);
  const awaitingQuiz = complete && lesson.quiz && quizPick === null;
  const chips = lesson.rules.ante > 0 || lesson.rules.betting;
  // Ante doliczamy do wyświetlanej puli dopiero, gdy jego żetony dojadą na środek stołu.
  const anteTotal = (auto ? g.events.slice(0, shown) : g.events).reduce((s, e) => (e.type === 'ante' ? s + e.amount : s), 0);
  const [anteLanded, setAnteLanded] = useState(-1);
  useEffect(() => {
    if (anteTotal <= 0) return;
    const t = setTimeout(() => setAnteLanded(session.handNo), ANTE_ANIM_MS);
    return () => clearTimeout(t);
  }, [session.handNo, anteTotal > 0]);
  const anteInFlight =
    chips &&
    anteTotal > 0 &&
    anteLanded !== session.handNo &&
    !complete &&
    !g.events.some((e) => e.type === 'action' || e.type === 'drawn') &&
    tableChipsAnimate();
  const shownPot = pot(g) - (anteInFlight ? anteTotal : 0);
  const endFree = () => {
    const done = complete ? session.results.length + 1 : session.results.length;
    const wins = session.results.filter((r) => r.humanWon).length + (complete && g.winners.includes(HUMAN) ? 1 : 0);
    // Przerwane rozdanie nie jest liczone – żetony z puli wracają do bilansu sprzed rozdania.
    const finalStack = complete ? me.stack : me.stack + me.contributed;
    onFreeEnd?.({
      hands: done,
      wins,
      balance: finalStack - lesson.startingStack,
      finalStack,
      busted: finalStack <= 0,
      abandoned: !complete && g.events.some((e) => (e.type === 'action' || e.type === 'drawn') && e.player === HUMAN),
    });
  };
  const freeSubtitle = free
    ? `${pluralPl(lesson.opponents.length, 'rywal', 'rywali', 'rywali')} · poziom ${LEVEL_PL[lesson.opponents[0].level].toLowerCase()} · ${lesson.coach === 'off' ? 'bez podpowiedzi' : 'z podpowiedziami'}`
    : '';

  // Ruchy botów z opóźnieniem, żeby uczeń widział, co się dzieje.
  useEffect(() => {
    if (auto || g.toAct === null || g.toAct === HUMAN) return;
    const t = setTimeout(() => setSession(botStep(session)), BOT_DELAY);
    return () => clearTimeout(t);
  }, [session, g.toAct, auto]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [g.events.length, shown]);

  const advice = useMemo(
    () => (auto ? null : coachAdvice(g, HUMAN, lesson.coach, lesson.coachOdds)),
    [g, lesson.coach, lesson.coachOdds, auto],
  );
  const acts = auto ? [] : legalActions(g, HUMAN);
  const me = g.players[HUMAN];
  const revealed = revealedSeats(g, !!lesson.revealAll);
  const visibleEvents = auto ? g.events.slice(0, shown) : g.events;
  const log = visibleEvents
    .flatMap((e) => {
      const line = narrate(e, names);
      // Po wymianie ucznia: jaki układ ma teraz i czy wymiana go poprawiła.
      if (e.type === 'drawn' && e.player === HUMAN && e.discarded.length > 0) {
        const dealt = g.events.find((d) => d.type === 'deal' && d.player === HUMAN);
        const before = dealt && dealt.type === 'deal' ? evaluateHand(dealt.cards).category : 0;
        const now = evaluateHand(g.players[HUMAN].hand);
        return [line, `Teraz masz: ${now.name}${now.category > before ? ' – wymiana poprawiła układ!' : '.'}`];
      }
      return [line];
    })
    .filter((x): x is string => !!x);
  if (session.rebuys.length) {
    const many = session.rebuys.length > 1;
    log.unshift(
      `${session.rebuys.join(' i ')} ${many ? 'nie mają' : 'nie ma'} już żetonów i ${many ? 'dostają' : 'dostaje'} nowe (${lesson.startingStack}).`,
    );
  }
  const myDraw = visibleEvents.find((e) => e.type === 'drawn' && e.player === HUMAN);
  const newCodes = new Set(myDraw && myDraw.type === 'drawn' ? myDraw.received.map((c) => c.rank + c.suit) : []);
  const myDrew = drawOf(visibleEvents, me.hand, HUMAN);
  const myHand = evaluateHand(me.hand);
  const closed = closedRoundBets(g.events);
  // Ante na początku rozdania: żeton każdego gracza wjeżdża przed niego i zsuwa się do puli
  // (po animacji element zostaje niewidoczny do końca rozdania).
  const antes = visibleEvents.flatMap((e) => (e.type === 'ante' && e.amount > 0 ? [e] : []));
  const wonAmount = g.events.reduce((s, e) => (e.type === 'win' ? s + e.amount : s), 0);
  const showdownText = complete ? explainShowdown(g, names) : null;

  /** Krok pokazowego rozdania. */
  const autoStep = () => {
    const i = nextExplained(session, shown);
    if (i >= 0) {
      setShown(i + 1);
      const ev = g.events[i];
      let text = explainEvent(ev, names, g);
      if (ev.type === 'win') text = [text, showdownText, DEMO_OUTRO].filter(Boolean).join(' ');
      setAutoText(text);
      return;
    }
    if (g.toAct === null) return;
    let next: Session;
    if (g.toAct === HUMAN) {
      const adv = coachAdvice(g, HUMAN, 'full');
      if (!adv) return;
      if (!humanExplained) {
        setHumanExplained(true);
        setAutoText(`Twoja kolej. W tym rozdaniu trener gra za Ciebie i tłumaczy swój ruch: ${adv.text}`);
        return;
      }
      setHumanExplained(false);
      next = act(
        session,
        adv.suggested === 'draw' ? { type: 'draw', discard: adv.discard ?? [] } : ({ type: adv.suggested } as never),
      );
    } else {
      next = botStep(session);
    }
    setSession(next);
    const j = nextExplained(next, shown);
    if (j >= 0) {
      setShown(j + 1);
      const ev = next.game.events[j];
      let text = explainEvent(ev, names, next.game);
      const sd = next.game.phase === 'complete' ? explainShowdown(next.game, names) : null;
      if (ev.type === 'win') text = [text, sd, DEMO_OUTRO].filter(Boolean).join(' ');
      setAutoText(text);
    }
  };

  const doAction = (type: ActionType) => {
    if (type === 'draw') {
      setSession(act(session, { type: 'draw', discard: selected }));
      setSelected([]);
      setMaxNote(false);
    } else setSession(act(session, { type } as never));
  };

  const toggle = (i: number) => {
    if (!acts.includes('draw')) return;
    if (selected.includes(i)) {
      setSelected(selected.filter((x) => x !== i));
      setMaxNote(false);
    } else if (selected.length < g.rules.maxDraw) {
      setSelected([...selected, i]);
    } else {
      setMaxNote(true);
    }
  };

  const continueGame = () => {
    const done = finishHand(session, lesson.quiz ? (quizPick ?? undefined) : undefined);
    setQuizPick(null);
    setSelected([]);
    if (lessonOver(done)) {
      onFinish(evaluateGoal(done), done);
      return;
    }
    setSession(nextHand(done));
  };

  const quizCorrect =
    quizPick === null
      ? null
      : quizPick === 'tie'
        ? g.winners.length > 1
        : g.winners.length === 1 && g.winners[0] === quizPick;

  const owe = acts.length ? toCall(g, HUMAN) : 0;
  const label = (t: ActionType): string => {
    switch (t) {
      case 'check': return 'Czekaj (check)';
      case 'bet': return `Postaw ${betSize(g)} (bet)`;
      case 'call': return `Sprawdź – dopłać ${owe} (call)`;
      case 'raise': return `Podbij – dopłać ${owe + betSize(g)} (raise)`;
      case 'fold': return 'Pasuj (fold)';
      case 'draw': return selected.length ? `Wymień ${pluralPl(selected.length, 'kartę', 'karty', 'kart')}` : 'Stój (nie wymieniaj)';
    }
  };

  // W pokazowym rozdaniu gra jest o krok przed objaśnieniami trenera – pokazujemy fazę z ostatniego objaśnionego zdarzenia.
  let shownPhase: GameState['phase'] | 'ante' = g.phase;
  if (auto) {
    const lastPhase = [...g.events.slice(0, shown)].reverse().find((e) => e.type === 'phase');
    shownPhase = lastPhase && lastPhase.type === 'phase' ? lastPhase.phase : 'ante';
    if (shownPhase === 'complete' && !autoDone) shownPhase = 'showdown';
  }
  const phaseLabel = {
    ante: 'Wpłata ante',
    bet1: 'Licytacja przed wymianą',
    draw: 'Wymiana kart',
    bet2: 'Licytacja po wymianie',
    showdown: 'Odkrycie kart',
    complete: awaitingQuiz ? 'Kto wygrywa?' : 'Koniec rozdania',
  }[shownPhase];

  // Bilans zmienia się dopiero po zakończeniu rozdania – w trakcie pokazujemy stan sprzed rozdania,
  // żeby żetony wpłacone do puli nie wyglądały na już przegrane.
  const stackDiff = (complete ? me.stack : me.stack + me.contributed) - lesson.startingStack;
  const myWin = g.events.reduce((sum, e) => (e.type === 'win' && e.player === HUMAN ? sum + e.amount : sum), 0);
  const steps: string[] = [];
  if (lesson.rules.ante > 0) steps.push('Ante');
  if (lesson.rules.betting) steps.push('Licytacja');
  if (lesson.rules.draw) steps.push('Wymiana');
  if (lesson.rules.betting && lesson.rules.draw) steps.push('Licytacja');
  steps.push('Odkrycie kart');
  const stepIndex: Record<string, number> = {};
  {
    let k = lesson.rules.ante > 0 ? 1 : 0;
    if (lesson.rules.betting) stepIndex.bet1 = k++;
    if (lesson.rules.draw) stepIndex.draw = k++;
    if (lesson.rules.betting && lesson.rules.draw) stepIndex.bet2 = k++;
    stepIndex.showdown = stepIndex.complete = k;
  }
  const currentStep = shownPhase === 'ante' ? 0 : (stepIndex[shownPhase] ?? 0);
  // Notka lekcji jest widoczna, dopóki uczeń nie wykona pierwszego ruchu w rozdaniu.
  const humanMoved = g.events.some((e) => (e.type === 'action' || e.type === 'drawn') && e.player === HUMAN);
  let coachText: string | null | undefined;
  if (auto) coachText = autoText;
  else if (complete) {
    if (awaitingQuiz) coachText = 'Kto wygrywa to rozdanie? Porównaj układy i wybierz odpowiedź. Nazwy układów pokażemy po odpowiedzi.';
    else {
      const answer =
        g.winners.length > 1 ? 'to remis' : g.winners[0] === HUMAN ? 'wygrywasz Ty' : `wygrywa ${names[g.winners[0]]}`;
      const verdict = quizCorrect === null ? '' : quizCorrect ? 'Dobrze! ' : `Niestety nie – ${answer}. `;
      const uncontested = g.events.some((e) => e.type === 'win' && e.uncontested);
      const foldText = !uncontested
        ? ''
        : g.winners.includes(HUMAN)
          ? 'Wszyscy pozostali gracze spasowali – pula jest Twoja bez odkrywania kart.'
          : me.folded
            ? `Po Twoim pasie ${names[g.winners[0]]} zabiera pulę bez odkrywania kart. Żetony wpłacone przez Ciebie do puli przepadają.`
            : `${names[g.winners[0]]} zabiera pulę, bo pozostali gracze spasowali.`;
      const reachedShowdown = g.events.some((e) => e.type === 'showdown');
      const afterFits = (script?.afterRequires ?? []).every((r) =>
        r === 'showdown' ? reachedShowdown : g.winners.includes(HUMAN),
      );
      coachText = [verdict + (showdownText ?? foldText), afterFits ? script?.after : undefined].filter(Boolean).join(' ');
    }
  } else {
    coachText = [!humanMoved ? script?.before : undefined, g.toAct === HUMAN ? advice?.text : undefined]
      .filter(Boolean)
      .join(' ');
  }

  return (
    <div className="play">
      <header className="topbar">
        <button className="btn ghost" onClick={() => setConfirmExit(true)}>{free ? '← Zakończ grę' : '← Menu'}</button>
        <div className="title">
          <strong>{lesson.title}</strong>
          <span className="muted">
            {free ? `Rozdanie ${session.handNo + 1} · ${freeSubtitle}` : `Rozdanie ${session.handNo + 1}/${lesson.handCount}`}
            {lesson.goalText && ` · Cel: ${lesson.goalText}`}
          </span>
        </div>
        {lesson.showRankings && (
          <button className="btn ghost" onClick={() => setPanel('rankings')}>Układy</button>
        )}
        <button className="btn ghost" onClick={() => setPanel('glossary')}>Słowniczek</button>
      </header>
      {confirmExit && (
        <div className="goal danger-box">
          {free
            ? `Zakończyć grę? Zobaczysz podsumowanie, ale tej gry nie da się wznowić.${complete ? '' : ' Bieżące rozdanie nie zostanie policzone.'}`
            : 'Przerwać lekcję? Ta próba przepadnie i przy następnym podejściu zaczniesz od początku. Zaliczone wcześniej lekcje zostają.'}
          <div className="row">
            <button className="btn primary" onClick={() => setConfirmExit(false)}>Graj dalej</button>
            <button className="btn danger" onClick={free ? endFree : onExit}>{free ? 'Zakończ grę' : 'Przerwij lekcję'}</button>
          </div>
        </div>
      )}

      <section className={`table table-oval opp-${g.players.length - 1}`}>
        <div className="rail" aria-hidden>
          <div className="felt" />
        </div>

        {g.players.map((p, i) => {
          if (i === HUMAN) return null;
          const pos = seatPosition(i - 1, g.players.length - 1);
          const order = dealOrder(i, g.dealer, g.players.length);
          const action = lastAction(g, i);
          const drew = drawOf(visibleEvents, p.hand, i);
          // W quizie zwycięzca jest wyróżniony dopiero po odpowiedzi, żeby nie zdradzać wyniku.
          const isWinner = complete && autoDone && !awaitingQuiz && g.winners.includes(i);
          return (
            <div
              key={p.id}
              className={`seat opp ${g.toAct === i ? 'active' : ''} ${p.folded ? 'folded' : ''} ${isWinner ? 'winner' : ''}`}
              style={{ ['--x' as string]: `${pos.x}%`, ['--y' as string]: `${pos.y}%` }}
            >
              {action && (
                <div key={`${session.handNo}-${action.at}`} className="action-bubble">
                  {action.label}
                </div>
              )}
              <div className="avatar" style={{ ['--av' as string]: AVATAR_COLORS[(i - 1) % AVATAR_COLORS.length] }} aria-hidden>
                {p.name}
              </div>
              <div className="seat-head">
                {/* Imię widać w kole – tu zostaje tylko dla czytników ekranu. */}
                <span className="name sr-only">{p.name}</span>
                {g.dealer === i && (
                  <span className="dealer-inline">
                    <DealerBadge />
                  </span>
                )}
              </div>
              <div className={`cards-row opp-fan ${revealed.has(i) ? 'revealed' : ''}`}>
                {p.hand.map((c, k) => (
                  <Card
                    key={`${session.handNo}-${c.rank}${c.suit}`}
                    card={c}
                    faceDown={!revealed.has(i)}
                    small
                    flippable
                    enter={drew.slots.includes(k) ? 'draw' : 'deal'}
                    delay={drew.slots.includes(k) ? DISCARD_MS : (k * g.players.length + order) * DEAL_STEP_MS}
                    style={{ ['--fr' as string]: `${(k - 2) * 5}deg` }}
                  />
                ))}
                {/* Odrzucone karty odjeżdżają w stronę środka stołu (rewersem do góry). */}
                {drew.slots.map((slot) => (
                  <div
                    key={`ghost-${session.handNo}-${slot}`}
                    className="discard-ghost opp-ghost"
                    style={{ ['--slot' as string]: slot - 2 }}
                    aria-hidden
                  >
                    <Card faceDown small />
                  </div>
                ))}
              </div>
              <div className="seat-info">
                {chips && (
                  <span className="stack-amount">
                    <ChipStack amount={p.stack} max={5} small /> <AnimatedNumber value={p.stack} />
                  </span>
                )}
                {p.betThisRound > 0 && !complete && <span className="bet">w tej rundzie: {p.betThisRound}</span>}
                {/* Karty odkryte w trakcie rozdania: nazwa układu obok stosu, żeby pod nim było miejsce na żetony i pulę. */}
                {revealed.has(i) && !awaitingQuiz && !complete && (
                  <span className="hand-name inline">
                    <HandLabel value={p.handValue ?? evaluateHand(p.hand)} />
                  </span>
                )}
              </div>
              {revealed.has(i) && !awaitingQuiz && complete && (
                <div className={`hand-name ${isWinner ? 'win' : ''}`}>
                  <HandLabel value={p.handValue ?? evaluateHand(p.hand)} />
                </div>
              )}
            </div>
          );
        })}

        {/* Żetony postawione w bieżącej rundzie – leżą przed graczem, bliżej środka stołu. */}
        {chips &&
          !complete &&
          g.players.map((p, i) =>
            p.betThisRound > 0 ? (
              <div
                key={`bet-${session.handNo}-${g.phase}-${i}-${p.betThisRound}`}
                className={`bet-spot ${i === HUMAN ? 'from-bottom' : 'from-top'}`}
                style={betSpotPosition(i, g.players.length - 1)}
                aria-hidden
              >
                <ChipStack amount={p.betThisRound} mixed max={8} perColumn={4} small />
                <span className="bet-amount">{p.betThisRound}</span>
              </div>
            ) : null,
          )}

        {/* Ante: każdy wpłaca do puli na początku rozdania. */}
        {chips &&
          !complete &&
          antes.map((e) => (
            <div
              key={`ante-${session.handNo}-${e.player}`}
              className={`bet-spot ante ${e.player === HUMAN ? 'from-bottom' : 'from-top'}`}
              style={betSpotPosition(e.player, g.players.length - 1)}
              aria-hidden
            >
              <ChipStack amount={e.amount} mixed max={8} perColumn={4} small />
              <span className="bet-amount">{e.amount}</span>
            </div>
          ))}

        {/* Koniec rundy licytacji: żetony całej rundy na chwilę leżą na stole, a potem zsuwają się do puli. */}
        {chips &&
          closed &&
          closed.bets.map((amount, i) =>
            amount > 0 ? (
              <div
                key={`close-${session.handNo}-${closed.start}-${i}`}
                className={`bet-spot closing ${complete ? 'at-end' : i === closed.last ? `just-in ${i === HUMAN ? 'from-bottom' : 'from-top'}` : ''}`}
                style={betSpotPosition(i, g.players.length - 1)}
                aria-hidden
              >
                <ChipStack amount={amount} mixed max={8} perColumn={4} small />
                <span className="bet-amount">{amount}</span>
              </div>
            ) : null,
          )}

        {/* Po rozdaniu pula „przelatuje” do zwycięzcy (przy remisie – do każdego ze zwycięzców). */}
        {chips &&
          complete &&
          autoDone &&
          wonAmount > 0 &&
          g.winners.map((w) => (
            <div key={`win-${session.handNo}-${w}`} className={`win-fly ${closed ? 'after-bets' : ''}`} style={winTarget(w, g.players.length - 1)} aria-hidden>
              <ChipStack amount={Math.floor(wonAmount / g.winners.length)} mixed max={16} perColumn={4} />
            </div>
          ))}

        {/* Krążek rozdającego – na szerokim ekranie płynnie przechodzi do następnego gracza. */}
        <div className="dealer-puck" style={dealerPuckPosition(g.dealer, g.players.length - 1)}>
          <DealerBadge />
        </div>

        <div className="center">
          {chips && !complete && shownPot > 0 && (
            <ChipStack key={`pot-${session.handNo}-${shownPot}`} amount={shownPot} mixed max={16} perColumn={4} className="pot-chips" />
          )}
          {chips && <div className="pot">Pula: {complete ? wonAmount : shownPot}</div>}
          <div className="phase">{phaseLabel}</div>
          {steps.length >= 3 && (
            <ol className="steps" aria-label="Etapy rozdania">
              {steps.map((st, k) => (
                <li key={k} className={k === currentStep ? 'current' : k < currentStep ? 'past' : ''}>
                  {st}
                </li>
              ))}
            </ol>
          )}
        </div>

        <div
          className={`seat me ${g.toAct === HUMAN ? 'active' : ''} ${me.folded ? 'folded' : ''} ${
            complete && autoDone && !awaitingQuiz && g.winners.includes(HUMAN) ? 'winner' : ''
          }`}
        >
          {/* Odrzucone karty odjeżdżają w stronę środka stołu, zanim wjadą nowe. */}
          <div className="discard-layer" aria-hidden>
            {myDrew.slots.map((slot, k) => (
              <div
                key={`ghost-${session.handNo}-${slot}`}
                className="discard-ghost"
                style={{ ['--slot' as string]: slot - 2, ['--fr' as string]: `${(slot - 2) * 4}deg` }}
              >
                <Card card={myDrew.discarded[k]} />
              </div>
            ))}
          </div>
          <div className="cards-row big hand-fan">
            {me.hand.map((c, i) => (
              <Card
                key={`${session.handNo}-${c.rank}${c.suit}`}
                card={c}
                selected={selected.includes(i)}
                hinted={acts.includes('draw') && !!advice?.discard?.includes(i)}
                isNew={newCodes.has(c.rank + c.suit)}
                onClick={acts.includes('draw') ? () => toggle(i) : undefined}
                enter={newCodes.has(c.rank + c.suit) ? 'draw' : 'deal'}
                delay={newCodes.has(c.rank + c.suit) ? DISCARD_MS : (i * g.players.length + dealOrder(HUMAN, g.dealer, g.players.length)) * DEAL_STEP_MS}
                style={{ ['--fr' as string]: `${(i - 2) * 4}deg`, ['--fy' as string]: `${Math.abs(i - 2) * 5}px` }}
              />
            ))}
          </div>
          <div className="me-bar">
            <div className="avatar me-avatar" aria-hidden>
              Ty
            </div>
            <div className="me-info">
              <div className="seat-head">
                <span className="name sr-only">Ty</span>
                {g.dealer === HUMAN && (
                  <span className="dealer-inline">
                    <DealerBadge />
                  </span>
                )}
                {chips && (
                  <span>
                    <span className="stack-amount">
                      <ChipStack amount={me.stack} max={5} small /> <AnimatedNumber value={me.stack} />
                    </span>{' '}
                    <span className={stackDiff >= 0 ? 'pos' : 'neg'}>
                      (bilans {stackDiff > 0 ? '+' : stackDiff < 0 ? '−' : ''}
                      {Math.abs(stackDiff)})
                    </span>
                    {me.betThisRound > 0 && !complete && <span className="bet"> · w tej rundzie: {me.betThisRound}</span>}
                  </span>
                )}
              </div>
              {!awaitingQuiz && (
                <div className={`hand-name inline ${complete && autoDone && g.winners.includes(HUMAN) ? 'win' : ''}`}>
                  <HandLabel value={myHand} />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {coachText && (
        <div className={`coach ${quizCorrect === true ? 'ok' : quizCorrect === false ? 'bad' : ''}`}>
          <span className="coach-icon" aria-hidden>🎓</span>
          <p><RichText text={coachText} /></p>
        </div>
      )}

      <section className="actions">
        {auto && !autoDone && (
          <button className="btn primary" onClick={autoStep}>Dalej →</button>
        )}

        {acts.includes('draw') && (
          <p className="hint">
            {maxNote
              ? `Możesz wymienić najwyżej ${pluralPl(g.rules.maxDraw, 'kartę', 'karty', 'kart')} – odznacz którąś, żeby wybrać inną.`
              : `Kliknij karty do wymiany (najwyżej ${g.rules.maxDraw}). Kliknij ponownie, żeby odznaczyć.`}
            {advice?.discard && (
              <button className="btn link" onClick={() => setSelected(advice.discard!)}>
                Zaznacz sugerowane
              </button>
            )}
          </p>
        )}
        {acts.map((t) => (
          <button
            key={t}
            className={`btn ${t === 'fold' ? 'danger' : 'primary'} act act-${t} ${advice?.suggested === t ? 'suggested' : ''}`}
            onClick={() => doAction(t)}
          >
            {label(t)}
          </button>
        ))}

        {awaitingQuiz && (
          <>
            <button className="btn primary" onClick={() => setQuizPick(HUMAN)}>Ty</button>
            {g.players.slice(1).map((p, i) => (
              <button key={p.id} className="btn primary" onClick={() => setQuizPick(i + 1)}>{p.name}</button>
            ))}
            <button className="btn primary" onClick={() => setQuizPick('tie')}>Remis</button>
          </>
        )}

        {complete && autoDone && !awaitingQuiz && (
          <div className="result">
            <span>
              {g.winners.length > 1
                ? `Remis: ${g.winners.map((w) => names[w]).join(' i ')} ${g.winners.includes(HUMAN) ? 'dzielicie' : 'dzielą'} pulę.`
                : g.winners.includes(HUMAN)
                  ? chips && myWin > 0
                    ? `Wygrywasz ${pluralPl(myWin, 'żeton', 'żetony', 'żetonów')}!`
                    : 'Wygrywasz to rozdanie!'
                  : `Wygrywa ${names[g.winners[0]]}.`}
            </span>
            {free && me.stack <= 0 ? (
              <button className="btn primary" onClick={endFree}>Skończyły Ci się żetony – zobacz podsumowanie</button>
            ) : (
              <button className="btn primary" onClick={continueGame}>
                {!free && session.results.length + 1 >= lesson.handCount ? 'Zakończ lekcję' : 'Następne rozdanie →'}
              </button>
            )}
          </div>
        )}
        {!auto && !complete && g.toAct !== HUMAN && <p className="muted">Teraz ruch: {names[g.toAct ?? 0]}…</p>}
      </section>

      <details className="log" open>
        <summary>Przebieg rozdania</summary>
        <div ref={logRef} className="log-body">
          {(awaitingQuiz ? log.filter((l) => !/^Wygryw/.test(l) && !/ wygrywa /.test(l)) : log).map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      </details>

      {panel === 'rankings' && <HandRankings onClose={() => setPanel(null)} />}
      {panel === 'glossary' && <Glossary onClose={() => setPanel(null)} />}
    </div>
  );
}
