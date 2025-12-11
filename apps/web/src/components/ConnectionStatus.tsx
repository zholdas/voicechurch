import type { ConnectionStatus as Status } from '../lib/types';

interface ConnectionStatusProps {
  status: Status;
}

export default function ConnectionStatus({ status }: ConnectionStatusProps) {
  const statusConfig = {
    disconnected: {
      color: 'bg-gray-400',
      text: 'Disconnected',
    },
    connecting: {
      color: 'bg-yellow-400',
      text: 'Connecting...',
    },
    connected: {
      color: 'bg-green-500',
      text: 'Connected',
    },
    error: {
      color: 'bg-red-500',
      text: 'Error',
    },
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-full ${config.color}`} />
      <span className="text-sm text-gray-600">{config.text}</span>
    </div>
  );
}
