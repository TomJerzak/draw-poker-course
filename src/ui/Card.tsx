import type { CSSProperties, KeyboardEvent } from 'react';
import { Card as CardT, rankLabel, SUIT_NAME_PL, SUIT_SYMBOL } from '../engine/cards';

interface Props {
  card?: CardT;
  faceDown?: boolean;
  selected?: boolean;
  hinted?: boolean;
  /** Karta otrzymana przy wymianie – oznaczona plakietką „nowa”. */
  isNew?: boolean;
  small?: boolean;
  onClick?: () => void;
  /** Karta, która może się odwrócić (karty rywali przy odkryciu) – rysowana z obiema stronami. */
  flippable?: boolean;
  /** Animacja przy pojawieniu się karty: rozdanie albo dobranie przy wymianie. */
  enter?: 'deal' | 'draw';
  /** Opóźnienie animacji w milisekundach (kolejność rozdawania). */
  delay?: number;
  /** Dodatkowe style (np. ułożenie w wachlarz). */
  style?: CSSProperties;
}

function Face({ card }: { card: CardT }) {
  const rank = rankLabel(card.rank);
  const suit = SUIT_SYMBOL[card.suit];
  return (
    <>
      <span className="corner tl">
        {rank}
        <br />
        {suit}
      </span>
      <span className="pip">{suit}</span>
      <span className="corner br" aria-hidden>
        {rank}
        <br />
        {suit}
      </span>
    </>
  );
}

export function Card({ card, faceDown, selected, hinted, isNew, small, onClick, flippable, enter, delay = 0, style }: Props) {
  const cls = ['card'];
  if (small) cls.push('small');
  if (enter) cls.push(`enter-${enter}`);
  const st: CSSProperties = { ...style, ['--delay' as string]: `${delay}ms` };

  // Karta z dwiema stronami – odwraca się płynnie, gdy przestaje być zakryta.
  if (flippable && card) {
    cls.push('flippable');
    if (faceDown) cls.push('is-down');
    if (card.suit === 'H' || card.suit === 'D') cls.push('red');
    const label = faceDown ? 'zakryta karta' : `${rankLabel(card.rank)} ${SUIT_NAME_PL[card.suit]}`;
    return (
      <div className={cls.join(' ')} style={st} aria-label={label}>
        <div className="flip-inner">
          <div className="face front">
            <Face card={card} />
          </div>
          <div className="face back-face" />
        </div>
      </div>
    );
  }

  if (faceDown || !card) {
    cls.push('back');
    return <div className={cls.join(' ')} style={st} aria-label="zakryta karta" />;
  }
  if (card.suit === 'H' || card.suit === 'D') cls.push('red');
  if (selected) cls.push('selected');
  if (hinted) cls.push('hinted');
  if (isNew) cls.push('new');
  if (onClick) cls.push('clickable');
  const label = `${rankLabel(card.rank)} ${SUIT_NAME_PL[card.suit]}${isNew ? ' (nowa)' : ''}`;
  // Zawsze ten sam element (div) – zmiana na <button> przy wymianie tworzyłaby kartę od nowa
  // i ponownie uruchamiała animację rozdawania. Gdy kartę można kliknąć, działa jak przycisk.
  const clickable = onClick
    ? {
        role: 'button',
        tabIndex: 0,
        'aria-pressed': !!selected,
        onClick,
        onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        },
      }
    : {};
  return (
    <div className={cls.join(' ')} style={st} aria-label={label} {...clickable}>
      <Face card={card} />
      {isNew && <span className="new-badge">nowa</span>}
    </div>
  );
}
