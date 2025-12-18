import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function JoinRoom() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedCode = code.trim();

    if (!trimmedCode) {
      setError('Please enter a room code');
      return;
    }

    // Navigate to the room - server will validate if it exists
    navigate(`/room/${trimmedCode}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/">
            <img src="/logo.svg" alt="WordBeacon" className="h-8" />
          </Link>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-16">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
            Join a Room
          </h1>
          <p className="text-gray-600 text-center mb-8">
            Enter the room code to start listening
          </p>

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
                Room Code
              </label>
              <input
                id="code"
                type="text"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setError('');
                }}
                placeholder="e.g. ABC12345"
                className={`w-full px-4 py-3 border rounded-lg text-lg font-mono tracking-wider text-center uppercase ${
                  error ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-amber-500'
                } focus:outline-none focus:ring-2`}
                maxLength={20}
                autoComplete="off"
                autoFocus
              />
              {error && (
                <p className="mt-2 text-sm text-red-600">{error}</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full px-6 py-3 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition-colors"
            >
              Join Room
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-gray-500 text-sm text-center">
              Don't have a code? Ask your broadcaster for the room code or scan their QR code.
            </p>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link to="/" className="text-amber-600 hover:text-amber-700 text-sm font-medium">
            &larr; Back to Home
          </Link>
        </div>
      </main>
    </div>
  );
}
