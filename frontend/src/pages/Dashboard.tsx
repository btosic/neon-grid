import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import { GameListItem } from '../types/game';

export function Dashboard() {
  const { email, userId, logout } = useAuthStore();
  const { games, setGames } = useGameStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function loadGames() {
    try {
      const list = await api.listGames();
      setGames(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load games');
    }
  }

  useEffect(() => {
    void loadGames();
  }, []);

  async function handleCreateGame() {
    setLoading(true);
    setError(null);
    try {
      const game = await api.createGame();
      await loadGames();
      navigate(`/game/${game.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create game');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin(game: GameListItem) {
    if (game.player1Id === userId) {
      navigate(`/game/${game.id}`);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.joinGame(game.id);
      navigate(`/game/${game.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join game');
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  function statusLabel(g: GameListItem) {
    if (g.status === 'finished') return g.winnerId ? `Finished` : 'Finished';
    if (g.status === 'active') return 'In Progress';
    return 'Waiting for opponent';
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1 className="logo">NEON GRID</h1>
        <div className="header-right">
          <span className="user-email">{email}</span>
          <button onClick={handleLogout} className="btn-ghost">
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-actions">
          <button onClick={handleCreateGame} disabled={loading} className="btn-primary">
            + New Game
          </button>
          <button onClick={loadGames} className="btn-ghost">
            Refresh
          </button>
        </div>

        {error && <p className="form-error">{error}</p>}

        <table className="games-table">
          <thead>
            <tr>
              <th>Game ID</th>
              <th>Status</th>
              <th>Created</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {games.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', opacity: 0.6 }}>
                  No games yet. Create one!
                </td>
              </tr>
            )}
            {games.map((g) => (
              <tr key={g.id}>
                <td className="game-id">{g.id.slice(0, 8)}…</td>
                <td>
                  <span className={`status-badge ${g.status}`}>{statusLabel(g)}</span>
                </td>
                <td>{new Date(g.createdAt).toLocaleString()}</td>
                <td>
                  {g.status === 'waiting' && g.player2Id === null && g.player1Id !== userId && (
                    <button
                      onClick={() => handleJoin(g)}
                      disabled={loading}
                      className="btn-secondary"
                    >
                      Join
                    </button>
                  )}
                  {(g.player1Id === userId || g.player2Id === userId) &&
                    (g.status === 'active' || g.status === 'waiting') && (
                      <button onClick={() => navigate(`/game/${g.id}`)} className="btn-secondary">
                        Rejoin
                      </button>
                    )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  );
}
