import { useState } from 'react';
import { parseCards, pluralPl } from '../engine/cards';
import { CATEGORY_NAME_PL, evaluateHand, HandCategory } from '../engine/handEvaluator';
import { coreCards, coreHint, wrongNameHint } from '../lessons/explain';
import { Lesson } from '../lessons/types';
import { Card } from './Card';
import { HandRankings } from './HandRankings';
import { Glossary } from './RichText';

type Step = 'name' | 'mark' | 'done';

/** Dodatkowa wskazówka po dwóch błędnych nazwach – naprowadza, nie zdradzając odpowiedzi. */
const LOOK_FOR: Record<HandCategory, string> = {
  [HandCategory.HighCard]: 'Sprawdź po kolei: czy jakieś dwie karty mają tę samą wartość? Czy wszystkie są w jednym kolorze? Czy idą po kolei?',
  [HandCategory.OnePair]: 'Poszukaj kart o tej samej wartości.',
  [HandCategory.TwoPair]: 'Policz, ile jest grup kart o tej samej wartości.',
  [HandCategory.ThreeOfAKind]: 'Poszukaj kart o tej samej wartości – policz, ile ich jest.',
  [HandCategory.Straight]: 'Ułóż karty w myślach od najniższej do najwyższej.',
  [HandCategory.Flush]: 'Spójrz na symbole kolorów: ♠ ♥ ♦ ♣.',
  [HandCategory.FullHouse]: 'Policz karty o tej samej wartości – są tu dwie takie grupy.',
  [HandCategory.FourOfAKind]: 'Poszukaj kart o tej samej wartości – policz, ile ich jest.',
  [HandCategory.StraightFlush]: 'Spójrz jednocześnie na kolory i na kolejność wartości.',
};

export function DrillScreen({ lesson, onDone, onExit }: { lesson: Lesson; onDone: () => void; onExit: () => void }) {
  const drill = lesson.drill!;
  const [idx, setIdx] = useState(0);
  const [step, setStep] = useState<Step>('name');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [revealCore, setRevealCore] = useState(false);
  const [panel, setPanel] = useState<'rankings' | 'glossary' | null>(null);
  const [wrongNames, setWrongNames] = useState(0);
  const [mistakeHere, setMistakeHere] = useState(false);
  const [firstTry, setFirstTry] = useState(0);
  const [confirmExit, setConfirmExit] = useState(false);

  const hand = parseCards(drill.hands[idx]);
  const value = evaluateHand(hand);
  const core = coreCards(hand);
  const last = idx + 1 >= drill.hands.length;

  const pickName = (c: HandCategory) => {
    if (c === value.category) {
      setFeedback({ ok: true, text: `Tak, to ${CATEGORY_NAME_PL[c].toLowerCase()}! ${coreHint(c)}` });
      setStep('mark');
    } else {
      const tries = wrongNames + 1;
      setWrongNames(tries);
      setMistakeHere(true);
      const extra = tries >= 2 ? ` Podpowiedź: ${LOOK_FOR[value.category]}` : ' Spróbuj jeszcze raz – pomocna jest ściąga „Układy”.';
      setFeedback({ ok: false, text: `${wrongNameHint(c, value.category)}${extra}` });
    }
  };

  const check = () => {
    const ok = selected.length === core.length && core.every((i) => selected.includes(i));
    if (ok) {
      if (!mistakeHere) setFirstTry((n) => n + 1);
      const end = last
        ? ` Ćwiczenie ukończone. Ręce rozpoznane bez pomyłki: ${firstTry + (mistakeHere ? 0 : 1)} z ${drill.hands.length}.`
        : '';
      setFeedback({ ok: true, text: `Brawo! ${value.name}.${end}` });
      setStep('done');
    } else {
      setMistakeHere(true);
      setFeedback({
        ok: false,
        text: `Nie całkiem. ${coreHint(value.category)} Właściwe karty podświetliliśmy na żółto – zaznacz je i kliknij „Sprawdź”.`,
      });
      setRevealCore(true);
      setSelected([]);
    }
  };

  const next = () => {
    if (last) return onDone();
    setIdx(idx + 1);
    setStep('name');
    setFeedback(null);
    setSelected([]);
    setRevealCore(false);
    setWrongNames(0);
    setMistakeHere(false);
  };

  const toggle = (i: number) => setSelected((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));

  const prompt =
    step === 'name'
      ? 'Krok 1 z 2: Jaki to układ? Wybierz najwyższy, jaki tworzą te karty.'
      : step === 'mark'
        ? 'Krok 2 z 2: Zaznacz karty tworzące układ (kliknij kartę ponownie, żeby ją odznaczyć).'
        : value.name;

  return (
    <div className="play">
      <header className="topbar">
        <button className="btn ghost" onClick={() => setConfirmExit(true)}>← Menu</button>
        <div className="title">
          <strong>Ćwiczenie: znajdź układ</strong>
          <span className="muted">
            {lesson.title} · ręka {idx + 1}/{drill.hands.length} · ćwiczenie nie jest oceniane
          </span>
        </div>
        <button className="btn ghost" onClick={() => setPanel('rankings')}>Układy</button>
        <button className="btn ghost" onClick={() => setPanel('glossary')}>Słowniczek</button>
      </header>
      {confirmExit && (
        <div className="goal danger-box">
          Przerwać lekcję? Przy następnym podejściu zaczniesz od ćwiczenia. Zaliczone wcześniej lekcje zostają.
          <div className="row">
            <button className="btn primary" onClick={() => setConfirmExit(false)}>Ćwicz dalej</button>
            <button className="btn danger" onClick={onExit}>Przerwij lekcję</button>
          </div>
        </div>
      )}

      <section className="table drill">
        <p className="center muted">{prompt}</p>
        <div className="cards-row big">
          {hand.map((c, i) => (
            <Card
              key={i}
              card={c}
              selected={selected.includes(i) || (step === 'done' && core.includes(i))}
              hinted={revealCore && core.includes(i)}
              onClick={step === 'mark' ? () => toggle(i) : undefined}
            />
          ))}
        </div>
      </section>

      {feedback && (
        <div className={`coach ${feedback.ok ? 'ok' : 'bad'}`}>
          <span className="coach-icon" aria-hidden>{feedback.ok ? '✔' : '✘'}</span>
          <p>{feedback.text}</p>
        </div>
      )}

      <section className="actions">
        {step === 'name' &&
          drill.options.map((c) => (
            <button key={c} className="btn primary" onClick={() => pickName(c)}>
              {CATEGORY_NAME_PL[c]}
            </button>
          ))}
        {step === 'mark' && (
          <button className="btn primary" disabled={selected.length === 0} onClick={check}>
            {selected.length === 0 ? 'Sprawdź – najpierw zaznacz karty' : `Sprawdź – zaznaczono ${pluralPl(selected.length, 'kartę', 'karty', 'kart')}`}
          </button>
        )}
        {step === 'done' && last && (
          <p className="hint">
            Teraz quiz: przy każdym rozdaniu wskażesz zwycięzcę. Quiz jest już oceniany – cel lekcji: {lesson.goalText.toLowerCase()}
          </p>
        )}
        {step === 'done' && (
          <button className="btn primary" onClick={next}>
            {last ? 'Przejdź do quizu →' : 'Następna ręka →'}
          </button>
        )}
      </section>

      {panel === 'rankings' && <HandRankings onClose={() => setPanel(null)} />}
      {panel === 'glossary' && <Glossary onClose={() => setPanel(null)} />}
    </div>
  );
}
