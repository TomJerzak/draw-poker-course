import { GLOSSARY, splitTerms } from '../lessons/glossary';

/** Hasła słowniczka w kolejności alfabetycznej (z polskimi literami). */
const GLOSSARY_SORTED = [...GLOSSARY].sort((a, b) => a.term.localeCompare(b.term, 'pl'));

/** Tekst z podświetlonymi pojęciami – po najechaniu lub dotknięciu pokazuje się definicja. */
export function RichText({ text }: { text: string }) {
  return (
    <>
      {splitTerms(text).map((p, i) =>
        typeof p === 'string' ? (
          <span key={i}>{p}</span>
        ) : (
          <span key={i} className="term" tabIndex={0}>
            {p.text}
            <span className="tip" role="tooltip">
              <strong>{p.entry.term}:</strong> {p.entry.definition}
            </span>
          </span>
        ),
      )}
    </>
  );
}

export function Glossary({ onClose }: { onClose: () => void }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <h2>Słowniczek</h2>
          <button className="btn ghost" onClick={onClose}>Zamknij</button>
        </div>
        <dl className="glossary">
          {GLOSSARY_SORTED.map((g) => (
            <div key={g.term}>
              <dt>{g.term}</dt>
              <dd>{g.definition}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
