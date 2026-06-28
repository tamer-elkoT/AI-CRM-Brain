import { useState } from 'react';
import { useCreateDeal, useAccountNames } from '../hooks/useDeals';
import { useToast } from './ui/Toast';
import { Select } from './ui/Select';
import { X } from 'lucide-react';
import type { DealCreate } from '../types';

interface CreateDealModalProps {
  open: boolean;
  onClose: () => void;
}

const STAGES = [
  'Qualification',
  'Needs Analysis',
  'Value Proposition',
  'Identify Decision Makers',
  'Proposal/Price Quote',
  'Negotiation/Review',
  'Closed Won',
  'Closed Lost',
];

const initialForm: DealCreate = {
  deal_name: '',
  account_name: '',
  contact_name: '',
  owner_name: '',
  amount: 0,
  stage: 'Qualification',
  zoho_probability: 50,
  closing_date: '',
  client_phone: '',
  client_email: '',
};

export default function CreateDealModal({ open, onClose }: CreateDealModalProps) {
  const [form, setForm] = useState<DealCreate>({ ...initialForm });
  const [isNewAccount, setIsNewAccount] = useState(false);
  const createDeal = useCreateDeal();
  const { data: accountNames } = useAccountNames();
  const { toast } = useToast();

  if (!open) return null;

  const handleChange = (field: keyof DealCreate, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAccountSelect = (value: string) => {
    if (value === '__NEW__') {
      setIsNewAccount(true);
      handleChange('account_name', '');
    } else {
      setIsNewAccount(false);
      handleChange('account_name', value);
    }
  };

  const accountOptions = [
    ...(accountNames ?? []).map((name) => ({ value: name, label: name })),
    { value: '__NEW__', label: 'âž• Add New Account' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.deal_name.trim()) return;

    createDeal.mutate(form, {
      onSuccess: (res) => {
        toast({
          title: 'âœ… Deal Created',
          description: res.message,
          variant: 'success',
        });
        setForm({ ...initialForm });
        setIsNewAccount(false);
        onClose();
      },
      onError: (err) => {
        toast({
          title: 'Failed to Create Deal',
          description: err.message || 'Something went wrong.',
          variant: 'destructive',
        });
      },
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[80] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col drawer-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-outline-variant">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">add_circle</span>
              Create New Deal
            </h2>
            <p className="font-label-sm text-label-sm text-on-surface-variant mt-1">Add a deal manually to your pipeline</p>
          </div>
          <button onClick={onClose} className="p-2 text-on-surface-variant hover:bg-surface-variant rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Deal Name */}
          <div>
            <label className="block font-label-sm text-label-sm text-on-surface mb-1">Deal Name *</label>
            <input
              type="text"
              required
              value={form.deal_name}
              onChange={(e) => handleChange('deal_name', e.target.value)}
              placeholder="e.g. Enterprise SaaS License"
              className="w-full px-4 py-2.5 bg-surface border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:outline-none transition-all"
            />
          </div>

          {/* Account Name â€” Dropdown with "Add New" */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-label-sm text-label-sm text-on-surface mb-1">Account Name</label>
              {isNewAccount ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.account_name}
                    onChange={(e) => handleChange('account_name', e.target.value)}
                    placeholder="New account name"
                    autoFocus
                    className="w-full px-4 py-2.5 bg-surface border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsNewAccount(false);
                      handleChange('account_name', '');
                    }}
                    className="px-2 py-1 text-on-surface-variant hover:text-on-surface text-sm shrink-0"
                    title="Back to dropdown"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <Select
                  value={form.account_name || ''}
                  onChange={handleAccountSelect}
                  options={accountOptions}
                  placeholder="Select account..."
                />
              )}
            </div>
            <div>
              <label className="block font-label-sm text-label-sm text-on-surface mb-1">Contact Name</label>
              <input
                type="text"
                value={form.contact_name}
                onChange={(e) => handleChange('contact_name', e.target.value)}
                placeholder="John Doe"
                className="w-full px-4 py-2.5 bg-surface border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:outline-none transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-label-sm text-label-sm text-on-surface mb-1">Deal Owner</label>
              <input
                type="text"
                value={form.owner_name}
                onChange={(e) => handleChange('owner_name', e.target.value)}
                placeholder="Sales rep name"
                className="w-full px-4 py-2.5 bg-surface border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:outline-none transition-all"
              />
            </div>
            <div>
              <label className="block font-label-sm text-label-sm text-on-surface mb-1">Amount ($)</label>
              <input
                type="number"
                min={0}
                value={form.amount}
                onChange={(e) => handleChange('amount', parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-2.5 bg-surface border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:outline-none transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-label-sm text-label-sm text-on-surface mb-1">Stage</label>
              <Select
                value={form.stage || 'Qualification'}
                onChange={(v) => handleChange('stage', v)}
                options={STAGES.map((s) => ({ value: s, label: s }))}
              />
            </div>
            <div>
              <label className="block font-label-sm text-label-sm text-on-surface mb-1">Probability (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={form.zoho_probability}
                onChange={(e) => handleChange('zoho_probability', parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-2.5 bg-surface border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:outline-none transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-label-sm text-label-sm text-on-surface mb-1">Closing Date</label>
              <input
                type="date"
                value={form.closing_date}
                onChange={(e) => handleChange('closing_date', e.target.value)}
                className="w-full px-4 py-2.5 bg-surface border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:outline-none transition-all"
              />
            </div>
            <div>
              <label className="block font-label-sm text-label-sm text-on-surface mb-1">Client Phone</label>
              <input
                type="tel"
                value={form.client_phone}
                onChange={(e) => handleChange('client_phone', e.target.value)}
                placeholder="+966501234567"
                className="w-full px-4 py-2.5 bg-surface border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block font-label-sm text-label-sm text-on-surface mb-1">Client Email</label>
            <input
              type="email"
              value={form.client_email}
              onChange={(e) => handleChange('client_email', e.target.value)}
              placeholder="client@company.com"
              className="w-full px-4 py-2.5 bg-surface border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:outline-none transition-all"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="p-6 border-t border-outline-variant flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={createDeal.isPending || !form.deal_name.trim()}
            className="bg-secondary text-on-secondary px-6 py-2 rounded-lg font-label-md text-label-md flex items-center gap-2 hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50"
          >
            {createDeal.isPending ? (
              <>
                <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                Creating...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">add</span>
                Create Deal
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

