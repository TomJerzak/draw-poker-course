import { parseCards } from '../engine/cards';
import { evaluateHand } from '../engine/handEvaluator';
import { coreCards } from '../lessons/explain';
import { Card } from './Card';
import { RichText } from './RichText';

/** Od najsilniejszego; numeracja (9 → 1) zgodna z lekcjami, gdzie 1 = wysoka karta. */
const RANKINGS: [string, string, string][] = [
  ['Poker', 'Strit w jednym kolorze. Najwyższy to poker królewski 10‑J‑Q‑K‑A.', '9H TH JH QH KH'],
  ['Kareta', 'Cztery karty tej samej wartości.', '8S 8H 8D 8C 3S'],
  ['Full', 'Trójka i para naraz. Dwa fulle porównuje się najpierw po trójce.', '3S 3H 3D 7C 7S'],
  ['Kolor', 'Pięć kart w jednym kolorze, w dowolnej kolejności.', '2D 6D 8D TD QD'],
  ['Strit', 'Pięć kolejnych wartości w dowolnych kolorach. As może być na górze (10‑J‑Q‑K‑A) albo na dole (A‑2‑3‑4‑5, koło).', '4S 5H 6D 7C 8S'],
  ['Trójka', 'Trzy karty tej samej wartości.', 'QS QH QD 9C 2D'],
  ['Dwie pary', 'Dwie pary różnych wartości.', 'JS JC 5H 5D AS'],
  ['Para', 'Dwie karty tej samej wartości.', 'TS TH AD 6C 4S'],
  ['Wysoka karta', 'Brak któregokolwiek z powyższych układów – liczy się najwyższa karta.', 'AS KH 9D 7C 3S'],
];

const RULES = [
  'Wygrywa wyższy układ – nawet niska para bije samą wysoką kartę.',
  'Z pięciu kart zawsze liczy się najwyższy układ (full to nie „trójka”, poker to nie „kolor”).',
  'Przy takim samym układzie decydują wartości kart, które go tworzą – np. para asów bije parę króli.',
  'Gdy i one są równe, decyduje kicker, czyli najwyższa z pozostałych kart, potem kolejne.',
  'Kolory kart nie mają znaczenia. Identyczne wartości to remis i pula jest dzielona.',
];

export function HandRankings({ onClose }: { onClose: () => void }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="panel rankings" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <h2>Układy – od najsilniejszego</h2>
          <button className="btn ghost" onClick={onClose}>Zamknij</button>
        </div>
        <p className="muted small">Podświetlone karty tworzą układ, pozostałe to kickery.</p>
        <ol reversed>
          {RANKINGS.map(([name, desc, codes]) => {
            const cards = parseCards(codes);
            const core = coreCards(cards);
            return (
              <li key={name}>
                <div>
                  <strong>{name}</strong>
                  <span className="muted"> – <RichText text={desc} /></span>
                </div>
                <div className="cards-row">
                  {cards.map((c, i) => (
                    <Card key={i} card={c} small hinted={core.includes(i)} />
                  ))}
                  <span className="muted small example-name">{evaluateHand(cards).name}</span>
                </div>
              </li>
            );
          })}
        </ol>
        <h3>Jak rozstrzygać</h3>
        <ul className="rules">
          {RULES.map((r) => (
            <li key={r}>
              <RichText text={r} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
