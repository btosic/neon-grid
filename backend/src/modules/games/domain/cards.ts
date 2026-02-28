import { CardDef, CardId, CardInstance } from './types';
import { v4 as uuidv4 } from 'uuid';

export const CARD_DEFINITIONS: Record<CardId, CardDef> = {
  'street-samurai': {
    id: 'street-samurai',
    name: 'Street Samurai',
    cost: 1,
    type: 'unit',
    attack: 2,
    health: 1,
  },
  'corporate-guard': {
    id: 'corporate-guard',
    name: 'Corporate Guard',
    cost: 1,
    type: 'unit',
    attack: 1,
    health: 3,
  },
  sniper: {
    id: 'sniper',
    name: 'Sniper',
    cost: 2,
    type: 'unit',
    attack: 2,
    health: 1,
  },
  'kamikaze-drone': {
    id: 'kamikaze-drone',
    name: 'Kamikaze Drone',
    cost: 2,
    type: 'unit',
    attack: 3,
    health: 1,
  },
  'emp-blast': {
    id: 'emp-blast',
    name: 'EMP Blast',
    cost: 1,
    type: 'event',
  },
  overclock: {
    id: 'overclock',
    name: 'Overclock',
    cost: 1,
    type: 'event',
  },
};

/** The fixed card composition for each player's deck */
export const BASE_DECK_IDS: CardId[] = [
  'street-samurai',
  'street-samurai',
  'corporate-guard',
  'corporate-guard',
  'sniper',
  'sniper',
  'kamikaze-drone',
  'kamikaze-drone',
  'emp-blast',
  'overclock',
];

/** Build a fresh deck of CardInstances with unique instance ids */
export function buildDeck(): CardInstance[] {
  return BASE_DECK_IDS.map((cardId) => ({ instanceId: uuidv4(), cardId }));
}

/** Fisher-Yates shuffle — the only place randomness is allowed */
export function shuffleDeck(deck: CardInstance[]): CardInstance[] {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]] as [CardInstance, CardInstance];
  }
  return d;
}
