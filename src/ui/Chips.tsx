import { useEffect, useRef, useState } from 'react';

/** Nominały żetonów i ich kolory (tylko wygląd – kwoty w grze się nie zmieniają). */
const DENOMINATIONS: { value: number; color: string; edge: string }[] = [
  { value: 100, color: '#1f1f1f', edge: '#e0b84f' },
  { value: 25, color: '#2e8b57', edge: '#f4f1ea' },
  { value: 5, color: '#c0392b', edge: '#f4f1ea' },
  { value: 1, color: '#eeeae0', edge: '#2f6fb2' },
];

/** Rozbija kwotę na żetony od największego nominału, najwyżej `max` sztuk. */
export function chipBreakdown(amount: number, max: number): { color: string; edge: string }[] {
  const chips: { color: string; edge: string }[] = [];
  let rest = Math.max(0, Math.floor(amount));
  for (const d of DENOMINATIONS) {
    while (rest >= d.value && chips.length < max) {
      chips.push({ color: d.color, edge: d.edge });
      rest -= d.value;
    }
  }
  return chips;
}

/**
 * Liczba żetonów do narysowania dla puli, zakładu albo wygranej: rośnie z kwotą,
 * ale wolniej niż ona (żeby duże pule nie zajmowały pół stołu).
 */
export function visualChipCount(amount: number, max: number): number {
  if (amount <= 0) return 0;
  return Math.max(1, Math.min(max, Math.ceil(1.6 * Math.sqrt(amount))));
}

const MIXED = [DENOMINATIONS[2], DENOMINATIONS[1], DENOMINATIONS[3], DENOMINATIONS[0]];

interface StackProps {
  amount: number;
  /** Tryb „pula”: liczba żetonów rośnie z kwotą, w mieszanych kolorach (zamiast według nominałów). */
  mixed?: boolean;
  /** Największa liczba rysowanych żetonów. */
  max?: number;
  /** Żetonów w jednej kolumnie. */
  perColumn?: number;
  small?: boolean;
  className?: string;
}

/** Stos żetonów odpowiadający kwocie – czysto dekoracyjny (kwota jest zawsze podana tekstem obok). */
export function ChipStack({ amount, mixed, max = 10, perColumn = 5, small, className = '' }: StackProps) {
  const chips = mixed
    ? Array.from({ length: visualChipCount(amount, max) }, (_, i) => MIXED[i % MIXED.length])
    : chipBreakdown(amount, max);
  if (chips.length === 0) return null;
  const columns: (typeof chips)[] = [];
  chips.forEach((c, i) => {
    const col = Math.floor(i / perColumn);
    (columns[col] ??= []).push(c);
  });
  return (
    <span className={`chip-stack ${small ? 'small' : ''} ${className}`} aria-hidden>
      {columns.map((col, ci) => (
        <span key={ci} className="chip-col" style={{ ['--h' as string]: col.length }}>
          {col.map((c, i) => (
            <i key={i} className="chip" style={{ ['--c' as string]: c.color, ['--e' as string]: c.edge, ['--i' as string]: i }} />
          ))}
        </span>
      ))}
    </span>
  );
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Liczba, która przy zmianie płynnie „dolicza się” do nowej wartości. */
export function AnimatedNumber({ value, duration = 600 }: { value: number; duration?: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    const start = from.current;
    if (start === value || prefersReducedMotion()) {
      from.current = value;
      setShown(value);
      return;
    }
    let frame = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = Math.round(start + (value - start) * eased);
      from.current = v;
      setShown(v);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <>{shown}</>;
}
