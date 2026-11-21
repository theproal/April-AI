import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={`inline-flex items-center justify-center gap-2 rounded-[10px] bg-[#8500e8] hover:bg-[#a000ff] text-white font-medium transition-colors whitespace-nowrap shrink-0 min-h-[44px] ${
          compact ? 'px-3 text-xs' : 'px-4 py-2.5 text-sm'
        }`}
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>{compact ? 'Instalar app' : 'Instalar en Android'}</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowGuide(true)}
        className={`inline-flex items-center justify-center gap-2 rounded-[10px] border border-[#6500a8] bg-[#1b0b2d] font-medium text-[#d9b5ff] hover:bg-[#6500a8] hover:text-white whitespace-nowrap shrink-0 min-h-[44px] active:scale-95 transition-all ${
          compact ? 'w-full px-3 text-xs' : 'w-full px-4 py-2.5 text-sm'
        }`}
      >
        <Smartphone className="w-4 h-4 shrink-0" />
        <span>Instalar en tu teléfono</span>
      </button>

      {showGuide && (
        <div
          onClick={() => setShowGuide(false)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl bg-[#10051d] border border-[#8500ff] p-5 pb-safe sm:p-6 shadow-xl"
          >
            <div className="mx-auto mb-3.5 h-1.5 w-10 rounded-full bg-[#6500a8] sm:hidden" />
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-white">
                Instalar April IA en tu teléfono
              </h3>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Cerrar guía"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#c38bff] hover:bg-[#1b0b2d] active:scale-95"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {isIOS ? (
              <ol className="space-y-2.5 text-sm text-[#d9b5ff] leading-relaxed">
                <li>1. Toca el botón <strong>Compartir</strong> en la barra inferior de Safari.</li>
                <li>2. Desliza y selecciona <strong>Agregar a la pantalla de inicio</strong>.</li>
                <li>3. Confirma tocando <strong>Agregar</strong> para usar April IA como app móvil.</li>
              </ol>
            ) : (
              <ol className="space-y-2.5 text-sm text-[#d9b5ff] leading-relaxed">
                <li>1. Abre el menú del navegador (<strong>⋮</strong> arriba a la derecha en Chrome).</li>
                <li>2. Toca <strong>Instalar aplicación</strong> o <strong>Agregar a la pantalla principal</strong>.</li>
                <li>3. Confirma en <strong>Instalar</strong> para abrir April IA en pantalla completa sin barras del navegador.</li>
              </ol>
            )}
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-5 w-full min-h-[46px] rounded-xl bg-[#8500e8] hover:bg-[#a000ff] text-white text-sm font-medium active:scale-95"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};
