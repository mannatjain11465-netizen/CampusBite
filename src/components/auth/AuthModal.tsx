import React, { useState } from 'react';
import { Eye, EyeOff, Loader2, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'register';
  onClose: () => void;
  onSuccess?: () => void;
}

const DEMO_ACCOUNTS = [
  { label: 'Student · Aarav', email: 'aarav@student.edu', role: 'IIT2024042' },
  { label: 'Vendor · Demo Bay 01', email: 'grill@campusbite.edu', role: 'Burgers & Rolls' },
  { label: 'Vendor · Demo Bay 02', email: 'dosa@campusbite.edu', role: 'Dakshin & Momos' },
  { label: 'IIITA Admin Console', email: 'admin@campusbite.edu', role: 'Campus Admin' },
];

export function AuthModal({
  isOpen,
  initialMode = 'login',
  onClose,
  onSuccess,
}: AuthModalProps) {
  const { login, register } = useAuth();
  const { showToast } = useToast();

  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [campusId, setCampusId] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (mode === 'login') {
        const loggedUser = await login(email, password);
        showToast(`Welcome back, ${loggedUser.name}`, 'success');
      } else {
        const registered = await register({ name, email, password, campusId, phone });
        showToast(`Welcome to CampusBite, ${registered.name}`, 'success');
      }
      onClose();
      onSuccess?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Authentication failed.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoFill = async (demoEmail: string) => {
    setMode('login');
    setEmail(demoEmail);
    setPassword('Campus@123');
    setError('');
    setSubmitting(true);
    try {
      const loggedUser = await login(demoEmail, 'Campus@123');
      showToast(`Signed in as ${loggedUser.name} (${loggedUser.role})`, 'success');
      onClose();
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo login failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B132B]/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl bg-[#FFFDF9] border border-[#E6DEC8] shadow-2xl overflow-hidden my-auto"
      >
        <div className="bg-gradient-to-r from-[#0B132B] to-[#17254D] px-6 py-5 text-white flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-wider text-[#FBBF24]">
              IIIT ALLAHABAD · PRAYAGRAJ
            </p>
            <h2 className="text-xl font-bold mt-0.5">
              {mode === 'login' ? 'Sign in to CampusBite' : 'Student Registration'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Segmented Mode Switch */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-[#F2EAE0] rounded-lg mb-5">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className={`py-2 text-sm font-semibold rounded-md transition-colors cursor-pointer ${
                mode === 'login'
                  ? 'bg-[#FFFDF9] text-[#0B132B] shadow-xs'
                  : 'text-[#57534E] hover:text-[#1C1917]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError('');
              }}
              className={`py-2 text-sm font-semibold rounded-md transition-colors cursor-pointer ${
                mode === 'register'
                  ? 'bg-[#FFFDF9] text-[#0B132B] shadow-xs'
                  : 'text-[#57534E] hover:text-[#1C1917]'
              }`}
            >
              New Student
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-sm text-rose-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-[#1C1917] mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ananya Tripathi"
                    className="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#EA580C]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#1C1917] mb-1.5">
                      IIITA Roll Number
                    </label>
                    <input
                      type="text"
                      required
                      value={campusId}
                      onChange={(e) => setCampusId(e.target.value)}
                      placeholder="IIT2025091"
                      className="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#EA580C]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#1C1917] mb-1.5">
                      Mobile Number
                    </label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="9876543210"
                      className="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#EA580C]"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#1C1917] mb-1.5">
                Campus Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="iit2025xxx@iiita.ac.in"
                className="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#EA580C]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1C1917] mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 pr-10 text-sm text-[#1C1917] focus:outline-none focus:ring-2 focus:ring-[#F97316]/30 focus:border-[#EA580C]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-700"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-lg bg-[#EA580C] hover:bg-[#C2410C] disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{mode === 'login' ? 'Sign In' : 'Create Student Account'}</span>
            </button>
          </form>

          {/* Quick Role Access for Campus Demonstration */}
          <div className="mt-6 pt-5 border-t border-[#E6DEC8]">
            <p className="text-xs font-semibold text-[#57534E] mb-2.5">
              Quick Demo Sign-In (Password: Campus@123)
            </p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  disabled={submitting}
                  onClick={() => handleDemoFill(acc.email)}
                  className="text-left px-3 py-2 rounded-lg border border-[#E6DEC8] bg-[#FAF6EE] hover:bg-orange-50 hover:border-[#F97316]/50 transition-colors cursor-pointer"
                >
                  <div className="text-xs font-semibold text-[#0B132B] truncate">
                    {acc.label}
                  </div>
                  <div className="text-[11px] text-[#57534E] truncate">{acc.role}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
