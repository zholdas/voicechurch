import { useState } from 'react';

interface ShareLinkProps {
  roomId: string;
}

export default function ShareLink({ roomId }: ShareLinkProps) {
  const [copied, setCopied] = useState(false);

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

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <p className="text-sm text-blue-700 mb-2 font-medium">
        Share this link with visitors:
      </p>
      <div className="flex gap-2">
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
    </div>
  );
}
