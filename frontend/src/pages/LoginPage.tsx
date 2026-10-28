import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { Shield, Lock, Mail, AlertCircle, ArrowRight, Siren } from 'lucide-react';

interface LoginPageProps {
  onSuccess: () => void;
  onNavigateRegister: () => void;
  onNavigateAcceptInvite: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onSuccess,
  onNavigateRegister,
  onNavigateAcceptInvite,
}) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaToken, setMfaToken] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      await login({
        email: email.trim(),
        password,
        mfaToken: mfaToken.trim() || undefined,
      });
      onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-12 p-6 bg-navy-900 border border-navy-700 rounded-2xl shadow-2xl space-y-6">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-cyan-950 border border-cyan-500/40 text-cyan-400 mx-auto flex items-center justify-center shadow-lg">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-black text-white">Operator & Patient Sign In</h2>
        <p className="text-xs text-slate-400">Authenticate to access authorized CAD, MDT, or Clinical view</p>
      </div>

      {errorMessage && (
        <div className="p-3 rounded-xl bg-red-950/70 border border-red-700 text-red-300 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div>{errorMessage}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@ems.gov"
              className="w-full bg-navy-950 border border-navy-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-navy-950 border border-navy-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">MFA Security Code (Optional)</label>
          <input
            type="text"
            maxLength={6}
            value={mfaToken}
            onChange={(e) => setMfaToken(e.target.value)}
            placeholder="6-digit code if MFA enabled"
            className="w-full bg-navy-950 border border-navy-700 rounded-xl px-3 py-2 text-xs text-white font-mono tracking-widest focus:outline-none focus:border-cyan-500"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-navy-950 uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2"
        >
          {isLoading ? 'Verifying Credentials...' : 'Sign In'}
        </button>
      </form>

      <div className="pt-4 border-t border-navy-800 text-center space-y-2 text-xs">
        <p className="text-slate-400">
          Need to create an account?{' '}
          <button onClick={onNavigateRegister} className="text-cyan-400 hover:underline font-semibold">
            Register by Role (Patient, Dispatcher, Crew, Hospital, Admin)
          </button>
        </p>
        <p className="text-slate-400">
          Have an invitation token?{' '}
          <button onClick={onNavigateAcceptInvite} className="text-cyan-400 hover:underline font-semibold">
            Accept Staff Invitation
          </button>
        </p>
      </div>
    </div>
  );
};
