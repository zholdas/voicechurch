import { useState, useCallback } from 'react';
import QRCode from 'qrcode';
import { roomsApi } from '../lib/api';
import type { QRInfo } from '../lib/types';

interface ShareLinkProps {
  roomId: string;
  roomDbId?: string; // Database ID for QR code generation (for persistent rooms)
  qrImageUrl?: string | null;
}

export default function ShareLink({ roomId, roomDbId, qrImageUrl }: ShareLinkProps) {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [qrInfo, setQrInfo] = useState<QRInfo | null>(
    qrImageUrl ? { qrId: '', qrImageUrl, scanCount: 0 } : null
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [clientQrUrl, setClientQrUrl] = useState<string | null>(null);

  const shareUrl = `${window.location.origin}/room/${roomId}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Server-side QR generation (for persistent rooms)
  const handleGenerateServerQR = useCallback(async () => {
    if (!roomDbId) return;
    setIsGenerating(true);
    try {
      const info = await roomsApi.generateQR(roomDbId);
      setQrInfo(info);
      setShowQR(true);
    } catch (err) {
      console.error('Failed to generate QR:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [roomDbId]);

  // Client-side QR generation (for temporary rooms)
  const handleGenerateClientQR = useCallback(async () => {
    setIsGenerating(true);
    try {
      const dataUrl = await QRCode.toDataURL(shareUrl, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
      setClientQrUrl(dataUrl);
      setShowQR(true);
    } catch (err) {
      console.error('Failed to generate QR:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [shareUrl]);

  const handleGenerateQR = useCallback(() => {
    if (roomDbId) {
      handleGenerateServerQR();
    } else {
      handleGenerateClientQR();
    }
  }, [roomDbId, handleGenerateServerQR, handleGenerateClientQR]);

  const handleDownloadQR = useCallback(async () => {
    const qrUrl = qrInfo?.qrImageUrl || clientQrUrl;
    if (!qrUrl) return;

    try {
      if (qrUrl.startsWith('data:')) {
        // Client-generated QR (data URL)
        const link = document.createElement('a');
        link.href = qrUrl;
        link.download = `qr-code-${roomId}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // Server-generated QR (URL)
        const response = await fetch(qrUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `qr-code-${roomId}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Failed to download QR:', err);
      if (qrUrl && !qrUrl.startsWith('data:')) {
        window.open(qrUrl, '_blank');
      }
    }
  }, [qrInfo, clientQrUrl, roomId]);

  const currentQrUrl = qrInfo?.qrImageUrl || clientQrUrl;
  const hasQR = !!currentQrUrl;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <p className="text-sm text-blue-700 mb-2 font-medium">
        Share this link with visitors:
      </p>
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          readOnly
          value={shareUrl}
          className="flex-1 px-3 py-2 bg-white border border-blue-300 rounded-md text-sm font-mono"
        />
        <button
          onClick={copyToClipboard}
          className={`px-4 py-2 rounded-md text-white text-sm font-medium transition-colors ${
            copied
              ? 'bg-green-500'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {/* QR Code section - always shown */}
      <div className="border-t border-blue-200 pt-3 mt-3">
        {hasQR ? (
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowQR(!showQR)}
              className="text-sm text-blue-700 hover:underline"
            >
              {showQR ? 'Hide QR Code' : 'Show QR Code'}
            </button>
            {showQR && (
              <>
                <div className="p-2 bg-white rounded">
                  <img src={currentQrUrl} alt="QR Code" className="w-24 h-24" />
                </div>
                <button
                  onClick={handleDownloadQR}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Download
                </button>
              </>
            )}
          </div>
        ) : (
          <button
            onClick={handleGenerateQR}
            disabled={isGenerating}
            className="text-sm text-blue-700 hover:underline disabled:opacity-50"
          >
            {isGenerating ? 'Generating...' : 'Generate QR Code'}
          </button>
        )}
      </div>
    </div>
  );
}
