import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { roomsApi } from '../lib/api';
import type { TranslationDirection, PublicRoomInfo } from '../lib/types';

export default function Home() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [publicRooms, setPublicRooms] = useState<PublicRoomInfo[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);

  // Load public rooms
  useEffect(() => {
    roomsApi
      .getPublicRooms()
      .then(setPublicRooms)
      .catch(console.error)
      .finally(() => setLoadingRooms(false));
  }, []);

  const handleQuickBroadcast = (dir: TranslationDirection) => {
    navigate(`/broadcast?direction=${dir}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-sm border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <img src="/logo.svg" alt="WordBeacon" className="h-8" />
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <Link
                  to="/dashboard"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Dashboard
                </Link>
                <div className="flex items-center gap-2">
                  {user?.picture && (
                    <img
                      src={user.picture}
                      alt={user.name}
                      className="w-8 h-8 rounded-full"
                    />
                  )}
                </div>
              </>
            ) : (
              <Link
                to="/login"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <img src="/logo.svg" alt="WordBeacon" className="h-16" />
          </div>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Real-time speech translation for church services. Break language
            barriers and unite your congregation.
          </p>
        </div>

        {/* Public Rooms */}
        {!loadingRooms && publicRooms.length > 0 && (
          <div className="mb-16">
            <h2 className="text-2xl font-semibold text-gray-900 text-center mb-8">
              Active Rooms
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {publicRooms.map((room) => (
                <Link
                  key={room.id}
                  to={`/room/${room.slug}`}
                  className="bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-lg text-gray-900">
                      {room.name}
                    </h3>
                    {room.isActive && (
                      <span className="flex items-center gap-1 text-green-600 text-sm">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        Live
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span
                      className={`px-2 py-0.5 rounded-full ${
                        room.direction === 'es-to-en'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-green-50 text-green-700'
                      }`}
                    >
                      {room.direction === 'es-to-en'
                        ? 'ES → EN'
                        : 'EN → ES'}
                    </span>
                    <span>{room.listenerCount} listeners</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* How it works */}
        <div className="mb-16">
          <h2 className="text-2xl font-semibold text-gray-900 text-center mb-8">
            How it works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-blue-600 font-bold">1</span>
              </div>
              <h3 className="font-semibold mb-2">Start Broadcasting</h3>
              <p className="text-gray-600 text-sm">
                The speaker starts a broadcast and speaks in their language
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-blue-600 font-bold">2</span>
              </div>
              <h3 className="font-semibold mb-2">Share the Link</h3>
              <p className="text-gray-600 text-sm">
                Share the unique room link with visitors
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-blue-600 font-bold">3</span>
              </div>
              <h3 className="font-semibold mb-2">Listen & Read</h3>
              <p className="text-gray-600 text-sm">
                Visitors see live translation on their devices
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mb-16">
          <h3 className="text-lg font-medium text-gray-700 mb-4">
            Quick Broadcast (Temporary Room)
          </h3>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => handleQuickBroadcast('es-to-en')}
              className="inline-flex items-center justify-center px-6 py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
              Spanish → English
            </button>
            <button
              onClick={() => handleQuickBroadcast('en-to-es')}
              className="inline-flex items-center justify-center px-6 py-4 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
              English → Spanish
            </button>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            Start a temporary room with a random URL
          </p>

          {/* Sign in CTA */}
          {!isAuthenticated && (
            <div className="mt-8 p-6 bg-blue-50 rounded-xl max-w-md mx-auto">
              <p className="text-gray-700 mb-3">
                Want to create permanent rooms with custom URLs?
              </p>
              <Link
                to="/login"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Sign in to manage rooms
              </Link>
            </div>
          )}
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border">
            <h3 className="font-semibold text-gray-900 mb-2">
              Real-time Translation
            </h3>
            <p className="text-gray-600 text-sm">
              See translated text appear as the speaker talks, with minimal delay
            </p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border">
            <h3 className="font-semibold text-gray-900 mb-2">Text-to-Speech</h3>
            <p className="text-gray-600 text-sm">
              Optional audio playback of translated text using browser speech
              synthesis
            </p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border">
            <h3 className="font-semibold text-gray-900 mb-2">No App Required</h3>
            <p className="text-gray-600 text-sm">
              Works in any modern browser - just share the link
            </p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border">
            <h3 className="font-semibold text-gray-900 mb-2">Accessibility</h3>
            <p className="text-gray-600 text-sm">
              Adjustable font size for comfortable reading on any device
            </p>
          </div>
        </div>

        {/* Have a link? */}
        <div className="mt-12 text-center text-gray-500 text-sm">
          Have a room link? Enter it directly in your browser's address bar.
        </div>
      </div>
    </div>
  );
}
