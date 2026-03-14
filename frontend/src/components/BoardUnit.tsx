import { BoardUnit as BoardUnitType, CARD_DEFINITIONS } from '../types/game';

interface BoardUnitProps {
  unit: BoardUnitType;
  isSelected: boolean;
  isTargetable: boolean;
  isOwn: boolean;
  onClick: () => void;
}

export function BoardUnitCard({ unit, isSelected, isTargetable, isOwn, onClick }: BoardUnitProps) {
  const def = CARD_DEFINITIONS[unit.cardId];

  const classes = [
    'board-unit',
    isOwn ? 'own' : 'enemy',
    isSelected ? 'selected' : '',
    isTargetable ? 'targetable' : '',
    unit.hasAttacked ? 'exhausted' : '',
    unit.overclocked ? 'overclocked' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} onClick={onClick} title={def.effect ?? def.name}>
      <div className="unit-name">{def.name}</div>
      <div className="unit-stats">
        <span className="atk" title="Attack">
          {unit.currentAttack}
        </span>
        <span className="sep">/</span>
        <span className="hp" title="Health">
          {unit.currentHealth}
        </span>
      </div>
      {unit.overclocked && <div className="buff-tag">+2 ATK</div>}
      {unit.hasAttacked && <div className="exhausted-tag">⚡</div>}
    </div>
  );
}
