interface AudioCaptureProps {
  isRecording: boolean;
  error: string | null;
  onStart: () => void;
  onStop: () => void;
}

export default function AudioCapture({
  isRecording,
  error,
  onStart,
  onStop,
}: AudioCaptureProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm max-w-md text-center">
          <p className="font-medium mb-1">Microphone access denied</p>
          <p className="text-xs">
            Click the lock icon (🔒) in the address bar → Allow microphone access → Refresh the page
          </p>
        </div>
      )}

      <button
        onClick={isRecording ? onStop : onStart}
        className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all ${
          isRecording
            ? 'bg-red-500 hover:bg-red-600'
            : 'bg-blue-500 hover:bg-blue-600'
        }`}
      >
        {isRecording && (
          <>
            <div className="absolute inset-0 rounded-full bg-red-500 pulse-ring" />
            <div className="absolute inset-0 rounded-full bg-red-500 pulse-ring animation-delay-500" />
          </>
        )}
        <span className="relative z-10 text-white text-sm font-medium">
          {isRecording ? 'Stop' : 'Start'}
        </span>
      </button>

      <p className="text-sm text-gray-600">
        {isRecording ? 'Broadcasting live...' : 'Click to start broadcasting'}
      </p>
    </div>
  );
}
