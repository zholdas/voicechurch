import { useState, useCallback } from 'react';
import type { QRInfo } from '../lib/types';
import { roomsApi } from '../lib/api';

interface QRCodeDisplayProps {
  roomId: string;
  qrImageUrl: string | null;
  scanCount?: number;
  compact?: boolean;
}

export default function QRCodeDisplay({
  roomId,
  qrImageUrl,
  scanCount,
  compact = false,
}: QRCodeDisplayProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrInfo, setQrInfo] = useState<QRInfo | null>(
    qrImageUrl ? { qrId: '', qrImageUrl, scanCount: scanCount || 0 } : null
  );

  const handleGenerateQR = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const info = await roomsApi.generateQR(roomId);
      setQrInfo(info);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate QR code');
    } finally {
      setIsLoading(false);
    }
  }, [roomId]);

  const handleDownload = useCallback(async () => {
    if (!qrInfo?.qrImageUrl) return;

    try {
      // Fetch the image
      const response = await fetch(qrInfo.qrImageUrl);
      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `qr-code-${roomId}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download QR code:', err);
      // Fallback: open in new tab
      window.open(qrInfo.qrImageUrl, '_blank');
    }
  }, [qrInfo, roomId]);

  const handleRefreshStats = useCallback(async () => {
    try {
      const info = await roomsApi.getQRInfo(roomId);
      setQrInfo(info);
    } catch (err) {
      console.error('Failed to refresh QR stats:', err);
    }
  }, [roomId]);

  if (!qrInfo?.qrImageUrl) {
    return (
      <div className={compact ? 'inline-flex' : 'flex flex-col items-center gap-2'}>
        <button
          onClick={handleGenerateQR}
          disabled={isLoading}
          className={`${
            compact
              ? 'px-3 py-1.5 text-sm'
              : 'px-4 py-2'
          } border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50`}
        >
          {isLoading ? 'Generating...' : 'Generate QR Code'}
        </button>
        {error && (
          <p className="text-red-500 text-sm">{error}</p>
        )}
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <img
          src={qrInfo.qrImageUrl}
          alt="Room QR Code"
          className="w-10 h-10 rounded"
        />
        <button
          onClick={handleDownload}
          className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
          title="Download QR Code"
        >
          Download
        </button>
        {qrInfo.scanCount !== undefined && qrInfo.scanCount > 0 && (
          <span className="text-xs text-gray-500">
            {qrInfo.scanCount} scans
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 p-4 bg-white rounded-xl shadow">
      <h3 className="font-semibold text-gray-700">Room QR Code</h3>

      <div className="p-3 bg-white border rounded-lg">
        <img
          src={qrInfo.qrImageUrl}
          alt="Room QR Code"
          className="w-48 h-48"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download
        </button>
      </div>

      {qrInfo.scanCount !== undefined && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <span>{qrInfo.scanCount} scans</span>
          <button
            onClick={handleRefreshStats}
            className="text-blue-600 hover:underline text-xs"
          >
            Refresh
          </button>
        </div>
      )}

      <p className="text-xs text-gray-500 text-center">
        Scan this QR code to join the room
      </p>
    </div>
  );
}
