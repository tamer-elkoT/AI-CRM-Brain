import { useState, useEffect } from 'react';
import { useNavigate, Navigate, useSearchParams } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { Select } from '../components/ui/Select';
import { authApi, ingestionApi, actionApi } from '../services/api';

import { useRef } from 'react';

type AuthView = 'login' | 'gateway' | 'admin-signup' | 'team-signup' | 'admin-wizard-zoho' | 'admin-wizard-invite';

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, signupAdmin, signupTeam, googleLogin, isAuthenticated } = useAuth();

  const [view, setView] = useState<AuthView>('login');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  
  // Admin Form State
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('technology');

  // Team Form State
  const [inviteToken, setInviteToken] = useState('');
  
  // Invite Wizard State
  const [inviteRole, setInviteRole] = useState<'manager'|'rep'>('rep');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSuccessMsg, setInviteSuccessMsg] = useState('');

  // File Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      setInviteToken(token);
      setView('team-signup');
    }
    const zoho = searchParams.get('zoho');
    if (zoho === 'connected') {
      // Auto-trigger the Zoho ingestion pipeline in the background so their data is ready
      actionApi.triggerSync().catch(err => console.error('Auto-sync failed:', err));
      setView('admin-wizard-invite');
    }
  }, [searchParams]);

  // Prevent routing to /home if we are in the middle of the admin wizard
  if (isAuthenticated && !['admin-wizard-zoho', 'admin-wizard-invite'].includes(view)) {
    return <Navigate to="/home" replace />;
  }

  const handleError = (err: any) => {
    if (err.isAxiosError && !err.response) {
      setErrorMsg('Cannot connect to the server. Please ensure the backend is running.');
    } else {
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        setErrorMsg(detail);
      } else if (Array.isArray(detail) && detail.length > 0) {
        setErrorMsg(detail[0].msg || 'Validation error occurred.');
      } else {
        setErrorMsg('Authentication failed. Please try again.');
      }
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setErrorMsg('');
    try {
      await login({ email, password });
      navigate('/home');
    } catch (err: any) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdminSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setErrorMsg('');
    try {
      await signupAdmin({ email, password, company_name: companyName, industry, name, phone_number: phoneNumber });
      setView('admin-wizard-zoho');
    } catch (err: any) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleTeamSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setErrorMsg('');
    try {
      await signupTeam({ invite_token: inviteToken, email, password, name, phone_number: phoneNumber });
      navigate('/home');
    } catch (err: any) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setErrorMsg(''); setInviteSuccessMsg('');
    try {
      await authApi.invite({ role: inviteRole, email: inviteEmail });
      setInviteSuccessMsg(`Invite sent successfully to ${inviteEmail}!`);
      setInviteEmail('');
    } catch (err: any) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectZoho = async () => {
    setLoading(true); setErrorMsg('');
    try {
      const { auth_url } = await authApi.initiateZohoOAuth();
      window.location.href = auth_url;
    } catch (err: any) {
      handleError(err);
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg('');
    setErrorMsg('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await ingestionApi.uploadCustomData(fd);
      setUploadMsg(`✅ ${res.message} (${res.deals_inserted} deals inserted)`);
      setTimeout(() => setView('admin-wizard-invite'), 2000);
    } catch (err: any) {
      handleError(err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleGoogleLoginAction = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true); setErrorMsg('');
      try {
        await googleLogin(tokenResponse.access_token);
        navigate('/home');
      } catch {
        setErrorMsg('Google login failed.');
      } finally {
        setLoading(false);
      }
    },
    onError: () => setErrorMsg('Google login failed.'),
  });

  const renderError = () => errorMsg && (
    <div className="mb-6 p-4 bg-error-container text-on-error-container rounded-lg font-body-sm flex items-center gap-2">
      <span className="material-symbols-outlined text-[18px]">error</span>
      {errorMsg}
    </div>
  );

  return (
    <main className="flex w-full min-h-screen">
      {/* LEFT SECTION - DYNAMIC FORMS */}
      <section className="w-full lg:w-1/2 flex flex-col justify-center px-6 lg:px-20 py-12 bg-surface-container-lowest border-r border-outline-variant relative z-10 overflow-y-auto">
        <div className="max-w-md w-full mx-auto pb-10">
          
          {/* ── Brand Header ── */}
          <div className="mb-10 cursor-pointer" onClick={() => setView('login')}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-14 h-14 rounded-2xl overflow-hidden bg-white border border-outline-variant/30 shadow-sm flex items-center justify-center flex-shrink-0">
                <img
                  src="/Rabih_Logo.jpeg"
                  alt="Rabih CRM"
                  className="w-full h-full object-contain p-1"
                />
              </div>
              <div>
                <h1 className="font-headline-md text-[20px] font-black text-on-surface leading-tight">
                  Rabih CRM
                </h1>
                <p className="font-label-sm text-label-sm text-on-surface-variant">Enterprise Intelligence</p>
              </div>
            </div>
          </div>

          {renderError()}

          {/* ── VIEW: LOGIN (Stitch refined design) ── */}
          {view === 'login' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="font-headline-md text-headline-md font-black text-on-surface mb-1">
                Welcome to Rabih CRM <span className="text-on-surface-variant font-normal">(رابح)</span>
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant mb-8">
                Sign in to access your enterprise intelligence.
              </p>

              {/* ── SSO Buttons row (Google + Microsoft) ── */}
              <div className="flex gap-3 mb-6">
                <button
                  id="btn-google-login"
                  onClick={() => handleGoogleLoginAction()}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 border border-outline-variant rounded-xl hover:bg-surface-container-low transition-colors font-label-md text-label-md text-on-surface"
                  type="button"
                >
                  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Google
                </button>
                <button
                  id="btn-microsoft-login"
                  onClick={() => setErrorMsg('Microsoft SSO coming soon.')}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 border border-outline-variant rounded-xl hover:bg-surface-container-low transition-colors font-label-md text-label-md text-on-surface"
                  type="button"
                >
                  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                    <rect x="1" y="1" width="10" height="10" fill="#F25022" />
                    <rect x="13" y="1" width="10" height="10" fill="#00A4EF" />
                    <rect x="1" y="13" width="10" height="10" fill="#7FBA00" />
                    <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
                  </svg>
                  Microsoft
                </button>
              </div>

              {/* Divider */}
              <div className="relative flex items-center py-3 mb-4">
                <div className="flex-grow border-t border-outline-variant" />
                <span className="flex-shrink-0 mx-4 font-body-sm text-body-sm text-on-surface-variant">or continue with</span>
                <div className="flex-grow border-t border-outline-variant" />
              </div>

              {/* ── Email / Password form ── */}
              <form className="space-y-4" onSubmit={handleLoginSubmit}>
                <div>
                  <label className="block font-label-sm text-label-sm text-on-surface mb-1.5" htmlFor="auth-email">
                    Email
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-xl">
                      account_circle
                    </span>
                    <input
                      id="auth-email"
                      className="w-full pl-10 pr-4 py-3 bg-surface border border-outline-variant rounded-xl font-body-md text-body-md text-on-surface focus:outline-none transition-all"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-label-sm text-label-sm text-on-surface mb-1.5" htmlFor="auth-password">
                    Password
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-xl">
                      lock
                    </span>
                    <input
                      id="auth-password"
                      className="w-full pl-10 pr-4 py-3 bg-surface border border-outline-variant rounded-xl font-body-md text-body-md text-on-surface focus:outline-none transition-all"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                    />
                  </div>
                </div>
                <button
                  id="btn-sign-in"
                  className="w-full py-3.5 bg-primary-container text-on-primary-container font-label-md text-label-md rounded-xl hover:opacity-90 transition-all mt-6 flex items-center justify-center gap-2 shadow-md shadow-primary/10"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? 'Authenticating...' : 'Sign In'}
                  {!loading && <span className="material-symbols-outlined text-[18px]">arrow_forward</span>}
                </button>
              </form>
              <p className="text-center mt-6 text-on-surface-variant font-body-sm">
                Don't have an account?{' '}
                <button
                  id="btn-go-signup"
                  className="text-secondary font-semibold hover:underline"
                  onClick={() => setView('gateway')}
                >
                  Sign up
                </button>
              </p>
            </div>
          )}

          {/* VIEW: GATEWAY */}
          {view === 'gateway' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <h2 className="font-headline-md text-headline-md font-black text-on-surface mb-2">Get Started</h2>
              <p className="font-body-md text-on-surface-variant mb-8">Choose how you want to join Rabih CRM.</p>
              
              <div className="space-y-4">
                <button
                  onClick={() => setView('admin-signup')}
                  className="w-full text-left p-6 rounded-xl border-2 border-outline-variant hover:border-secondary hover:bg-secondary/5 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary-container text-on-primary-container rounded-lg flex items-center justify-center">
                      <span className="material-symbols-outlined">domain</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-on-surface group-hover:text-secondary transition-colors">Create a new Workspace</h3>
                      <p className="text-sm text-on-surface-variant mt-1">For business owners & admins.</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setView('team-signup')}
                  className="w-full text-left p-6 rounded-xl border-2 border-outline-variant hover:border-secondary hover:bg-secondary/5 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-tertiary-container text-on-tertiary-container rounded-lg flex items-center justify-center">
                      <span className="material-symbols-outlined">group_add</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-on-surface group-hover:text-secondary transition-colors">Join existing Workspace</h3>
                      <p className="text-sm text-on-surface-variant mt-1">I have an invite token.</p>
                    </div>
                  </div>
                </button>
              </div>

              <button className="mt-8 text-on-surface-variant text-sm hover:underline" onClick={() => setView('login')}>
                &larr; Back to Login
              </button>
            </div>
          )}

          {/* VIEW: ADMIN SIGNUP */}
          {view === 'admin-signup' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <h2 className="text-2xl font-bold text-on-surface mb-2">Create Workspace</h2>
              <p className="font-body-sm text-on-surface-variant mb-6">Set up your company's intelligence hub.</p>

              <form className="space-y-4" onSubmit={handleAdminSignup}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-on-surface mb-1">Company Name</label>
                    <input className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg" required value={companyName} onChange={e => setCompanyName(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-on-surface mb-1">Industry</label>
                    <Select value={industry} onChange={setIndustry} options={[
                      { value: 'technology', label: 'Technology' },
                      { value: 'finance', label: 'Finance' },
                      { value: 'real_estate', label: 'Real Estate' },
                      { value: 'other', label: 'Other' },
                    ]} />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1">Your Full Name</label>
                  <input className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg" required value={name} onChange={e => setName(e.target.value)} />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1">Email</label>
                  <input type="email" className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg" required value={email} onChange={e => setEmail(e.target.value)} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-on-surface mb-1">Password</label>
                    <input type="password" className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg" required value={password} onChange={e => setPassword(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-on-surface mb-1">Phone</label>
                    <input type="tel" className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} />
                  </div>
                </div>

                <button type="submit" disabled={loading} className="w-full py-3 mt-4 bg-primary text-on-primary font-bold rounded-lg hover:opacity-90">
                  {loading ? 'Creating...' : 'Create Workspace'}
                </button>
              </form>
              <button className="mt-6 text-on-surface-variant text-sm hover:underline" onClick={() => setView('gateway')}>
                &larr; Back
              </button>
            </div>
          )}

          {/* VIEW: TEAM SIGNUP */}
          {view === 'team-signup' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <h2 className="text-2xl font-bold text-on-surface mb-2">Join Workspace</h2>
              <p className="font-body-sm text-on-surface-variant mb-6">Enter your invite token to join your team.</p>

              <form className="space-y-4" onSubmit={handleTeamSignup}>
                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1">Invite Token (from Email)</label>
                  <input className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg font-mono text-xs" required value={inviteToken} onChange={e => setInviteToken(e.target.value)} />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1">Your Full Name</label>
                  <input className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg" required value={name} onChange={e => setName(e.target.value)} />
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1">Email</label>
                  <input type="email" className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg" required value={email} onChange={e => setEmail(e.target.value)} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-on-surface mb-1">Password</label>
                    <input type="password" className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg" required value={password} onChange={e => setPassword(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-on-surface mb-1">Phone</label>
                    <input type="tel" className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} />
                  </div>
                </div>

                <button type="submit" disabled={loading} className="w-full py-3 mt-4 bg-tertiary text-on-tertiary font-bold rounded-lg hover:opacity-90">
                  {loading ? 'Joining...' : 'Join Workspace'}
                </button>
              </form>
              <button className="mt-6 text-on-surface-variant text-sm hover:underline" onClick={() => setView('gateway')}>
                &larr; Back
              </button>
            </div>
          )}

          {/* VIEW: ADMIN WIZARD 1 (ZOHO) */}
          {view === 'admin-wizard-zoho' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 text-center py-8">
              <div className="w-20 h-20 mx-auto bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-4xl">check_circle</span>
              </div>
              <h2 className="text-2xl font-bold text-on-surface mb-2">Workspace Created!</h2>
              <p className="font-body-md text-on-surface-variant mb-8">Next, let's connect your CRM data source.</p>
              
              <div className="p-6 border border-outline-variant rounded-xl bg-surface mb-6">
                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Zoho_logo.svg/512px-Zoho_logo.svg.png" alt="Zoho" className="h-8 mx-auto mb-4" />
                <button 
                  type="button"
                  disabled={loading}
                  className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                  onClick={handleConnectZoho}
                >
                  {loading ? 'Connecting...' : 'Connect Zoho CRM'}
                </button>
                <p className="text-xs text-on-surface-variant mt-3">You will be redirected to Zoho to authorize access.</p>
              </div>

              <div className="relative flex items-center mb-6">
                <div className="flex-grow border-t border-outline-variant" />
                <span className="mx-3 text-xs text-on-surface-variant">or</span>
                <div className="flex-grow border-t border-outline-variant" />
              </div>

              <div className="mb-6">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={handleFileUpload}
                  id="wizard-file-upload"
                />
                <label
                  htmlFor="wizard-file-upload"
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-outline-variant hover:border-secondary hover:bg-secondary/5 transition cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <span className="material-symbols-outlined text-on-surface-variant">upload_file</span>
                  <span className="font-label-md text-on-surface-variant">
                    {uploading ? 'Processing...' : 'Upload CSV or Excel file'}
                  </span>
                </label>
                {uploadMsg && <p className="text-sm text-emerald-600 mt-2">{uploadMsg}</p>}
              </div>

              <button className="text-on-surface-variant text-sm hover:underline" onClick={() => setView('admin-wizard-invite')}>
                Skip for now
              </button>
            </div>
          )}

          {/* VIEW: ADMIN WIZARD 2 (INVITE TEAM) */}
          {view === 'admin-wizard-invite' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <h2 className="text-2xl font-bold text-on-surface mb-2">Invite your Team</h2>
              <p className="font-body-md text-on-surface-variant mb-6">Send an email invite to your sales managers and reps.</p>

              {inviteSuccessMsg && (
                <div className="mb-6 p-4 bg-green-100 text-green-800 rounded-lg font-body-sm flex items-center gap-2">
                  <span className="material-symbols-outlined">check_circle</span>
                  {inviteSuccessMsg}
                </div>
              )}

              <form className="p-6 border border-outline-variant rounded-xl bg-surface mb-6" onSubmit={handleSendInvite}>
                <div className="mb-4">
                  <label className="block text-xs font-bold text-on-surface mb-1">Email Address</label>
                  <input type="email" required className="w-full px-3 py-2 bg-surface border border-outline-variant rounded-lg" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="colleague@company.com" />
                </div>
                <div className="mb-4">
                  <label className="block text-xs font-bold text-on-surface mb-1">Role</label>
                  <Select value={inviteRole} onChange={(v) => setInviteRole(v as 'manager'|'rep')} options={[
                    { value: 'rep', label: 'Sales Rep (Personal View)' },
                    { value: 'manager', label: 'Sales Manager (Global View)' }
                  ]} />
                </div>
                
                <button type="submit" disabled={loading} className="w-full py-2 bg-secondary text-on-secondary font-bold rounded-lg hover:opacity-90 flex justify-center items-center gap-2">
                  <span className="material-symbols-outlined text-sm">mail</span>
                  {loading ? 'Sending...' : 'Send Email Invite'}
                </button>
              </form>

              <button className="w-full py-3 bg-surface-container-high text-on-surface font-bold rounded-lg hover:bg-surface-container-highest transition" onClick={() => navigate('/home')}>
                Go to Dashboard &rarr;
              </button>
            </div>
          )}

        </div>
      </section>

      {/* ── RIGHT SECTION — Stitch refined splash panel ── */}
      <section className="hidden lg:flex w-1/2 bg-primary-container flex-col justify-center relative overflow-hidden">
        {/* Radial teal glow */}
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_50%,_#0D9488,_transparent_70%)] pointer-events-none" />
        {/* Dot-grid texture */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(#0D9488 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        <div className="max-w-lg w-full mx-auto px-12 relative z-10">
          {/* Icon ring */}
          <div className="w-24 h-24 mx-auto bg-primary/20 rounded-full flex items-center justify-center mb-8 shadow-inner border border-primary/30">
            <span
              className="material-symbols-outlined text-primary-fixed-dim text-5xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              psychology
            </span>
          </div>
          {/* Headline */}
          <h2 className="font-headline-lg text-headline-lg text-on-primary-container mb-4 font-black tracking-tight text-center">
            Enterprise Intelligence Hub
          </h2>
          <p className="font-body-lg text-body-lg text-primary-fixed-dim/80 leading-relaxed text-center">
            Predict deal closures with high accuracy and get generative AI recommendations directly connected to your CRM data.
          </p>
          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-2 mt-8">
            {['ML Scoring', 'Arabic AI Insights', 'Zoho Integration', 'Multi-tenant'].map((f) => (
              <span
                key={f}
                className="px-3 py-1.5 bg-primary/20 text-primary-fixed-dim font-label-sm text-label-sm rounded-full border border-primary/30"
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
