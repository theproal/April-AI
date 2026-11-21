import React, { useState } from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';
import type { ConfirmationRequest } from '../types';

interface ConfirmationModalProps {
  request: ConfirmationRequest | null;
  onClose: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ request, onClose }) => {
  const [submitting, setSubmitting] = useState(false);

  if (!request) return null;

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await request.onConfirm();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      onClick={() => {
        if (!submitting) onClose();
      }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md max-h-[90dvh] overflow-y-auto touch-scroll rounded-t-3xl sm:rounded-2xl bg-[#10051d] border border-[#8500ff] p-5 pb-safe sm:p-6 shadow-2xl"
      >
        <div className="mx-auto mb-3.5 h-1.5 w-10 rounded-full bg-[#6500a8] sm:hidden" />

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                request.destructive
                  ? 'bg-[#ff3b7f]/15 text-[#ff6ea0]'
                  : 'bg-[#8500ff]/20 text-[#d9aaff]'
              }`}
            >
              {request.destructive ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <Check className="w-5 h-5" />
              )}
            </div>
            <h3 id="confirm-modal-title" className="text-lg font-semibold text-white">
              {request.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Cerrar confirmación"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#c38bff] hover:bg-[#1b0b2d] active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="mt-3 text-sm text-[#d9b5ff] leading-relaxed">{request.description}</p>

        {request.details.length > 0 && (
          <div className="mt-4 rounded-xl bg-[#1b0b2d] border border-[#6500a8] p-3.5 space-y-1.5">
            {request.details.map((line, i) => (
              <p key={i} className="text-xs text-white break-words">
                {line}
              </p>
            ))}
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="min-h-[46px] px-4 py-2.5 rounded-xl border border-[#6500a8] bg-[#1b0b2d] text-sm font-medium text-[#d9b5ff] hover:bg-[#6500a8]/40 whitespace-nowrap active:scale-95"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className={`min-h-[46px] px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all active:scale-95 whitespace-nowrap disabled:opacity-60 ${
              request.destructive
                ? 'bg-[#c91c5d] hover:bg-[#e0246b]'
                : 'bg-[#8500e8] hover:bg-[#a000ff]'
            }`}
          >
            {submitting ? 'Procesando...' : request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
