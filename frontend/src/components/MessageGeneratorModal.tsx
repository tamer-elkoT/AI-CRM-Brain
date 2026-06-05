import { useState } from 'react';
import { useGenerateMessage, useMarkFollowedUp } from '../hooks/useDeals';
import type { RankedDeal, DealDetail } from '../types';

interface MessageGeneratorModalProps {
  deal: RankedDeal | DealDetail;
  salesRepName?: string;
  onClose: () => void;
}

export default function MessageGeneratorModal({ deal, salesRepName, onClose }: MessageGeneratorModalProps) {
  const dealId = 'deal_id' in deal ? deal.deal_id : deal.deal_id;
  const generateMsg = useGenerateMessage();
  const markFollowed = useMarkFollowedUp();

  const [message, setMessage] = useState('');
  const [isGenerated, setIsGenerated] = useState(false);

  const handleGenerate = () => {
    generateMsg.mutate(
      { dealId, salesRepName },
      {
        onSuccess: (data) => {
          setMessage(data.generated_message);
          setIsGenerated(true);
        },
      }
    );
  };

  const handleSendWhatsApp = () => {
    const phone = deal.client_phone;
    const encoded = encodeURIComponent(message);
    if (phone) {
      const sanitized = phone.replace(/[^0-9]/g, '');
      window.open(`https://wa.me/${sanitized}?text=${encoded}`, '_blank');
    } else {
      // No phone number available — open WhatsApp with message only
      // User can manually select the recipient
      window.open(`https://wa.me/?text=${encoded}`, '_blank');
    }

    // Mark as followed up
    markFollowed.mutate({
      dealId,
      data: {
        channel: 'whatsapp',
        message_sent: message,
        notes: 'Sent via AI-generated message',
      },
    });

    onClose();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-2xl w-full max-w-2xl p-6 relative animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4 border-b border-outline-variant pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-tertiary/10 text-tertiary flex items-center justify-center">
              <span className="material-symbols-outlined">auto_awesome</span>
            </div>
            <div>
              <h2 className="font-headline-md text-headline-md text-on-surface">
                AI Message Generator
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Powered by Grok • {deal.account_name} — {deal.deal_name || ('deal_name' in deal ? deal.deal_name : '')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-on-surface-variant hover:bg-surface-variant rounded-full transition-colors"
            aria-label="Close"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto mb-4 min-h-[250px]">
          {!isGenerated ? (
            <div className="flex flex-col items-center justify-center h-full py-10">
              {generateMsg.isPending ? (
                <>
                  <div className="w-16 h-16 rounded-full bg-tertiary/10 flex items-center justify-center mb-4 animate-pulse">
                    <span className="material-symbols-outlined text-tertiary text-[32px]">auto_awesome</span>
                  </div>
                  <p className="font-body-lg text-body-lg text-on-surface mb-1">Generating message with Grok AI...</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">Crafting a personalized message for your client</p>
                  <div className="mt-6 flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-tertiary animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-tertiary animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-tertiary animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </>
              ) : generateMsg.isError ? (
                <>
                  <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center mb-4">
                    <span className="material-symbols-outlined text-error text-[32px]">error</span>
                  </div>
                  <p className="font-body-lg text-body-lg text-on-surface mb-1">Generation Failed</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">{generateMsg.error?.message || 'Unknown error'}</p>
                  <button
                    onClick={handleGenerate}
                    className="px-4 py-2 bg-error text-on-error rounded-lg font-label-md text-label-md hover:bg-error/90 transition-colors"
                  >
                    Try Again
                  </button>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-tertiary/10 flex items-center justify-center mb-4">
                    <span className="material-symbols-outlined text-tertiary text-[32px]">auto_awesome</span>
                  </div>
                  <p className="font-body-lg text-body-lg text-on-surface mb-1">Generate AI Message</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mb-6 text-center max-w-sm">
                    Grok AI will craft a personalized WhatsApp message based on the deal context, AI score, and stage.
                  </p>
                  <button
                    onClick={handleGenerate}
                    className="px-6 py-2.5 bg-tertiary text-on-tertiary rounded-lg font-label-md text-label-md hover:bg-tertiary/90 transition-colors flex items-center gap-2 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                    Generate Message
                  </button>
                </>
              )}
            </div>
          ) : (
            <div>
              <label className="block font-label-sm text-label-sm text-on-surface mb-2">
                Generated Message <span className="text-on-surface-variant">(editable)</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full min-h-[200px] p-4 bg-surface border border-outline-variant rounded-xl font-body-md text-body-md text-on-surface focus:outline-none focus:border-tertiary transition-colors resize-none"
                placeholder="Generated message will appear here..."
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-outline-variant shrink-0">
          <div className="flex items-center gap-2">
            {isGenerated && (
              <>
                <button
                  onClick={handleGenerate}
                  disabled={generateMsg.isPending}
                  className="px-3 py-2 font-label-md text-label-md text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-lg transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">refresh</span>
                  Regenerate
                </button>
                <button
                  onClick={handleCopy}
                  className="px-3 py-2 font-label-md text-label-md text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-lg transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">content_copy</span>
                  Copy
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-colors"
            >
              Cancel
            </button>

            {isGenerated && (
              <button
                onClick={handleSendWhatsApp}
                className="px-6 py-2 bg-[#25D366] text-white rounded-lg font-label-md text-label-md hover:bg-[#1da851] transition-colors flex items-center gap-2 shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">send</span>
                {deal.client_phone ? 'Send via WhatsApp' : 'Send via WhatsApp (select contact)'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
