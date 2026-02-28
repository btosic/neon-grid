import { create } from 'zustand';
import { ProjectedGameState, GameListItem } from '../types/game';

interface GameStore {
  games: GameListItem[];
  currentGame: ProjectedGameState | null;
  /** Card instance id selected in the player's hand for playing */
  selectedHandCard: string | null;
  /** Unit instance id selected on the player's board for attacking */
  selectedAttacker: string | null;
  wsError: string | null;

  setGames: (games: GameListItem[]) => void;
  setCurrentGame: (state: ProjectedGameState) => void;
  selectHandCard: (instanceId: string | null) => void;
  selectAttacker: (instanceId: string | null) => void;
  setWsError: (msg: string | null) => void;
  clearGame: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  games: [],
  currentGame: null,
  selectedHandCard: null,
  selectedAttacker: null,
  wsError: null,

  setGames: (games) => set({ games }),
  setCurrentGame: (state) => set({ currentGame: state }),
  selectHandCard: (instanceId) => set({ selectedHandCard: instanceId, selectedAttacker: null }),
  selectAttacker: (instanceId) => set({ selectedAttacker: instanceId, selectedHandCard: null }),
  setWsError: (msg) => set({ wsError: msg }),
  clearGame: () => set({ currentGame: null, selectedHandCard: null, selectedAttacker: null, wsError: null }),
}));
