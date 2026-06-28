import { useState, useEffect } from 'react';
import type { DealDetail } from '../types';
import { useAuth } from '../context/AuthContext';

interface OutreachModalProps {
  deal: DealDetail;
  mode: 'whatsapp' | 'email';
  onClose: () => void;
}

export default function OutreachModal({ deal, mode, onClose }: OutreachModalProps) {
  const { user } = useAuth();
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Generate the initial message draft based on templates and AI recommendation
    let template = '';
    
    if (mode === 'whatsapp') {
      template = user?.whatsapp_template || "Hi [Client Name],\n\nI'm reaching out regarding your deal. Here's what our AI recommends:\n\n[AI recommendation]\n\nBest regards,\n[Your Name]";
    } else {
      template = user?.email_template || "Dear [Client Name],\n\nI wanted to share some insights about your deal:\n\n[AI recommendation]\n\nPlease let me know if you have any questions.\n\nBest regards,\n[Your Name]";
    }

    // Prefer English recommendation if available, otherwise Arabic
    const aiText = deal.recommendation_en || deal.recommendation_ar || 'No AI recommendation available.';

    // Replace placeholders
    let draft = template
      .replace(/\[Client Name\]/gi, deal.account_name || 'Client')
      .replace(/\[AI recommendation[^\]]*\]/gi, aiText)
      .replace(/\[Your Name\]/gi, user?.name || 'Sales Representative');

    setMessage(draft);
  }, [deal, mode, user]);

  const handleSend = () => {
    const encodedText = encodeURIComponent(message);
    
    if (mode === 'whatsapp') {
      if (deal.client_phone) {
        const sanitizedPhone = deal.client_phone.replace(/[^0-9]/g, '');
        window.open(`https://wa.me/${sanitizedPhone}?text=${encodedText}`, '_blank');
      } else {
        window.open(`https://wa.me/?text=${encodedText}`, '_blank');
      }
    } else if (mode === 'email' && deal.client_email) {
      const subject = encodeURIComponent(`Regarding ${deal.deal_name}`);
      window.open(`mailto:${deal.client_email}?subject=${subject}&body=${encodedText}`, '_blank');
    }
    
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
      <div 
        className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-2xl w-full max-w-2xl p-6 relative animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4 border-b border-outline-variant pb-4 shrink-0">
          <div className="flex items-center gap-3">
            {mode === 'whatsapp' ? (
              <div className="w-10 h-10 rounded-full bg-[#25D366]/10 text-[#25D366] flex items-center justify-center">
                <span className="material-symbols-outlined">chat</span>
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-secondary/10 text-secondary flex items-center justify-center">
                <span className="material-symbols-outlined">mail</span>
              </div>
            )}
            <div>
              <h2 className="font-headline-md text-headline-md text-on-surface">
                {mode === 'whatsapp' ? 'Review WhatsApp Message' : 'Review Email Message'}
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                To: {mode === 'whatsapp' ? (deal.client_phone || 'Unknown') : (deal.client_email || 'Unknown')} ({deal.account_name})
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

        {/* Editor */}
        <div className="flex-1 overflow-y-auto mb-4 min-h-[300px]">
          <label className="block font-label-sm text-label-sm text-on-surface mb-2">Message Content</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full h-[calc(100%-2rem)] min-h-[250px] p-4 bg-surface border border-outline-variant rounded-xl font-body-md text-body-md text-on-surface focus:outline-none focus:border-secondary transition-colors resize-none"
            placeholder="Type your message here..."
          />
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-outline-variant shrink-0">
          <button 
            onClick={onClose}
            className="px-4 py-2 font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-colors"
          >
            Cancel
          </button>
          
          {mode === 'whatsapp' ? (
            <button
              onClick={handleSend}
              className="px-6 py-2 bg-[#25D366] text-white rounded-lg font-label-md text-label-md hover:bg-[#1da851] transition-colors flex items-center gap-2 shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">send</span>
              Send via WhatsApp
            </button>
          ) : (
            <button
              onClick={handleSend}
              className="px-6 py-2 bg-secondary text-on-secondary rounded-lg font-label-md text-label-md hover:bg-secondary-container hover:text-on-secondary-container transition-colors shadow-sm flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">send</span>
              Send via Email
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

