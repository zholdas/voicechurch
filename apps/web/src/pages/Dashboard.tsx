import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { roomsApi } from '../lib/api';
import type { RoomInfo, TranslationDirection } from '../lib/types';
import QRCodeDisplay from '../components/QRCodeDisplay';

export default function Dashboard() {
  const { user, isLoading: authLoading, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [newRoom, setNewRoom] = useState({
    name: '',
    slug: '',
    direction: 'es-to-en' as TranslationDirection,
    isPublic: false,
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Load rooms
  useEffect(() => {
    if (isAuthenticated) {
      loadRooms();
    }
  }, [isAuthenticated]);

  async function loadRooms() {
    try {
      const data = await roomsApi.getMyRooms();
      setRooms(data);
    } catch (err) {
      console.error('Failed to load rooms:', err);
    } finally {
      setIsLoadingRooms(false);
    }
  }

  async function handleCreateRoom(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsCreating(true);

    try {
      await roomsApi.createRoom(newRoom);
      setNewRoom({ name: '', slug: '', direction: 'es-to-en', isPublic: false });
      setShowCreateForm(false);
      await loadRooms();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room');
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDeleteRoom(id: string, name: string) {
    if (!confirm(`Delete room "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await roomsApi.deleteRoom(id);
      await loadRooms();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete room');
    }
  }

  async function handleTogglePublic(room: RoomInfo) {
    try {
      await roomsApi.updateRoom(room.id, { isPublic: !room.isPublic });
      await loadRooms();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update room');
    }
  }

  // Generate slug from name
  function generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 50);
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-blue-600">
            WordBeacon
          </Link>

          <div className="flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-3">
                {user.picture && (
                  <img
                    src={user.picture}
                    alt={user.name}
                    className="w-8 h-8 rounded-full"
                  />
                )}
                <span className="text-gray-700">{user.name}</span>
              </div>
            )}
            <button
              onClick={logout}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">My Rooms</h1>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Create Room
          </button>
        </div>

        {/* Create room form */}
        {showCreateForm && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">Create New Room</h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Room Name
                </label>
                <input
                  type="text"
                  value={newRoom.name}
                  onChange={(e) => {
                    setNewRoom({
                      ...newRoom,
                      name: e.target.value,
                      slug: newRoom.slug || generateSlug(e.target.value),
                    });
                  }}
                  placeholder="Sunday Service"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custom URL
                </label>
                <div className="flex items-center">
                  <span className="text-gray-500 mr-1">/room/</span>
                  <input
                    type="text"
                    value={newRoom.slug}
                    onChange={(e) =>
                      setNewRoom({ ...newRoom, slug: e.target.value.toLowerCase() })
                    }
                    placeholder="sunday-service"
                    pattern="[a-z0-9-]+"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Lowercase letters, numbers, and hyphens only (3-50 characters)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Translation Direction
                </label>
                <select
                  value={newRoom.direction}
                  onChange={(e) =>
                    setNewRoom({
                      ...newRoom,
                      direction: e.target.value as TranslationDirection,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="es-to-en">Spanish → English</option>
                  <option value="en-to-es">English → Spanish</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isPublic"
                  checked={newRoom.isPublic}
                  onChange={(e) =>
                    setNewRoom({ ...newRoom, isPublic: e.target.checked })
                  }
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="isPublic" className="text-sm text-gray-700">
                  Public room (visible on home page)
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {isCreating ? 'Creating...' : 'Create Room'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Rooms list */}
        {isLoadingRooms ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : rooms.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-8 text-center">
            <p className="text-gray-500 mb-4">You don't have any rooms yet.</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="text-blue-600 hover:underline"
            >
              Create your first room
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {rooms.map((room) => (
              <div
                key={room.id}
                className="bg-white rounded-xl shadow p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">{room.name}</h3>
                      {room.isActive && (
                        <span className="flex items-center gap-1 text-green-600 text-sm">
                          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                          Live
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">/room/{room.slug}</p>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      room.isPublic
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {room.isPublic ? '🌐 Public' : '🔒 Private'}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                  <span>
                    {room.direction === 'es-to-en'
                      ? 'Spanish → English'
                      : 'English → Spanish'}
                  </span>
                  <span>{room.listenerCount} listeners</span>
                </div>

                {/* QR Code */}
                <div className="mb-4">
                  <QRCodeDisplay
                    roomId={room.id}
                    qrImageUrl={room.qrImageUrl}
                    compact
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(
                        `${window.location.origin}/room/${room.slug}`
                      )
                    }
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    📋 Copy Link
                  </button>
                  <Link
                    to={`/room/${room.slug}/broadcast`}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    🎙️ Broadcast
                  </Link>
                  <button
                    onClick={() => handleTogglePublic(room)}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {room.isPublic ? 'Make Private' : 'Make Public'}
                  </button>
                  <button
                    onClick={() => handleDeleteRoom(room.id, room.name)}
                    className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
