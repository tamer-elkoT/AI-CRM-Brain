import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi } from '../services/api';
import type { TemplateUpdateRequest } from '../types';

interface ProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileDrawer({ isOpen, onClose }: ProfileDrawerProps) {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: ['user_me'],
    queryFn: userApi.getMe,
    enabled: isOpen,
  });

  const [formData, setFormData] = useState<TemplateUpdateRequest>({});
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Sync form state when user data loads
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        username: user.username || '',
        account_name: user.account_name || '',
        business_field: user.business_field || '',
        phone_number: user.phone_number || '',
        whatsapp_template: user.whatsapp_template || '',
        email_template: user.email_template || '',
      });
    }
  }, [user]);

  const updateMutation = useMutation({
    mutationFn: (data: TemplateUpdateRequest) => userApi.updateMe(data),
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(['user_me'], updatedUser);
      setSuccessMsg('Profile updated successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.detail || 'Failed to update profile.');
      setTimeout(() => setErrorMsg(''), 3000);
    },
  });

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[80] transition-opacity" onClick={onClose} />
      
      <div className="fixed inset-y-0 right-0 z-[80] w-full md:w-96 bg-surface-container-low shadow-level-3 border-l border-outline-variant flex flex-col drawer-slide-in-right">
        <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface sticky top-0">
          <h2 className="font-title-lg text-on-surface">Profile Settings</h2>
          <button onClick={onClose} className="p-2 hover:bg-surface-variant rounded-full text-on-surface-variant transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                updateMutation.mutate(formData);
              }}
              className="space-y-4"
            >
              <div className="flex items-center space-x-3 mb-6 bg-surface-container p-4 rounded-xl">
                <div className="w-12 h-12 bg-primary-container text-on-primary-container rounded-full flex items-center justify-center font-title-lg uppercase">
                  {user?.name?.charAt(0) || user?.email?.charAt(0) || '?'}
                </div>
                <div>
                  <p className="font-label-lg text-on-surface">{user?.email}</p>
                  <p className="font-body-sm text-primary uppercase tracking-wider">{user?.role?.replace('_', ' ')}</p>
                </div>
              </div>

              {/* â”€â”€ Basic Info â”€â”€ */}
              <div className="space-y-3">
                <h3 className="font-label-md text-on-surface-variant uppercase tracking-wider">Basic Info</h3>
                
                <div>
                  <label className="block font-label-sm text-on-surface-variant mb-1">Full Name</label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-surface border border-outline-variant rounded-md px-3 py-2 text-on-surface font-body-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block font-label-sm text-on-surface-variant mb-1">Username (Unique)</label>
                  <input
                    type="text"
                    value={formData.username || ''}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full bg-surface border border-outline-variant rounded-md px-3 py-2 text-on-surface font-body-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block font-label-sm text-on-surface-variant mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={formData.phone_number || ''}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                    className="w-full bg-surface border border-outline-variant rounded-md px-3 py-2 text-on-surface font-body-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* â”€â”€ Company Info â”€â”€ */}
              <div className="space-y-3 pt-4 border-t border-outline-variant">
                <h3 className="font-label-md text-on-surface-variant uppercase tracking-wider">Company</h3>
                
                <div>
                  <label className="block font-label-sm text-on-surface-variant mb-1">Account / Company Name</label>
                  <input
                    type="text"
                    value={formData.account_name || ''}
                    onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                    className="w-full bg-surface border border-outline-variant rounded-md px-3 py-2 text-on-surface font-body-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block font-label-sm text-on-surface-variant mb-1">Business Field</label>
                  <input
                    type="text"
                    value={formData.business_field || ''}
                    onChange={(e) => setFormData({ ...formData, business_field: e.target.value })}
                    className="w-full bg-surface border border-outline-variant rounded-md px-3 py-2 text-on-surface font-body-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* â”€â”€ Templates â”€â”€ */}
              <div className="space-y-3 pt-4 border-t border-outline-variant">
                <h3 className="font-label-md text-on-surface-variant uppercase tracking-wider">Outreach Templates</h3>
                
                <div>
                  <label className="block font-label-sm text-on-surface-variant mb-1">WhatsApp Template</label>
                  <textarea
                    value={formData.whatsapp_template || ''}
                    onChange={(e) => setFormData({ ...formData, whatsapp_template: e.target.value })}
                    rows={3}
                    placeholder="e.g., Hi {Client Name}, this is {My Name} from {Company}..."
                    className="w-full bg-surface border border-outline-variant rounded-md px-3 py-2 text-on-surface font-body-md focus:outline-none focus:ring-2 focus:ring-primary custom-scrollbar resize-y"
                  />
                </div>

                <div>
                  <label className="block font-label-sm text-on-surface-variant mb-1">Email Template</label>
                  <textarea
                    value={formData.email_template || ''}
                    onChange={(e) => setFormData({ ...formData, email_template: e.target.value })}
                    rows={3}
                    className="w-full bg-surface border border-outline-variant rounded-md px-3 py-2 text-on-surface font-body-md focus:outline-none focus:ring-2 focus:ring-primary custom-scrollbar resize-y"
                  />
                </div>
              </div>

              {successMsg && (
                <div className="bg-primary-container text-on-primary-container p-3 rounded-lg text-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  {successMsg}
                </div>
              )}
              {errorMsg && (
                <div className="bg-error-container text-on-error-container p-3 rounded-lg text-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  {errorMsg}
                </div>
              )}

              <div className="pt-4 pb-8">
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="w-full bg-primary text-on-primary py-2.5 rounded-lg font-label-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {updateMutation.isPending ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[20px]">save</span>
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

