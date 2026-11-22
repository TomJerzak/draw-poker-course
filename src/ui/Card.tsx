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
}

export function Card({ card, faceDown, selected, hinted, isNew, small, onClick }: Props) {
  const cls = ['card'];
  if (small) cls.push('small');
  if (faceDown || !card) {
    cls.push('back');
    return <div className={cls.join(' ')} aria-label="zakryta karta" />;
  }
  if (card.suit === 'H' || card.suit === 'D') cls.push('red');
  if (selected) cls.push('selected');
  if (hinted) cls.push('hinted');
  if (isNew) cls.push('new');
  if (onClick) cls.push('clickable');
  const label = `${rankLabel(card.rank)} ${SUIT_NAME_PL[card.suit]}${isNew ? ' (nowa)' : ''}`;
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={cls.join(' ')} onClick={onClick} aria-label={label} aria-pressed={onClick ? !!selected : undefined}>
      <span className="corner">
        {rankLabel(card.rank)}
        <br />
        {SUIT_SYMBOL[card.suit]}
      </span>
      <span className="pip">{SUIT_SYMBOL[card.suit]}</span>
      {isNew && <span className="new-badge">nowa</span>}
    </Tag>
  );
}
