import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAudioCapture } from '../hooks/useAudioCapture';
import ConnectionStatus from '../components/ConnectionStatus';
import ShareLink from '../components/ShareLink';
import AudioCapture from '../components/AudioCapture';
import type { ServerMessage } from '../lib/types';

export default function Broadcast() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [listenerCount, setListenerCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleMessage = useCallback((message: ServerMessage) => {
    switch (message.type) {
      case 'room_created':
        setRoomId(message.roomId);
        break;
      case 'listener_count':
        setListenerCount(message.count);
        break;
      case 'error':
        setErrorMessage(message.message);
        break;
    }
  }, []);

  const { status, connect, send, sendBinary, isConnected } = useWebSocket({
    onMessage: handleMessage,
  });

  const handleAudioData = useCallback(
    (data: ArrayBuffer) => {
      sendBinary(data);
    },
    [sendBinary]
  );

  const { isRecording, error: audioError, startRecording, stopRecording } = useAudioCapture({
    onAudioData: handleAudioData,
  });

  // Connect and create room on mount
  useEffect(() => {
    connect();
  }, [connect]);

  // Create room when connected
  useEffect(() => {
    if (isConnected && !roomId) {
      send({ type: 'create_room' });
    }
  }, [isConnected, roomId, send]);

  const handleStartBroadcast = () => {
    startRecording();
  };

  const handleStopBroadcast = () => {
    stopRecording();
    send({ type: 'end_broadcast' });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-blue-600">
            VoiceChurch
          </Link>
          <ConnectionStatus status={status} />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Error display */}
        {errorMessage && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {errorMessage}
          </div>
        )}

        {/* Share link */}
        {roomId && (
          <div className="mb-8">
            <ShareLink roomId={roomId} />
          </div>
        )}

        {/* Listener count */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm">
            <svg
              className="w-5 h-5 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <span className="text-gray-700">
              <strong>{listenerCount}</strong> listener{listenerCount !== 1 ? 's' : ''} connected
            </span>
          </div>
        </div>

        {/* Broadcast controls */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-xl font-semibold text-center mb-6">
            {isRecording ? 'Broadcasting Live' : 'Ready to Broadcast'}
          </h2>

          <AudioCapture
            isRecording={isRecording}
            error={audioError}
            onStart={handleStartBroadcast}
            onStop={handleStopBroadcast}
          />

          {isRecording && (
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500">
                Speak clearly into your microphone. Your speech will be
                translated to English in real-time.
              </p>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-white rounded-xl shadow p-6">
          <h3 className="font-semibold mb-3">Instructions</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
            <li>Share the link above with visitors who need translation</li>
            <li>Click the button to start broadcasting</li>
            <li>Speak clearly in Spanish</li>
            <li>Visitors will see the English translation in real-time</li>
            <li>Click again to stop the broadcast</li>
          </ol>
        </div>
      </main>
    </div>
  );
}
