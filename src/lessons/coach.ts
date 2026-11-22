import { adviseDraw, drawingTo, handStrength } from '../bots/strategy';
import { compareHands, evaluateHand } from '../engine/handEvaluator';
import { Action, GameEvent, GameState, legalActions, pot, toCall } from '../engine/game';
import { cardLabel, pluralPl } from '../engine/cards';
import { explainComparison } from './explain';
import { CoachMode } from './types';

export interface Advice {
  text: string;
  /** Akcja sugerowana przez trenera (do podświetlenia przycisku). */
  suggested?: Action['type'];
  /** Karty sugerowane do wymiany. */
  discard?: number[];
}

/**
 * Rada trenera dla gracza, na którego ruch czekamy.
 * `showOdds` – czy tłumaczyć decyzję procentami (pot odds); początkujący dostają prosty opis.
 */
export function coachAdvice(state: GameState, player: number, mode: CoachMode, showOdds = false): Advice | null {
  if (mode === 'off' || state.toAct !== player) return null;
  const me = state.players[player];
  const acts = legalActions(state, player);

  if (acts.includes('draw')) {
    const a = adviseDraw(me.hand, state.rules.maxDraw);
    return { text: a.reason, suggested: 'draw', discard: a.discard };
  }
  if (mode !== 'full') return null;

  const beforeDraw = state.phase === 'bet1';
  const handName = evaluateHand(me.hand).name;
  const drawing = beforeDraw && state.rules.draw ? drawingTo(me.hand) : null;
  const opponents = state.players.filter((p, i) => i !== player && !p.folded).length;
  let adj = handStrength(me.hand, beforeDraw) - (opponents - 1) * 0.07;
  const owe = toCall(state, player);

  // Rywal, który „stoi” (nie wymienia kart), zwykle ma gotowy układ – trener gra wtedy ostrożniej i mówi dlaczego.
  const standPat =
    state.phase === 'bet2'
      ? state.players.filter((p, i) => i !== player && !p.folded && p.drawCount === 0).map((p) => p.name)
      : [];
  let warn = '';
  if (standPat.length > 0) {
    adj -= 0.15;
    const many = standPat.length > 1;
    warn = `${standPat.join(' i ')} ${many ? 'grają' : 'gra'} bez wymiany kart („${many ? 'stoją' : 'stoi'}”) – ${many ? 'pewnie mają gotowe układy albo blefują' : 'pewnie ma gotowy układ albo blefuje'}, więc ostrożnie. `;
  }

  // Co mówi wymiana rywali (poza „stojącymi”, o których jest osobne ostrzeżenie).
  const DRAW_MEANS: Record<number, string> = {
    1: 'dwie pary albo dobór do koloru lub strita',
    2: 'zwykle trójka',
    3: 'zwykle para',
  };
  const reads =
    state.phase === 'bet2'
      ? state.players
          .filter((p, i) => i !== player && !p.folded && (p.drawCount ?? 0) > 0)
          .map((p) => `${p.name} – ${pluralPl(p.drawCount!, 'karta', 'karty', 'kart')} (${DRAW_MEANS[p.drawCount!]})`)
      : [];
  const readText = reads.length ? ` Wymiana rywali: ${reads.join('; ')}.` : '';
  const withReads = (a: Advice): Advice => ({ ...a, text: a.text + readText });

  if (owe === 0) {
    // Próg zakładu: od pary waletów w grze jeden na jednego (z większą liczbą rywali potrzeba więcej).
    if (adj >= 0.57 && acts.includes('bet')) {
      const rivals =
        opponents === 1
          ? 'rywal musi dopłacić albo spasować'
          : 'rywale muszą dopłacić albo spasować';
      return withReads({ text: `${warn}${handName} – dobra ręka. Postaw zakład (bet): ${rivals}.`, suggested: 'bet' });
    }
    return withReads({
      text: `${warn}Nikt jeszcze nie postawił – czekaj (check), to nic nie kosztuje. Pasując teraz, oddajesz szansę na pulę, a nic nie oszczędzasz.`,
      suggested: 'check',
    });
  }

  const total = pot(state) + owe;
  const needed = Math.round((owe / total) * 100);
  const odds = (verdict: string) =>
    showOdds
      ? ` Pot odds: dopłacasz ${owe} do puli wartej wtedy ${pluralPl(total, 'żeton', 'żetony', 'żetonów')}, czyli ${needed}%. Opłaca się, jeśli wygrywasz częściej – ${verdict}.`
      : '';

  if (adj > 0.85 && acts.includes('raise')) {
    return withReads({
      text: `${warn}${handName} – bardzo mocna ręka. Podbij (raise), żeby pula była większa.${odds('z tą ręką to bardzo realne')}`,
      suggested: 'raise',
    });
  }
  if (drawing) {
    // Ręka „na dobór”: liczy się szansa trafienia (outs) wobec stawki, a nie obecna siła ręki.
    // Mały zapas za to, że po trafieniu zwykle wygrywa się dodatkowe zakłady w drugiej rundzie.
    const hit = drawing === 'kolor' ? 19 : 17;
    if ((hit + 5) / 100 >= needed / 100) {
      return withReads({
        text: `${warn}Nie masz jeszcze układu, ale przy wymianie możesz trafić ${drawing} (szansa około ${hit}%). Pula jest duża w porównaniu z dopłatą – sprawdź (call).${odds('przy tej puli to wystarczy')}`,
        suggested: 'call',
      });
    }
    return withReads({
      text: `${warn}Nie masz jeszcze układu – liczysz na ${drawing} (szansa około ${hit}%). Przy tak małej puli dopłata ${owe} się nie opłaca – spasuj (fold).${odds('szansa na trafienie jest za mała')}`,
      suggested: 'fold',
    });
  }
  if (adj >= needed / 100 + 0.1) {
    return withReads({
      text: `${warn}${handName} – wystarczy, żeby dopłacić ${owe}. Sprawdź (call).${odds('z tą ręką to realne')}`,
      suggested: 'call',
    });
  }
  return withReads({
    text: `${warn}${handName} – za słaba, żeby dopłacać ${owe}. Spasuj (fold) i nie dokładaj więcej.${odds('z tą ręką to mało prawdopodobne')}`,
    suggested: 'fold',
  });
}

const ACTION_PL: Record<string, string> = {
  fold: 'pasuje',
  check: 'czeka',
  call: 'sprawdza',
  bet: 'stawia',
  raise: 'podbija',
};

const ACTION_YOU: Record<string, string> = {
  fold: 'pasujesz',
  check: 'czekasz',
  call: 'sprawdzasz',
  bet: 'stawiasz',
  raise: 'podbijasz',
};

const cap = (t: string) => t[0].toUpperCase() + t.slice(1);

export function narrate(e: GameEvent, names: string[]): string | null {
  switch (e.type) {
    case 'ante':
      return e.player === 0 ? `Wszyscy wpłacają ante (${e.amount}) do puli.` : null;
    case 'phase':
      return (
        { bet1: '— Pierwsza runda licytacji —', draw: '— Wymiana kart —', bet2: '— Druga runda licytacji —', showdown: '— Odkrycie kart (showdown) —', complete: null }[
          e.phase
        ] ?? null
      );
    case 'action': {
      const amt = e.amount > 0 ? ` ${e.amount}` : '';
      if (e.player === 0) return `${cap(ACTION_YOU[e.action.type])}${amt}.`;
      return `${names[e.player]} ${ACTION_PL[e.action.type]}${amt}.`;
    }
    case 'drawn': {
      const n = e.discarded.length;
      const cards = pluralPl(n, 'kartę', 'karty', 'kart');
      if (e.player === 0) {
        if (n === 0) return 'Nie wymieniasz kart („stoisz”).';
        return `Wymieniasz ${cards}: ${e.discarded.map(cardLabel).join(', ')} → dostajesz: ${e.received.map(cardLabel).join(', ')}.`;
      }
      return n === 0 ? `${names[e.player]} nie wymienia kart („stoi”).` : `${names[e.player]} wymienia ${cards}.`;
    }
    case 'win':
      if (e.player === 0) {
        if (e.uncontested) return `Wygrywasz ${e.amount} – wszyscy inni spasowali.`;
        return e.amount > 0 ? `Wygrywasz ${e.amount}: ${e.handName}.` : `Wygrywasz: ${e.handName}.`;
      }
      if (e.uncontested) return `${names[e.player]} wygrywa ${e.amount} – wszyscy inni spasowali.`;
      return e.amount > 0 ? `${names[e.player]} wygrywa ${e.amount}: ${e.handName}.` : `Wygrywa ${names[e.player]}: ${e.handName}.`;
    default:
      return null;
  }
}

/** Objaśnienie zdarzenia dla zupełnie początkujących (pokazowe rozdanie). */
export function explainEvent(e: GameEvent, names: string[], state: GameState): string | null {
  const who = names[e.type === 'phase' || e.type === 'showdown' ? 0 : e.player];
  switch (e.type) {
    case 'ante':
      return e.player === 0
        ? `Zanim zostaną rozdane karty, każdy gracz wpłaca do puli ante – ${pluralPl(e.amount, 'żeton', 'żetony', 'żetonów')}. Dzięki temu w każdym rozdaniu jest o co grać.`
        : null;
    case 'deal':
      return e.player === 0
        ? 'Każdy dostaje 5 kart. Normalnie widzisz tylko swoje – w tym pokazowym rozdaniu odkryliśmy też karty Ani. Pod kartami widać nazwę układu.'
        : null;
    case 'phase':
      switch (e.phase) {
        case 'bet1': return 'Pierwsza runda licytacji. Gracze po kolei decydują, czy wpłacają żetony do puli. Kto ma słabe karty, może zrezygnować.';
        case 'draw': return 'Wymiana kart. Każdy może odrzucić do 3 kart i dostać nowe z talii, żeby poprawić układ.';
        case 'bet2': return `Druga runda licytacji. Teraz zakład jest wyższy – ${pluralPl(state.rules.betSize[1], 'żeton', 'żetony', 'żetonów')} – bo po wymianie gracze wiedzą więcej o swoich kartach.`;
        case 'showdown': return 'Odkrycie kart (showdown). Gracze, którzy nie spasowali, pokazują ręce. Wygrywa najlepszy układ.';
        default: return null;
      }
    case 'action': {
      const you = e.player === 0;
      switch (e.action.type) {
        case 'check': return you ? 'Czekasz (check) – nic nie wpłacasz i oddajesz ruch dalej.' : `${who} czeka (check) – nic nie wpłaca i oddaje ruch dalej.`;
        case 'bet': return `${you ? 'Stawiasz zakład (bet) – wpłacasz' : `${who} stawia zakład (bet) – wpłaca`} ${e.amount} do puli. Pozostali muszą dopłacić tyle samo albo zrezygnować.`;
        case 'call': return you ? `Sprawdzasz (call) – dopłacasz ${e.amount}, żeby zostać w grze.` : `${who} sprawdza (call) – dopłaca ${e.amount}, żeby zostać w grze.`;
        case 'raise': return you ? 'Podbijasz (raise) – wyrównujesz i dokładasz kolejną stawkę.' : `${who} podbija (raise) – wyrównuje i dokłada kolejną stawkę.`;
        case 'fold': return you ? 'Pasujesz (fold) – oddajesz karty i tracisz szansę na pulę.' : `${who} pasuje (fold) – oddaje karty i traci szansę na pulę.`;
        default: return null;
      }
    }
    case 'drawn': {
      const n = e.discarded.length;
      const cards = pluralPl(n, 'kartę', 'karty', 'kart');
      if (e.player === 0) {
        return n === 0
          ? 'Nie wymieniasz kart – „stoisz”, bo masz gotowy układ.'
          : `Odrzucasz ${cards} (${e.discarded.map(cardLabel).join(', ')}) i dostajesz nowe z talii: ${e.received.map(cardLabel).join(', ')}. Nowe karty są oznaczone w Twojej ręce.`;
      }
      return n === 0
        ? `${who} nie wymienia kart – „stoi”, bo ma już gotowy układ.`
        : `${who} odrzuca ${cards} i dostaje tyle samo nowych z talii. Ty widzisz tylko, ile kart wymieniła druga strona – to wskazówka, co może mieć.`;
    }
    case 'win': {
      if (e.player === 0) {
        return e.uncontested
          ? `Zabierasz pulę (${e.amount}), bo wszyscy inni spasowali – nie musisz nawet pokazywać kart.`
          : `Zabierasz pulę (${e.amount}) z układem: ${e.handName}.`;
      }
      return e.uncontested
        ? `${who} zabiera pulę (${e.amount}), bo wszyscy inni spasowali – nie musi nawet pokazywać kart.`
        : `${who} zabiera pulę (${e.amount}) z układem: ${e.handName}.`;
    }
    default:
      return null;
  }
}

/** Wyjaśnienie wyniku showdownu: zwycięzca vs najlepszy z pozostałych. */
/** Zdanie zamykające pokazowe rozdanie – po wyjaśnieniu wyniku. */
export const DEMO_OUTRO = 'Tak wygląda całe rozdanie! W kolejnych lekcjach poznasz każdy krok po kolei.';

export function explainShowdown(state: GameState, names: string[]): string | null {
  const sd = state.events.find((e) => e.type === 'showdown');
  if (!sd || sd.type !== 'showdown' || sd.players.length < 2) return null;
  const val = (i: number) => state.players[i].handValue!;
  const winner = state.winners[0];
  const others = sd.players.filter((i) => i !== winner);
  const best = others.reduce((a, b) => (compareHands(val(b), val(a)) > 0 ? b : a));
  return explainComparison(names[winner], val(winner), names[best], val(best));
}

