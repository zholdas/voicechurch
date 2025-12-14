import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useWebSocket } from '../hooks/useWebSocket';
import { useTranscript } from '../hooks/useTranscript';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';
import { useAudioPlayback } from '../hooks/useAudioPlayback';
import ConnectionStatus from '../components/ConnectionStatus';
import TranscriptDisplay from '../components/TranscriptDisplay';
import FontControls from '../components/FontControls';
import type { ServerMessage } from '../lib/types';

// Calculate responsive base font size based on screen
function getResponsiveFontSize(): number {
  const width = window.innerWidth;
  const height = window.innerHeight;

  // For TV/large screens (>1920px width or >1080px height)
  if (width > 1920 || height > 1080) {
    return 32;
  }
  // For desktop/laptop
  if (width > 1024) {
    return 24;
  }
  // For tablet
  if (width > 768) {
    return 22;
  }
  // For mobile
  return 20;
}

export default function Listen() {
  const { roomId } = useParams<{ roomId: string }>();
  const [roomName, setRoomName] = useState<string | null>(null);
  const [broadcastActive, setBroadcastActive] = useState(false);
  const [listenerCount, setListenerCount] = useState(0);
  const [fontSize, setFontSize] = useState(() => getResponsiveFontSize());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Update font size on resize
  useEffect(() => {
    const handleResize = () => {
      // Only update if user hasn't manually changed font size
      // (we detect this by checking if current size matches any responsive breakpoint)
      const responsiveSize = getResponsiveFontSize();
      setFontSize(prev => {
        // If previous size was a responsive size, update it
        if ([20, 22, 24, 32].includes(prev)) {
          return responsiveSize;
        }
        return prev; // Keep user's manual choice
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { entries, addTranscript, clearTranscript } = useTranscript();
  const { isEnabled: browserTtsEnabled, toggle: toggleBrowserTts, speak: speakBrowser } = useSpeechSynthesis();
  const { isEnabled: serverTtsEnabled, toggle: toggleServerTts, play: playServerAudio, stop: stopServerAudio } = useAudioPlayback();

  // Combined TTS state - prefer server TTS when audio is available
  const ttsEnabled = serverTtsEnabled || browserTtsEnabled;

  // Toggle both TTS systems together
  const toggleTts = useCallback(() => {
    if (ttsEnabled) {
      // Turn off both
      if (serverTtsEnabled) {
        toggleServerTts();
        stopServerAudio();
      }
      if (browserTtsEnabled) {
        toggleBrowserTts();
      }
    } else {
      // Turn on both (server TTS will be used if audio is available, browser as fallback)
      toggleServerTts();
      toggleBrowserTts();
    }
  }, [ttsEnabled, serverTtsEnabled, browserTtsEnabled, toggleServerTts, toggleBrowserTts, stopServerAudio]);

  const handleMessage = useCallback(
    (message: ServerMessage) => {
      switch (message.type) {
        case 'joined':
          setListenerCount(message.listenerCount);
          if (message.roomName) {
            setRoomName(message.roomName);
          }
          break;
        case 'broadcast_started':
          setBroadcastActive(true);
          clearTranscript();
          break;
        case 'broadcast_ended':
          setBroadcastActive(false);
          break;
        case 'transcript':
          // Если получаем транскрипт, значит трансляция активна
          setBroadcastActive(true);
          addTranscript(
            message.source,
            message.translated,
            message.isFinal,
            message.timestamp
          );
          // Play audio for final transcripts
          if (message.isFinal && ttsEnabled) {
            if (message.audio && serverTtsEnabled) {
              // Server-generated TTS (Google Cloud TTS)
              playServerAudio(message.audio);
            } else if (browserTtsEnabled) {
              // Fallback to browser TTS
              speakBrowser(message.translated);
            }
          }
          break;
        case 'listener_count':
          setListenerCount(message.count);
          break;
        case 'error':
          setErrorMessage(message.message);
          break;
      }
    },
    [addTranscript, clearTranscript, speakBrowser, playServerAudio, ttsEnabled, serverTtsEnabled, browserTtsEnabled]
  );

  const { status, connect, send, isConnected } = useWebSocket({
    onMessage: handleMessage,
  });

  // Connect on mount
  useEffect(() => {
    connect();
  }, [connect]);

  // Join room when connected
  useEffect(() => {
    if (isConnected && roomId) {
      send({ type: 'join_room', roomId, role: 'listener' });
    }
  }, [isConnected, roomId, send]);

  return (
    <div className="listen-container bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm flex-shrink-0">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/">
              <img src="/logo.svg" alt="WordBeacon" className="h-6" />
            </Link>
            {roomName && (
              <span className="text-gray-400">|</span>
            )}
            {roomName && (
              <span className="text-gray-700 font-medium">{roomName}</span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              {listenerCount} listener{listenerCount !== 1 ? 's' : ''}
            </span>
            <ConnectionStatus status={status} />
          </div>
        </div>
      </header>

      {/* Error display */}
      {errorMessage && (
        <div className="bg-red-50 border-b border-red-200 text-red-700 px-4 py-3 text-center">
          {errorMessage}
        </div>
      )}

      {/* Broadcast status */}
      {!broadcastActive && isConnected && (
        <div className="bg-yellow-50 border-b border-yellow-200 text-yellow-800 px-4 py-3 text-center">
          Waiting for broadcast to start...
        </div>
      )}

      {broadcastActive && (
        <div className="bg-green-50 border-b border-green-200 text-green-800 px-4 py-3 text-center flex items-center justify-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          Live broadcast in progress
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col w-full px-4 lg:px-4 xl:px-6 py-4 min-h-0">
        <TranscriptDisplay entries={entries} fontSize={fontSize} />
      </main>

      {/* Controls */}
      <footer className="bg-white border-t shadow-lg flex-shrink-0">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <FontControls fontSize={fontSize} onFontSizeChange={setFontSize} />

          <button
            onClick={toggleTts}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              ttsEnabled
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {ttsEnabled ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                />
              )}
            </svg>
            <span className="text-sm font-medium">
              {ttsEnabled ? 'Audio On' : 'Audio Off'}
            </span>
          </button>
        </div>
      </footer>
    </div>
  );
}
