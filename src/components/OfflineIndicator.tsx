import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 left-4 right-4 lg:bottom-4 lg:left-auto lg:right-6 z-40 flex items-center gap-2.5 rounded-xl bg-[#6500a8] border border-[#c000ff] text-white px-4 py-2.5 text-xs font-medium shadow-lg"
    >
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>Sin conexión — Tus tareas locales siguen disponibles sin internet.</span>
    </div>
  );
};
