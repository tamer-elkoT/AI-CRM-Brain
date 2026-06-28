import { useState, useRef } from 'react';
import { useTriggerSync } from '../hooks/useDeals';
import { useToast } from '../components/ui/Toast';
import { UploadCloud, FileSpreadsheet, Loader2 } from 'lucide-react';
import { ingestionApi } from '../services/api';

interface CrmCard {
  name: string;
  icon: string;
  description: string;
  status: 'connected' | 'coming_soon';
}

const CRM_CARDS: CrmCard[] = [
  { name: 'Zoho CRM', icon: 'cloud_sync', description: 'Sync deals, contacts, and accounts from your Zoho CRM workspace.', status: 'connected' },
  { name: 'Salesforce', icon: 'cloud', description: 'Import your Salesforce pipeline data for AI-powered analysis.', status: 'coming_soon' },
  { name: 'HubSpot', icon: 'hub', description: 'Connect your HubSpot deals and contacts for AI predictions.', status: 'coming_soon' },
];

export default function Integrations() {
  const syncMutation = useTriggerSync();
  const { toast } = useToast();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadFile(file);
    }
  };

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await ingestionApi.uploadCustomData(formData, (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total ?? progressEvent.loaded));
        setUploadProgress(percentCompleted);
      });
      
      toast({
        title: 'Upload Complete',
        description: res.message,
        variant: 'success',
      });
    } catch (error: any) {
      toast({
        title: 'Upload Failed',
        description: error.response?.data?.detail || 'An error occurred during upload',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <>
      {/* Header */}
      <header className="bg-surface border-b border-outline-variant sticky top-[48px] z-20">
        <div className="flex justify-between items-center px-margin-mobile md:px-margin-desktop h-20 w-full max-w-max-width mx-auto">
          <div className="flex-1">
            <h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">Integrations</h2>
            <p className="font-label-sm text-label-sm text-on-surface-variant mt-1">Connect your CRM data sources</p>
          </div>
        </div>
      </header>

      <div className="p-margin-mobile md:p-margin-desktop max-w-max-width mx-auto w-full flex-1 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* CRM Cards */}
          {CRM_CARDS.map((crm) => (
            <div
              key={crm.name}
              className={`bg-surface-container-lowest border rounded-xl p-6 flex flex-col transition-all duration-200 ${
                crm.status === 'connected'
                  ? 'border-secondary shadow-level-1'
                  : 'border-outline-variant opacity-70'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center overflow-hidden">
                  {crm.name === 'Zoho CRM' ? (
                    <img src="/zoho_logo.png" alt="Zoho CRM" className="w-10 h-10 object-contain" />
                  ) : (
                    <span className={`material-symbols-outlined text-2xl ${crm.status === 'connected' ? 'text-secondary' : 'text-on-surface-variant'}`}>
                      {crm.icon}
                    </span>
                  )}
                </div>
                {crm.status === 'connected' && (
                  <span className="flex items-center gap-1 px-2.5 py-1 bg-secondary/10 text-secondary rounded-full font-label-sm text-label-sm">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                    Connected
                  </span>
                )}
                {crm.status === 'coming_soon' && (
                  <span className="px-2.5 py-1 bg-surface-container-high text-on-surface-variant rounded-full font-label-sm text-label-sm">
                    Coming Soon
                  </span>
                )}
              </div>

              <h3 className="font-headline-md text-headline-md text-on-surface mb-2">{crm.name}</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant flex-1 mb-6">{crm.description}</p>

              {crm.status === 'connected' ? (
                <button
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending}
                  className="w-full py-3 bg-secondary text-on-secondary font-label-md text-label-md rounded-lg flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  <span className={`material-symbols-outlined text-[18px] ${syncMutation.isPending ? 'animate-spin' : ''}`}>sync</span>
                  {syncMutation.isPending ? 'Syncing...' : 'Re-Sync Data'}
                </button>
              ) : (
                <button
                  disabled
                  className="w-full py-3 bg-surface-container-high text-on-surface-variant font-label-md text-label-md rounded-lg cursor-not-allowed"
                >
                  Not Available
                </button>
              )}
            </div>
          ))}

          {/* Custom File Upload Dropzone */}
          <div
            className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-all min-h-[280px] bg-white/50 backdrop-blur ${
              isUploading ? 'border-secondary bg-surface-container-low' : 'border-slate-300 hover:border-secondary hover:bg-surface-container-low/50 cursor-pointer'
            }`}
            onClick={() => !isUploading && fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".csv, .xlsx"
              onChange={handleFileChange}
            />

            {!isUploading ? (
              <>
                <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4 text-slate-500">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <h3 className="font-headline-md text-headline-md text-on-surface mb-2">Upload Custom Data</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant max-w-[220px] mb-4">
                  Drag and drop your .csv or .xlsx pipeline data here.
                </p>
                <button className="px-4 py-2 rounded-md bg-surface border border-slate-200 shadow-sm font-label-sm text-on-surface hover:bg-slate-50 transition-colors flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4" />
                  Browse Files
                </button>
              </>
            ) : (
              <div className="w-full flex flex-col items-center">
                <Loader2 className="w-10 h-10 text-secondary animate-spin mb-4" />
                <h3 className="font-headline-md text-headline-md text-on-surface mb-2">Parsing Data...</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant mb-6">Extracting fields and mapping schema</p>
                
                <div className="w-full max-w-[200px] h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-secondary transition-all duration-500 ease-out" 
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <span className="font-mono-data text-xs text-on-surface-variant mt-2">{uploadProgress}%</span>
              </div>
            )}
          </div>
        </div>

        {/* Sync Status Banner */}
        {syncMutation.isSuccess && (
          <div className="mt-6 p-4 bg-secondary/10 border border-secondary/30 rounded-lg flex items-center gap-3">
            <span className="material-symbols-outlined text-secondary">check_circle</span>
            <p className="font-body-md text-body-md text-on-surface">Data sync completed successfully! Your dashboard has been updated.</p>
          </div>
        )}
      </div>
    </>
  );
}
