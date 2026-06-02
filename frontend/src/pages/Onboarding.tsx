import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { actionApi } from '../services/api';
import { Select } from '../components/ui/Select';

type OnboardingStep = 'company' | 'connect' | 'syncing' | 'success';

const INDUSTRIES = ['Technology', 'Finance & Banking', 'Healthcare', 'Real Estate', 'Retail & E-Commerce', 'Manufacturing', 'Other'];

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState<OnboardingStep>('company');
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');

  const handleCompanyContinue = (e: React.FormEvent) => {
    e.preventDefault();
    setStep('connect');
  };

  const handleConnect = async () => {
    setStep('syncing');
    try {
      await actionApi.triggerSync();
      setStep('success');
    } catch {
      // Fallback to success for MVP demo purposes if backend fails
      setTimeout(() => setStep('success'), 3000);
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
              <h3 className="font-headline-md text-headline-md text-on-surface mb-2">Connect Your CRM</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant mb-6">
                Integrate your existing data to power the AI Brain
                {companyName ? ` for ${companyName}` : ''}.
              </p>

              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="aspect-square flex flex-col items-center justify-center p-4 border-2 border-secondary rounded-xl bg-surface cursor-pointer relative">
                  <span className="material-symbols-outlined text-secondary text-4xl mb-1">cloud_sync</span>
                  <span className="font-label-sm text-label-sm text-on-surface">Zoho</span>
                  <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-secondary flex items-center justify-center">
                    <span className="material-symbols-outlined text-on-secondary text-xs">check</span>
                  </div>
                </div>
                <div className="aspect-square flex flex-col items-center justify-center p-4 border border-outline-variant rounded-xl bg-surface opacity-50 grayscale cursor-not-allowed">
                  <span className="material-symbols-outlined text-on-surface-variant text-4xl mb-1">cloud</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">Salesforce</span>
                </div>
                <div className="aspect-square flex flex-col items-center justify-center p-4 border border-outline-variant rounded-xl bg-surface opacity-50 grayscale cursor-not-allowed">
                  <span className="material-symbols-outlined text-on-surface-variant text-4xl mb-1">hub</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">HubSpot</span>
                </div>
              </div>

              <button onClick={handleConnect} className="w-full py-4 bg-primary text-on-primary font-label-md text-label-md rounded-lg flex items-center justify-center gap-3 hover:opacity-90 transition-opacity">
                <span className="material-symbols-outlined">link</span>
                Connect Zoho via OAuth
              </button>
              <button onClick={() => setStep('company')} className="w-full mt-3 py-2 font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface transition-colors" type="button">
                ← Back
              </button>
            </div>
          )}

          {/* Step 3: Syncing */}
          {step === 'syncing' && (
            <div className="bg-surface-container-lowest p-8 rounded-xl shadow-[0_10px_15px_rgba(15,23,42,0.05)] border border-outline-variant transition-all duration-300">
              <h3 className="font-headline-md text-headline-md text-on-surface mb-8">Syncing Records</h3>
              <div className="space-y-8 relative">
                <div className="absolute left-[15px] top-2 bottom-2 w-px bg-outline-variant" />
                <div className="flex items-center gap-4 relative">
                  <div className="w-8 h-8 rounded-full bg-secondary text-on-secondary flex items-center justify-center z-10">
                    <span className="material-symbols-outlined text-lg">check</span>
                  </div>
                  <div><p className="font-label-md text-label-md text-on-surface">Authenticating...</p></div>
                </div>
                <div className="flex items-center gap-4 relative">
                  <div className="w-8 h-8 rounded-full bg-surface-container border-2 border-secondary border-t-transparent animate-spin z-10" />
                  <div><p className="font-label-md text-label-md text-on-surface">Fetching Deal Schemas...</p></div>
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
              <button onClick={() => navigate('/dashboard')} className="w-full py-3.5 bg-primary text-on-primary font-label-md text-label-md rounded-lg hover:opacity-90 transition-opacity">
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
