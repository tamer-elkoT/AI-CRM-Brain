import { useState, useRef, useEffect, useCallback } from 'react';

interface OTPModalProps {
  phoneNumber: string;
  onVerify: (otp: string) => Promise<void>;
  onClose: () => void;
}

const OTP_LENGTH = 6;

export default function OTPModal({ phoneNumber, onVerify, onClose }: OTPModalProps) {
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [countdown, setCountdown] = useState(600); // 10 minutes in seconds
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Auto-focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleChange = (index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);
    setErrorMsg('');

    // Auto-advance to next input
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit if all digits filled
    if (digit && index === OTP_LENGTH - 1) {
      const code = newDigits.join('');
      if (code.length === OTP_LENGTH) {
        handleSubmit(code);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    const newDigits = [...digits];
    for (let i = 0; i < pasted.length; i++) {
      newDigits[i] = pasted[i];
    }
    setDigits(newDigits);
    if (pasted.length === OTP_LENGTH) {
      handleSubmit(pasted);
    } else {
      inputRefs.current[pasted.length]?.focus();
    }
  };

  const handleSubmit = useCallback(async (code?: string) => {
    const otp = code || digits.join('');
    if (otp.length !== OTP_LENGTH) {
      setErrorMsg('Please enter all 6 digits.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      await onVerify(otp);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setErrorMsg(axiosErr.response?.data?.detail || 'Verification failed. Please try again.');
      // Clear digits on failure
      setDigits(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }, [digits, onVerify]);

  const maskedPhone = phoneNumber
    ? phoneNumber.slice(0, -4).replace(/./g, '•') + phoneNumber.slice(-4)
    : '';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className="bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-2xl w-full max-w-md p-8 relative animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-on-surface-variant hover:bg-surface-variant rounded-full transition-colors"
          aria-label="Close"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto bg-[#25D366]/10 rounded-full flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[#25D366] text-3xl">verified</span>
          </div>
          <h2 className="font-headline-md text-headline-md text-on-surface mb-2">
            Verify Your WhatsApp
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            We sent a 6-digit code to
          </p>
          <p className="font-label-md text-label-md text-[#25D366] mt-1 flex items-center justify-center gap-1">
            <span className="material-symbols-outlined text-[16px]">smartphone</span>
            {maskedPhone}
          </p>
        </div>

        {/* Error */}
        {errorMsg && (
          <div className="mb-6 p-3 bg-error-container text-on-error-container rounded-lg font-body-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">error</span>
            {errorMsg}
          </div>
        )}

        {/* OTP Input Boxes */}
        <div className="flex justify-center gap-3 mb-6" onPaste={handlePaste}>
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className={`w-12 h-14 text-center font-headline-md text-headline-md rounded-xl border-2 transition-all duration-200 bg-surface text-on-surface focus:outline-none ${
                digit
                  ? 'border-[#25D366] shadow-sm shadow-[#25D366]/20'
                  : 'border-outline-variant focus:border-secondary'
              }`}
              disabled={loading}
              aria-label={`Digit ${i + 1}`}
            />
          ))}
        </div>

        {/* Timer */}
        <div className="text-center mb-6">
          {countdown > 0 ? (
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Code expires in{' '}
              <span className="font-mono-data text-mono-data text-secondary font-bold">
                {formatTime(countdown)}
              </span>
            </p>
          ) : (
            <p className="font-body-sm text-body-sm text-error">
              Code expired. Please request a new one.
            </p>
          )}
        </div>

        {/* Verify Button */}
        <button
          onClick={() => handleSubmit()}
          disabled={loading || digits.join('').length !== OTP_LENGTH || countdown <= 0}
          className="w-full py-3 bg-[#25D366] text-white font-label-md text-label-md rounded-xl hover:bg-[#1da851] transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
              Verifying...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-lg">check_circle</span>
              Verify & Continue
            </>
          )}
        </button>

        {/* Footer */}
        <p className="font-body-sm text-body-sm text-on-surface-variant text-center mt-6">
          Didn't receive the code?{' '}
          <button
            className="text-secondary font-medium hover:underline"
            disabled={countdown > 0}
            onClick={() => {
              // In a real app, this would call a resend OTP endpoint
              setCountdown(600);
            }}
          >
            Resend
          </button>
        </p>
      </div>
    </div>
  );
}
