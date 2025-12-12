import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();
  const [roomName, setRoomName] = useState('');
  const [roomSlug, setRoomSlug] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const handleCreatePermanentRoom = () => {
    if (!roomName.trim()) return;
    const slug = roomSlug.trim() || roomName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    navigate(`/broadcast?name=${encodeURIComponent(roomName)}&slug=${encodeURIComponent(slug)}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center">
              <svg
                className="w-12 h-12 text-white"
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
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">VoiceChurch</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Real-time speech translation for church services. Break language
            barriers and unite your congregation.
          </p>
        </div>

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
                The speaker starts a broadcast and speaks in Spanish
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
                Visitors see live English translation on their devices
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link
            to="/broadcast"
            className="inline-flex items-center px-8 py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-lg"
          >
            <svg
              className="w-6 h-6 mr-2"
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
            Quick Broadcast
          </Link>
          <p className="mt-4 text-sm text-gray-500">
            Start a temporary room with a random URL
          </p>

          {/* Create Permanent Room */}
          <div className="mt-8">
            {!showCreateForm ? (
              <button
                onClick={() => setShowCreateForm(true)}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Or create a permanent room with custom URL
              </button>
            ) : (
              <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-6 text-left">
                <h3 className="font-semibold text-gray-900 mb-4">Create Permanent Room</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Room Name *
                    </label>
                    <input
                      type="text"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      placeholder="e.g., Sunday Service"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Custom URL (optional)
                    </label>
                    <div className="flex items-center">
                      <span className="text-gray-500 text-sm mr-1">/room/</span>
                      <input
                        type="text"
                        value={roomSlug}
                        onChange={(e) => setRoomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        placeholder="sunday-service"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Use lowercase letters, numbers, and hyphens
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleCreatePermanentRoom}
                      disabled={!roomName.trim()}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Create Room
                    </button>
                    <button
                      onClick={() => {
                        setShowCreateForm(false);
                        setRoomName('');
                        setRoomSlug('');
                      }}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Features */}
        <div className="mt-20 grid md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border">
            <h3 className="font-semibold text-gray-900 mb-2">Real-time Translation</h3>
            <p className="text-gray-600 text-sm">
              See translated text appear as the speaker talks, with minimal delay
            </p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border">
            <h3 className="font-semibold text-gray-900 mb-2">Text-to-Speech</h3>
            <p className="text-gray-600 text-sm">
              Optional audio playback of translated text using browser speech synthesis
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
      </div>
    </div>
  );
}
