import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { Select } from '../components/ui/Select';

export default function Auth() {
  const navigate = useNavigate();
  const { login, signup, googleLogin, isAuthenticated } = useAuth();

  // UI State
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessField, setBusinessField] = useState('technology');

  // If already authenticated, redirect
  if (isAuthenticated) {
    return <Navigate to="/home" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      if (isLogin) {
        await login({ email, password });
        navigate('/home');
      } else {
        await signup({ email, password, name, business_field: businessField });
        navigate('/onboarding');
      }
    } catch (err: unknown) {
      const axiosErr = err as { isAxiosError?: boolean; message?: string; response?: { data?: { detail?: string } } };
      
      if (axiosErr.isAxiosError && !axiosErr.response) {
        setErrorMsg('Cannot connect to the server. Please ensure the backend is running.');
      } else {
        setErrorMsg(axiosErr.response?.data?.detail || 'Authentication failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      setErrorMsg('');
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

  return (
    <main className="flex w-full min-h-screen">
      <section className="w-full lg:w-1/2 flex flex-col justify-center px-margin-mobile lg:px-margin-desktop py-12 bg-surface-container-lowest border-r border-outline-variant relative z-10">
        <div className="max-w-md w-full mx-auto">
          <div className="mb-12">
            <h1 className="font-headline-md text-headline-md font-black text-on-surface flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined fill text-secondary text-3xl">psychology</span>
              AI CRM Brain
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              {isLogin ? 'Sign in to access your enterprise intelligence.' : 'Create a new account.'}
            </p>
          </div>

          {errorMsg && (
            <div className="mb-6 p-4 bg-error-container text-on-error-container rounded-lg font-body-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              {errorMsg}
            </div>
          )}

          <div className="space-y-6">
            <div className="flex gap-4">
              <button
                onClick={() => handleGoogleLogin()}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 border border-outline-variant rounded-lg hover:bg-surface-container-low transition-colors font-label-md text-label-md text-on-surface"
                type="button"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Google
              </button>
            </div>

            <div className="relative flex items-center py-4">
              <div className="flex-grow border-t border-outline-variant" />
              <span className="flex-shrink-0 mx-4 font-body-sm text-body-sm text-on-surface-variant">or continue with email</span>
              <div className="flex-grow border-t border-outline-variant" />
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              {!isLogin && (
                <>
                  <div>
                    <label className="block font-label-sm text-label-sm text-on-surface mb-1" htmlFor="auth-name">Full Name</label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-xl">badge</span>
                      <input
                        className="w-full pl-10 pr-4 py-3 bg-surface border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:outline-none transition-all"
                        id="auth-name"
                        type="text"
                        placeholder="Your full name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required={!isLogin}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-label-sm text-label-sm text-on-surface mb-1">Business Field</label>
                    <Select
                      value={businessField}
                      onChange={setBusinessField}
                      options={[
                        { value: 'technology', label: 'Technology / Software' },
                        { value: 'finance', label: 'Finance / Banking' },
                        { value: 'real_estate', label: 'Real Estate' },
                        { value: 'healthcare', label: 'Healthcare' },
                        { value: 'retail', label: 'Retail / E-commerce' },
                        { value: 'other', label: 'Other' },
                      ]}
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block font-label-sm text-label-sm text-on-surface mb-1" htmlFor="auth-email">Email Address</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-xl">account_circle</span>
                  <input
                    className="w-full pl-10 pr-4 py-3 bg-surface border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none transition-all"
                    id="auth-email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-label-sm text-label-sm text-on-surface mb-1" htmlFor="auth-password">Password</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-xl">lock</span>
                  <input
                    className="w-full pl-10 pr-4 py-3 bg-surface border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:outline-none transition-all"
                    id="auth-password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button
                className="w-full py-3 bg-primary-container text-on-primary-container font-label-md text-label-md rounded-lg hover:opacity-90 transition-opacity flex justify-center items-center gap-2 mt-8 disabled:opacity-50"
                type="submit"
                disabled={loading}
              >
                {loading ? 'Authenticating...' : isLogin ? 'Sign In' : 'Create Account'}
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </button>
            </form>

            <p className="font-body-sm text-body-sm text-on-surface-variant text-center mt-6">
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <button
                className="text-secondary font-medium hover:underline"
                onClick={() => { setIsLogin(!isLogin); setErrorMsg(''); }}
                type="button"
              >
                {isLogin ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>
      </section>

      <section className="hidden lg:flex w-1/2 bg-surface-container flex-col justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-secondary via-transparent to-transparent pointer-events-none" />
        <div className="max-w-lg w-full mx-auto px-margin-desktop relative z-10 text-center">
          <div className="w-32 h-32 mx-auto bg-secondary/10 rounded-full flex items-center justify-center mb-8">
            <span className="material-symbols-outlined text-secondary text-6xl">lightbulb</span>
          </div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface mb-4">Enterprise Intelligence Hub</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Predict deal closures with high accuracy and get generative AI recommendations directly connected to your CRM data.
          </p>
        </div>
      </section>
    </main>
  );
}
