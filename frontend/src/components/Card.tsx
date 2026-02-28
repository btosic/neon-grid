import { CardInstance, CARD_DEFINITIONS } from '../types/game';

interface CardProps {
  card: CardInstance;
  isSelected: boolean;
  canPlay: boolean;
  onClick: () => void;
}

export function Card({ card, isSelected, canPlay, onClick }: CardProps) {
  const def = CARD_DEFINITIONS[card.cardId];

  return (
    <div
      onClick={canPlay ? onClick : undefined}
      className={`card ${isSelected ? 'selected' : ''} ${!canPlay ? 'disabled' : ''} ${def.type}`}
      title={def.effect ?? def.name}
    >
      <div className="card-cost">{def.cost}</div>
      <div className="card-name">{def.name}</div>
      {def.type === 'unit' && (
        <div className="card-stats">
          <span className="atk">{def.attack}</span>
          <span className="sep">/</span>
          <span className="hp">{def.health}</span>
        </div>
      )}
      {def.effect && <div className="card-effect">{def.effect}</div>}
    </div>
  );
}
