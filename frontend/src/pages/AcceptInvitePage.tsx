import React, { useState } from 'react';
import { api, setToken } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { Key, Lock, User, Phone, AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';

interface AcceptInvitePageProps {
  onSuccess: () => void;
  onNavigateLogin: () => void;
}

export const AcceptInvitePage: React.FC<AcceptInvitePageProps> = ({ onSuccess, onNavigateLogin }) => {
  const { refreshUser } = useAuth();
  const [token, setInvitationToken] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    if (password.length < 10) {
      setErrorMessage('Password must be at least 10 characters.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await api.acceptInvitation({
        token: token.trim(),
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
        password,
      });

      setToken(result.token);
      await refreshUser();
      onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Invitation acceptance failed. Verify your token.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-8 p-6 bg-navy-900 border border-navy-700 rounded-2xl shadow-2xl space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onNavigateLogin} className="p-1.5 rounded-lg bg-navy-800 text-slate-400 hover:text-white">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-lg font-black text-white">Accept Staff Invitation</h2>
          <p className="text-xs text-slate-400">Activate authorized Crew, Hospital, or Dispatcher role</p>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3 rounded-xl bg-red-950/70 border border-red-700 text-red-300 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div>{errorMessage}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Invitation Security Token *</label>
          <div className="relative">
            <Key className="w-4 h-4 text-cyan-400 absolute left-3 top-3" />
            <input
              type="text"
              required
              value={token}
              onChange={(e) => setInvitationToken(e.target.value)}
              placeholder="Paste 64-character hex invitation token..."
              className="w-full bg-navy-950 border border-navy-700 rounded-xl pl-9 pr-3 py-2 font-mono text-xs text-cyan-300 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Full Legal Name *</label>
          <div className="relative">
            <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Paramedic Vignesh S"
              className="w-full bg-navy-950 border border-navy-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Official Mobile Phone</label>
          <div className="relative">
            <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 94440 12345"
              className="w-full bg-navy-950 border border-navy-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Create Account Password *</label>
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
          <label className="block text-xs font-semibold text-slate-300 mb-1">Confirm Password *</label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-navy-950 border border-navy-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-navy-950 uppercase tracking-wider transition-all shadow-md"
        >
          {isLoading ? 'Verifying & Activating...' : 'Activate Privileged Account'}
        </button>
      </form>
    </div>
  );
};
