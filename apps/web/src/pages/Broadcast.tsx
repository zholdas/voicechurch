import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams, useParams, useNavigate } from 'react-router-dom';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAudioCapture } from '../hooks/useAudioCapture';
import ConnectionStatus from '../components/ConnectionStatus';
import ShareLink from '../components/ShareLink';
import AudioCapture from '../components/AudioCapture';
import { roomsApi, billingApi, type SubscriptionInfo } from '../lib/api';
import type { ServerMessage, RoomInfo, LanguageCode } from '../lib/types';
import { SUPPORTED_LANGUAGES, getLanguageName } from '../lib/types';

export default function Broadcast() {
  const { roomId: urlRoomId } = useParams<{ roomId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const paramName = searchParams.get('name');
  const paramSlug = searchParams.get('slug');
  const paramSourceLang = searchParams.get('source') as LanguageCode | null;
  const paramTargetLang = searchParams.get('target') as LanguageCode | null;

  // If we have a room ID from URL (existing room), join it
  // Otherwise create a new room
  const isExistingRoom = !!urlRoomId;

  const [roomId, setRoomId] = useState<string | null>(urlRoomId || null);
  const [roomSlug, setRoomSlug] = useState<string | null>(urlRoomId || null);
  const [roomName, setRoomName] = useState<string | null>(paramName);
  const [sourceLanguage, setSourceLanguage] = useState<LanguageCode>(paramSourceLang || 'es');
  const [targetLanguage, setTargetLanguage] = useState<LanguageCode>(paramTargetLang || 'en');
  const [listenerCount, setListenerCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [roomReady, setRoomReady] = useState(false);
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);

  // Billing state
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [minutesRemaining, setMinutesRemaining] = useState<number | null>(null);
  const [usageWarning, setUsageWarning] = useState<number | null>(null);
  const [broadcastStopped, setBroadcastStopped] = useState<string | null>(null);

  const handleMessage = useCallback((message: ServerMessage) => {
    switch (message.type) {
      case 'room_created':
        setRoomId(message.roomId);
        setRoomSlug(message.slug);
        setRoomName(message.name);
        if (message.sourceLanguage) setSourceLanguage(message.sourceLanguage);
        if (message.targetLanguage) setTargetLanguage(message.targetLanguage);
        setRoomReady(true);
        break;
      case 'joined':
        setRoomId(message.roomId);
        if (message.roomName) {
          setRoomName(message.roomName);
        }
        if (message.sourceLanguage) setSourceLanguage(message.sourceLanguage);
        if (message.targetLanguage) setTargetLanguage(message.targetLanguage);
        setListenerCount(message.listenerCount);
        setRoomReady(true);
        break;
      case 'listener_count':
        setListenerCount(message.count);
        break;
      case 'error':
        setErrorMessage(message.message);
        break;
      case 'usage_warning':
        setUsageWarning(message.minutesRemaining);
        setMinutesRemaining(message.minutesRemaining);
        break;
      case 'broadcast_stopped':
        setBroadcastStopped(message.reason);
        // stopRecording will be called via useEffect when broadcastStopped changes
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

  // Connect on mount
  useEffect(() => {
    connect();
  }, [connect]);

  // Load subscription info
  useEffect(() => {
    billingApi.getStatus().then((status) => {
      if (status.configured) {
        billingApi.getSubscription().then(setSubscription).catch(console.error);
      }
    }).catch(console.error);
  }, []);

  // Stop recording when broadcast is stopped by server
  useEffect(() => {
    if (broadcastStopped && isRecording) {
      stopRecording();
    }
  }, [broadcastStopped, isRecording, stopRecording]);

  // Fetch room info for persistent rooms (to get QR code data)
  useEffect(() => {
    if (isExistingRoom && urlRoomId) {
      roomsApi.getRoom(urlRoomId)
        .then(setRoomInfo)
        .catch((err) => console.error('Failed to fetch room info:', err));
    }
  }, [isExistingRoom, urlRoomId]);

  // Create or join room when connected
  useEffect(() => {
    if (isConnected && !roomReady) {
      if (isExistingRoom && urlRoomId) {
        // Join existing room as broadcaster
        send({
          type: 'join_room',
          roomId: urlRoomId,
          role: 'broadcaster',
        });
      } else {
        // Create new temporary room
        send({
          type: 'create_room',
          name: paramName || undefined,
          slug: paramSlug || undefined,
          sourceLanguage: paramSourceLang || 'es',
          targetLanguage: paramTargetLang || 'en',
        });
      }
    }
  }, [isConnected, roomReady, isExistingRoom, urlRoomId, send, paramName, paramSlug, paramSourceLang, paramTargetLang]);

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
          <Link to="/">
            <img src="/logo.svg" alt="WordBeacon" className="h-8" />
          </Link>
          <ConnectionStatus status={status} />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Error display */}
        {errorMessage && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {errorMessage}
            {errorMessage.includes('already has a broadcaster') && (
              <p className="mt-2 text-sm">
                Someone else is already broadcasting in this room.{' '}
                <Link to={`/room/${roomSlug || urlRoomId}`} className="underline">
                  Join as listener instead
                </Link>
              </p>
            )}
          </div>
        )}

        {/* Broadcast stopped warning */}
        {broadcastStopped && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <p className="font-semibold">Broadcast stopped</p>
            <p className="text-sm mt-1">
              {broadcastStopped === 'MINUTES_EXCEEDED'
                ? 'You have exceeded your monthly minutes limit. Please upgrade your plan to continue broadcasting.'
                : 'You have exceeded the maximum number of concurrent listeners for your plan.'}
            </p>
            <Link
              to="/pricing"
              className="inline-block mt-3 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
            >
              Upgrade Plan
            </Link>
          </div>
        )}

        {/* Usage warning */}
        {usageWarning !== null && usageWarning <= 5 && !broadcastStopped && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg">
            <p className="font-semibold flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Low minutes remaining
            </p>
            <p className="text-sm mt-1">
              Only {usageWarning} minute{usageWarning !== 1 ? 's' : ''} remaining in your current billing period.
            </p>
          </div>
        )}

        {/* Room name and languages */}
        <div className="mb-4 text-center">
          {roomName && (
            <h2 className="text-2xl font-bold text-gray-900">{roomName}</h2>
          )}
          <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mt-2 bg-gradient-to-r from-blue-100 to-green-100 text-gray-700">
            {getLanguageName(sourceLanguage)} → {getLanguageName(targetLanguage)}
          </div>
        </div>

        {/* Share link */}
        {(roomSlug || roomId) && (
          <div className="mb-8">
            <ShareLink
              roomId={roomSlug || roomId!}
              roomDbId={roomInfo?.id}
              qrImageUrl={roomInfo?.qrImageUrl}
            />
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

          {/* Subscription usage indicator */}
          {subscription?.usage && subscription.plan && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-600">
                  {subscription.plan.name} Plan
                </span>
                <span className={`font-medium ${
                  subscription.usage.percentUsed >= 90
                    ? 'text-red-600'
                    : subscription.usage.percentUsed >= 75
                    ? 'text-yellow-600'
                    : 'text-green-600'
                }`}>
                  {subscription.usage.minutesRemaining} min remaining
                </span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    subscription.usage.percentUsed >= 90
                      ? 'bg-red-500'
                      : subscription.usage.percentUsed >= 75
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(subscription.usage.percentUsed, 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                <span>Max {subscription.plan.maxListeners} listeners</span>
                <span>{subscription.usage.minutesUsed} / {subscription.usage.minutesLimit} min used</span>
              </div>
            </div>
          )}

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
                translated to {getLanguageName(targetLanguage)} in real-time.
              </p>
              {/* Real-time minutes indicator during broadcast */}
              {minutesRemaining !== null && (
                <p className={`mt-2 text-sm font-medium ${
                  minutesRemaining <= 5 ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {minutesRemaining} minute{minutesRemaining !== 1 ? 's' : ''} remaining
                </p>
              )}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-white rounded-xl shadow p-6">
          <h3 className="font-semibold mb-3">Instructions</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
            <li>Share the link above with visitors who need translation</li>
            <li>Click the button to start broadcasting</li>
            <li>Speak clearly in {getLanguageName(sourceLanguage)}</li>
            <li>Visitors will see the {getLanguageName(targetLanguage)} translation in real-time</li>
            <li>Click again to stop the broadcast</li>
          </ol>
        </div>
      </main>
    </div>
  );
}
