import { useEffect, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import { wsService } from '../services/wsService';
import { Card } from '../components/Card';
import { BoardUnitCard } from '../components/BoardUnit';
import { CARD_DEFINITIONS, BoardUnit, CardInstance } from '../types/game';

export function GameBoard() {
  const { id: gameId } = useParams<{ id: string }>();
  const { token, userId } = useAuthStore();
  const {
    currentGame,
    selectedHandCard,
    selectedAttacker,
    wsError,
    setCurrentGame,
    selectHandCard,
    selectAttacker,
    setWsError,
    clearGame,
  } = useGameStore();
  const navigate = useNavigate();
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);

  // Connect WebSocket and subscribe to state updates
  useEffect(() => {
    if (!token || !gameId) return;

    wsService.connect(token);
    wsService.onMessage((state) => {
      setWaitingForOpponent(false);
      setCurrentGame(state);
      setWsError(null);
    });
    wsService.onWaitingMessage(() => setWaitingForOpponent(true));
    wsService.onErrorMessage((msg) => setWsError(msg));
    wsService.joinGame(gameId);

    return () => {
      wsService.disconnect();
      clearGame();
    };
  }, [token, gameId]);

  // ─── Action handlers ─────────────────────────────────────────────────────

  const handleHandCardClick = useCallback(
    (cardInstanceId: string) => {
      if (!currentGame || !gameId) return;
      const isMyTurn = currentGame.activePlayerId === userId;
      if (!isMyTurn) return;

      const card = currentGame.myState.hand.find((c) => c.instanceId === cardInstanceId);
      if (!card) return;

      // Cards that need no target can be played immediately
      if (CARD_DEFINITIONS[card.cardId].type === 'unit' && card.cardId !== 'sniper') {
        wsService.playCard(gameId, cardInstanceId);
        selectHandCard(null);
      } else if (
        CARD_DEFINITIONS[card.cardId].type === 'event' &&
        card.cardId !== 'emp-blast' &&
        card.cardId !== 'overclock'
      ) {
        wsService.playCard(gameId, cardInstanceId);
        selectHandCard(null);
      } else {
        // Select card and wait for target click
        selectHandCard(selectedHandCard === cardInstanceId ? null : cardInstanceId);
      }
    },
    [currentGame, gameId, userId, selectedHandCard]
  );

  const handleBoardUnitClick = useCallback(
    (unit: BoardUnit, isOwn: boolean) => {
      if (!currentGame || !gameId) return;
      const isMyTurn = currentGame.activePlayerId === userId;

      if (selectedHandCard) {
        // A targeted event/unit card is selected — use this unit as the target
        const card = currentGame.myState.hand.find((c) => c.instanceId === selectedHandCard);
        if (!card) return;

        // Validate target eligibility
        const validTarget =
          (card.cardId === 'sniper' && !isOwn) ||
          card.cardId === 'emp-blast' ||
          card.cardId === 'overclock';

        if (validTarget) {
          wsService.playCard(gameId, selectedHandCard, unit.instanceId);
          selectHandCard(null);
        }
        return;
      }

      if (isOwn && isMyTurn) {
        // Select own unit as attacker
        if (!unit.hasAttacked) {
          selectAttacker(selectedAttacker === unit.instanceId ? null : unit.instanceId);
        }
        return;
      }

      if (!isOwn && selectedAttacker) {
        // Attack enemy unit
        wsService.attack(gameId, selectedAttacker, unit.instanceId, 'unit');
        selectAttacker(null);
      }
    },
    [currentGame, gameId, userId, selectedHandCard, selectedAttacker]
  );

  const handleAttackPlayer = useCallback(() => {
    if (!currentGame || !gameId || !selectedAttacker) return;
    wsService.attack(gameId, selectedAttacker, currentGame.opponentState.id, 'player');
    selectAttacker(null);
  }, [currentGame, gameId, selectedAttacker]);

  const handleEndTurn = useCallback(() => {
    if (!gameId) return;
    wsService.endTurn(gameId);
    selectHandCard(null);
    selectAttacker(null);
  }, [gameId]);

  // ─── Render ──────────────────────────────────────────────────────────────

  if (!currentGame) {
    return (
      <div className="loading-screen">
        {waitingForOpponent ? (
          <>
            <p>Waiting for an opponent to join…</p>
            <p className="loading-subtext">Share the game ID: <strong>{gameId}</strong></p>
          </>
        ) : (
          <p>Connecting to game…</p>
        )}
        {wsError && <p className="form-error">{wsError}</p>}
        <button onClick={() => navigate('/dashboard')} className="btn-ghost">
          Back to Dashboard
        </button>
      </div>
    );
  }

  const { myState, opponentState, activePlayerId, status, winner, turnNumber } = currentGame;
  const isMyTurn = activePlayerId === userId;

  const canPlay = (card: CardInstance) => {
    const def = CARD_DEFINITIONS[card.cardId];
    return isMyTurn && myState.actionPoints >= def.cost;
  };

  if (status === 'finished') {
    return (
      <div className="loading-screen">
        <h2>{winner === userId ? '🏆 You Win!' : '💀 You Lost'}</h2>
        <p>Game over — {winner === userId ? 'Victory' : 'Defeat'}</p>
        <button onClick={() => navigate('/dashboard')} className="btn-primary">
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="game-board">
      {/* ── Header ── */}
      <div className="game-header">
        <button onClick={() => navigate('/dashboard')} className="btn-ghost btn-sm">
          ← Dashboard
        </button>
        <span className="turn-info">
          Turn {turnNumber} — {isMyTurn ? 'Your turn' : "Opponent's turn"}
        </span>
        <span className="ap-info">AP: {myState.actionPoints}</span>
      </div>

      {wsError && <div className="ws-error">{wsError}</div>}

      {/* ── Opponent area ── */}
      <div className="player-area opponent-area">
        <div className="player-info">
          <span className="player-label">Opponent</span>
          <span className="hp-badge">{opponentState.hp} HP</span>
          <span className="hand-count">{opponentState.handCount} cards in hand</span>
          {selectedAttacker && (
            <button
              className="btn-attack-player"
              onClick={handleAttackPlayer}
              title="Attack opponent directly"
            >
              ⚔ Attack Player
            </button>
          )}
        </div>
        <div className="board opponent-board">
          {opponentState.board.length === 0 && <span className="empty-board">No units</span>}
          {opponentState.board.map((unit) => (
            <BoardUnitCard
              key={unit.instanceId}
              unit={unit}
              isOwn={false}
              isSelected={false}
              isTargetable={
                !!selectedAttacker ||
                !!(
                  selectedHandCard &&
                  (currentGame.myState.hand.find((c) => c.instanceId === selectedHandCard)
                    ?.cardId === 'emp-blast' ||
                    currentGame.myState.hand.find((c) => c.instanceId === selectedHandCard)
                      ?.cardId === 'sniper' ||
                    currentGame.myState.hand.find((c) => c.instanceId === selectedHandCard)
                      ?.cardId === 'overclock')
                )
              }
              onClick={() => handleBoardUnitClick(unit, false)}
            />
          ))}
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="board-divider">
        <span>BATTLE ZONE</span>
      </div>

      {/* ── Player area ── */}
      <div className="player-area my-area">
        <div className="board my-board">
          {myState.board.length === 0 && <span className="empty-board">No units</span>}
          {myState.board.map((unit) => (
            <BoardUnitCard
              key={unit.instanceId}
              unit={unit}
              isOwn={true}
              isSelected={selectedAttacker === unit.instanceId}
              isTargetable={
                !!(
                  selectedHandCard &&
                  (currentGame.myState.hand.find((c) => c.instanceId === selectedHandCard)
                    ?.cardId === 'emp-blast' ||
                    currentGame.myState.hand.find((c) => c.instanceId === selectedHandCard)
                      ?.cardId === 'overclock')
                )
              }
              onClick={() => handleBoardUnitClick(unit, true)}
            />
          ))}
        </div>
        <div className="player-info">
          <span className="player-label">You</span>
          <span className="hp-badge">{myState.hp} HP</span>
          <span className="deck-count">{myState.deck.length} in deck</span>
          {isMyTurn && (
            <button onClick={handleEndTurn} className="btn-end-turn">
              End Turn
            </button>
          )}
        </div>
      </div>

      {/* ── Hand ── */}
      <div className="hand-area">
        <div className="hand-label">Your Hand</div>
        <div className="hand">
          {myState.hand.map((card) => (
            <Card
              key={card.instanceId}
              card={card}
              isSelected={selectedHandCard === card.instanceId}
              canPlay={canPlay(card)}
              onClick={() => handleHandCardClick(card.instanceId)}
            />
          ))}
        </div>
      </div>

      {/* ── Selection hint ── */}
      {(selectedHandCard || selectedAttacker) && (
        <div className="selection-hint">
          {selectedHandCard && (
            <span>
              Select a target for{' '}
              <strong>
                {
                  CARD_DEFINITIONS[
                    currentGame.myState.hand.find((c) => c.instanceId === selectedHandCard)!.cardId
                  ].name
                }
              </strong>{' '}
              or click the card again to deselect
            </span>
          )}
          {selectedAttacker && (
            <span>Select an enemy unit to attack, or click "Attack Player" above</span>
          )}
        </div>
      )}
    </div>
  );
}
