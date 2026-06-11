import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi, ingestionApi } from '../services/api';
import { Select } from '../components/ui/Select';

type OnboardingStep = 'company' | 'connect' | 'syncing' | 'success';

const INDUSTRIES = ['Technology', 'Finance & Banking', 'Healthcare', 'Real Estate', 'Retail & E-Commerce', 'Manufacturing', 'Other'];

export default function Onboarding() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState<OnboardingStep>('company');
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [uploadMethod, setUploadMethod] = useState<'zoho' | 'csv' | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [syncStatusMsg, setSyncStatusMsg] = useState('Authenticating...');

  const handleCompanyContinue = (e: React.FormEvent) => {
    e.preventDefault();
    setStep('connect');
  };

  const handleConnect = async () => {
    if (uploadMethod === 'csv' && selectedFile) {
      setStep('syncing');
      setSyncStatusMsg('Uploading and processing CSV...');
      try {
        const formData = new FormData();
        formData.append('file', selectedFile);

        const result = await ingestionApi.uploadCustomData(formData, (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 100));
          setUploadProgress(percentCompleted);
        });

        const mlCount = result?.ml_predictions?.predictions_generated ?? 0;
        const llmCount = result?.llm_recommendations?.recommendations_generated ?? 0;
        setSyncStatusMsg(`Running ML Predictions... ${mlCount} scored, ${llmCount} AI insights generated.`);
        setTimeout(() => setStep('success'), 1500);
      } catch (err) {
        console.error('Upload failed', err);
        setSyncStatusMsg('Upload failed. Please try again.');
        setTimeout(() => setStep('connect'), 2000);
      }
    } else if (uploadMethod === 'zoho') {
      setSyncStatusMsg('Redirecting to Zoho OAuth...');
      try {
        // ✅ FIXED: Call OAuth initiation, not data sync
        const { auth_url } = await authApi.initiateZohoOAuth();
        // Redirect the browser to Zoho's OAuth consent screen
        window.location.href = auth_url;
      } catch (err: any) {
        const msg = err?.response?.data?.detail || 'Zoho OAuth setup failed. Check ZOHO_CLIENT_ID in .env.';
        setSyncStatusMsg(msg);
        setTimeout(() => setStep('connect'), 3000);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  return (
    <main className="flex w-full min-h-screen">
      <section className="w-full lg:w-1/2 flex flex-col justify-center px-margin-mobile lg:px-margin-desktop py-12 bg-surface-container-lowest border-r border-outline-variant relative z-10">
        <div className="max-w-md w-full mx-auto">
          <div className="mb-8">
            <h1 className="font-headline-md text-headline-md font-black text-on-surface flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined fill text-secondary text-3xl">psychology</span>
              AI CRM Brain
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">Set up your workspace.</p>

            {/* Step indicator */}
            <div className="flex items-center gap-2 mt-6">
              {['Company Info', 'Connect CRM', 'Done'].map((label, i) => {
                const stepIndex = i;
                const currentIndex = step === 'company' ? 0 : step === 'connect' ? 1 : 2;
                const isActive = stepIndex === currentIndex;
                const isComplete = stepIndex < currentIndex;
                return (
                  <div key={label} className="flex items-center gap-2">
                    {i > 0 && <div className={`w-8 h-px ${isComplete || isActive ? 'bg-secondary' : 'bg-outline-variant'}`} />}
                    <div className="flex items-center gap-1.5">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                        isComplete ? 'bg-secondary text-on-secondary' :
                        isActive ? 'bg-primary-container text-on-primary-container' :
                        'bg-surface-container-high text-on-surface-variant'
                      }`}>
                        {isComplete ? <span className="material-symbols-outlined text-sm">check</span> : stepIndex + 1}
                      </div>
                      <span className={`font-label-sm text-label-sm hidden sm:inline ${isActive ? 'text-on-surface' : 'text-on-surface-variant'}`}>{label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 1: Company Info */}
          {step === 'company' && (
            <form onSubmit={handleCompanyContinue} className="bg-surface-container-lowest p-8 rounded-xl shadow-[0_10px_15px_rgba(15,23,42,0.05)] border border-outline-variant transition-all duration-300">
              <h3 className="font-headline-md text-headline-md text-on-surface mb-2">Tell us about your company</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant mb-6">This helps us personalize your AI intelligence experience.</p>

              <div className="space-y-4">
                <div>
                  <label className="block font-label-sm text-label-sm text-on-surface mb-1" htmlFor="onb-company">Company Name</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-xl">apartment</span>
                    <input
                      className="w-full pl-10 pr-4 py-3 bg-surface border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:outline-none transition-all"
                      id="onb-company"
                      type="text"
                      placeholder="Acme Corporation"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="relative z-10">
                  <label className="block font-label-sm text-label-sm text-on-surface mb-1" htmlFor="onb-industry">Industry</label>
                  <Select
                    value={industry}
                    onChange={setIndustry}
                    options={INDUSTRIES.map(i => ({ value: i, label: i }))}
                    placeholder="Select your industry"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-primary-container text-on-primary-container font-label-md text-label-md rounded-lg hover:opacity-90 transition-opacity mt-8 flex items-center justify-center gap-2"
              >
                Continue
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </button>
            </form>
          )}

          {/* Step 2: Connect CRM */}
          {step === 'connect' && (
            <div className="bg-surface-container-lowest p-8 rounded-xl shadow-[0_10px_15px_rgba(15,23,42,0.05)] border border-outline-variant transition-all duration-300">
              <h3 className="font-headline-md text-headline-md text-on-surface mb-2">Data Source</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant mb-6">
                Connect a CRM or upload a custom CSV to power the AI Brain.
              </p>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div 
                  onClick={() => setUploadMethod('zoho')}
                  className={`flex flex-col items-center justify-center p-6 border-2 rounded-xl cursor-pointer transition-all ${
                    uploadMethod === 'zoho' 
                      ? 'border-secondary bg-secondary/5' 
                      : 'border-outline-variant bg-surface hover:border-secondary/50'
                  }`}
                >
                  <span className={`material-symbols-outlined text-4xl mb-2 ${uploadMethod === 'zoho' ? 'text-secondary' : 'text-on-surface-variant'}`}>
                    cloud_sync
                  </span>
                  <span className={`font-label-md ${uploadMethod === 'zoho' ? 'text-secondary font-bold' : 'text-on-surface'}`}>Zoho CRM</span>
                  {uploadMethod === 'zoho' && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-secondary text-on-secondary flex items-center justify-center">
                      <span className="material-symbols-outlined text-xs font-bold">check</span>
                    </div>
                  )}
                </div>

                <div 
                  onClick={() => setUploadMethod('csv')}
                  className={`flex flex-col items-center justify-center p-6 border-2 rounded-xl cursor-pointer transition-all ${
                    uploadMethod === 'csv' 
                      ? 'border-primary bg-primary/5' 
                      : 'border-outline-variant bg-surface hover:border-primary/50'
                  }`}
                >
                  <span className={`material-symbols-outlined text-4xl mb-2 ${uploadMethod === 'csv' ? 'text-primary' : 'text-on-surface-variant'}`}>
                    upload_file
                  </span>
                  <span className={`font-label-md ${uploadMethod === 'csv' ? 'text-primary font-bold' : 'text-on-surface'}`}>Custom CSV</span>
                  {uploadMethod === 'csv' && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary text-on-primary flex items-center justify-center">
                      <span className="material-symbols-outlined text-xs font-bold">check</span>
                    </div>
                  )}
                </div>
              </div>

              {uploadMethod === 'csv' && (
                <div className="mb-6 space-y-4">
                  {/* ── Column Schema Guide ── */}
                  <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="material-symbols-outlined text-primary text-lg">table_chart</span>
                      <p className="font-label-md text-on-surface font-semibold">Required CSV Columns</p>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono mb-3">
                      {[
                        { col: 'Deal_Name', req: true },
                        { col: 'Stage', req: true },
                        { col: 'Amount', req: true },
                        { col: 'Closing_Date', req: true },
                        { col: 'Account_Name', req: false },
                        { col: 'Contact_Name', req: false },
                        { col: 'Owner_Name', req: false },
                        { col: 'Phone', req: false },
                        { col: 'Email', req: false },
                        { col: 'Probability', req: false },
                      ].map(({ col, req }) => (
                        <div key={col} className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${req ? 'bg-error' : 'bg-secondary'}`} />
                          <span className={`${req ? 'text-on-surface font-semibold' : 'text-on-surface-variant'}`}>{col}</span>
                          {req && <span className="text-error text-[9px] font-bold">REQ</span>}
                        </div>
                      ))}
                    </div>
                    <a
                      href="/sample_test_deals.csv"
                      download="sample_test_deals.csv"
                      className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                    >
                      <span className="material-symbols-outlined text-sm">download</span>
                      Download sample_test_deals.csv
                    </a>
                  </div>

                  {/* ── File Drop Zone ── */}
                  <div className="p-4 border border-outline-variant rounded-lg bg-surface text-center border-dashed">
                    <input
                      type="file"
                      accept=".csv,.xlsx"
                      className="hidden"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                    />
                    {selectedFile ? (
                      <div className="flex items-center justify-between bg-surface-container p-3 rounded-md">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="material-symbols-outlined text-primary">csv</span>
                          <span className="font-body-sm text-on-surface truncate">{selectedFile.name}</span>
                        </div>
                        <button
                          onClick={() => setSelectedFile(null)}
                          className="text-on-surface-variant hover:text-error transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="text-primary font-label-md hover:underline flex items-center justify-center gap-2 mx-auto"
                      >
                        <span className="material-symbols-outlined">upload</span>
                        Select CSV or Excel File
                      </button>
                    )}
                  </div>
                </div>
              )}

              <button 
                onClick={handleConnect} 
                disabled={!uploadMethod || (uploadMethod === 'csv' && !selectedFile)}
                className="w-full py-3.5 bg-primary text-on-primary font-label-md text-label-md rounded-lg flex items-center justify-center gap-3 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploadMethod === 'csv' ? 'Upload & Process Data' : 'Connect and Sync'}
              </button>
              <button onClick={() => setStep('company')} className="w-full mt-3 py-2 font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface transition-colors" type="button">
                ← Back
              </button>
            </div>
          )}

          {/* Step 3: Syncing */}
          {step === 'syncing' && (
            <div className="bg-surface-container-lowest p-8 rounded-xl shadow-[0_10px_15px_rgba(15,23,42,0.05)] border border-outline-variant transition-all duration-300">
              <h3 className="font-headline-md text-headline-md text-on-surface mb-8">Processing Data</h3>
              <div className="space-y-8 relative">
                <div className="absolute left-[15px] top-2 bottom-2 w-px bg-outline-variant" />
                <div className="flex items-center gap-4 relative">
                  <div className="w-8 h-8 rounded-full bg-secondary text-on-secondary flex items-center justify-center z-10">
                    <span className="material-symbols-outlined text-lg">check</span>
                  </div>
                  <div><p className="font-label-md text-label-md text-on-surface">{uploadMethod === 'csv' ? 'File verified' : 'Authenticated'}</p></div>
                </div>
                <div className="flex items-center gap-4 relative">
                  <div className="w-8 h-8 rounded-full bg-surface-container border-2 border-secondary border-t-transparent animate-spin z-10" />
                  <div>
                    <p className="font-label-md text-label-md text-on-surface">{syncStatusMsg}</p>
                    {uploadMethod === 'csv' && uploadProgress > 0 && uploadProgress < 100 && (
                      <div className="w-full bg-outline-variant rounded-full h-1.5 mt-2 overflow-hidden">
                        <div className="bg-primary h-1.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Success */}
          {step === 'success' && (
            <div className="bg-surface-container-lowest p-8 rounded-xl shadow-[0_10px_15px_rgba(15,23,42,0.05)] border border-outline-variant transition-all duration-300 text-center">
              <div className="mb-6 flex justify-center">
                <div className="w-20 h-20 bg-secondary/10 rounded-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-secondary text-5xl">check_circle</span>
                </div>
              </div>
              <h3 className="font-headline-md text-headline-md text-on-surface mb-2">Sync Complete</h3>
              <div className="bg-surface p-4 rounded-lg mb-8">
                <p className="font-display-lg text-headline-lg text-secondary">Active</p>
                <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">CRM Connection established</p>
              </div>
              <button onClick={() => navigate('/home')} className="w-full py-3.5 bg-primary text-on-primary font-label-md text-label-md rounded-lg hover:opacity-90 transition-opacity">
                Go to Dashboard
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="hidden lg:flex w-1/2 bg-surface-container flex-col justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-secondary via-transparent to-transparent pointer-events-none" />
        <div className="max-w-lg w-full mx-auto px-margin-desktop relative z-10">
          <div className="mb-12">
            <h2 className="font-headline-lg text-headline-lg text-on-surface mb-2">
              {step === 'company' ? 'Company Setup' : 'CRM Integration'}
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              {step === 'company'
                ? 'Personalize your workspace with your company details.'
                : 'Power your AI intelligence by connecting your data source.'}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
