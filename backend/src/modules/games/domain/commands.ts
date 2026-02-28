export interface PlayCardCommand {
  type: 'PLAY_CARD';
  gameId: string;
  playerId: string;
  cardInstanceId: string;
  /** Required for Sniper (target enemy unit), EMP Blast (any unit), Overclock (any unit) */
  targetInstanceId?: string;
}

export interface AttackWithUnitCommand {
  type: 'ATTACK_WITH_UNIT';
  gameId: string;
  playerId: string;
  attackerInstanceId: string;
  targetType: 'unit' | 'player';
  /** Unit instanceId when targetType === 'unit', opponent playerId when targetType === 'player' */
  targetId: string;
}

export interface EndTurnCommand {
  type: 'END_TURN';
  gameId: string;
  playerId: string;
}

export type GameCommand = PlayCardCommand | AttackWithUnitCommand | EndTurnCommand;
