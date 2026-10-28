import React from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { useSocket } from '../../context/SocketContext.js';
import { usePwaInstall } from '../../hooks/usePwaInstall.js';
import { Shield, Radio, Activity, Download, LogOut, User as UserIcon, Siren, Bell, BellOff } from 'lucide-react';

interface NavbarProps {
  activeView: string;
  setActiveView: (view: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeView, setActiveView }) => {
  const { user, logout } = useAuth();
  const { isConnected, notificationPermission, requestNotificationPermission } = useSocket();
  const { isInstallable, installPwa } = usePwaInstall();

  return (
    <header className="sticky top-0 z-50 bg-navy-900/90 backdrop-blur-md border-b border-navy-700/60 px-4 lg:px-8 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveView('requester')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-navy-800 p-0.5 border border-cyan-500/30 flex items-center justify-center shadow-lg shadow-cyan-950/50">
            <Siren className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-white">Ambulance<span className="text-cyan-400">Ops</span></span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300">
                PWA Core
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">Emergency Dispatch & Hospital Bed Coordination</p>
          </div>
        </div>

        {/* View Switcher Tabs (Accessible role views) */}
        <nav className="hidden md:flex items-center gap-1 bg-navy-950/70 p-1 rounded-xl border border-navy-800">
          <button
            onClick={() => setActiveView('requester')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeView === 'requester'
                ? 'bg-cyan-500 text-navy-950 shadow-md font-bold'
                : 'text-slate-300 hover:text-white hover:bg-navy-800/60'
            }`}
          >
            Emergency Intake
          </button>
          <button
            onClick={() => setActiveView('dispatcher')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeView === 'dispatcher'
                ? 'bg-cyan-500 text-navy-950 shadow-md font-bold'
                : 'text-slate-300 hover:text-white hover:bg-navy-800/60'
            }`}
          >
            Dispatcher CAD
          </button>
          <button
            onClick={() => setActiveView('crew')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeView === 'crew'
                ? 'bg-cyan-500 text-navy-950 shadow-md font-bold'
                : 'text-slate-300 hover:text-white hover:bg-navy-800/60'
            }`}
          >
            Crew MDT
          </button>
          <button
            onClick={() => setActiveView('hospital')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeView === 'hospital'
                ? 'bg-cyan-500 text-navy-950 shadow-md font-bold'
                : 'text-slate-300 hover:text-white hover:bg-navy-800/60'
            }`}
          >
            Hospital Staff
          </button>
          <button
            onClick={() => setActiveView('admin')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeView === 'admin'
                ? 'bg-cyan-500 text-navy-950 shadow-md font-bold'
                : 'text-slate-300 hover:text-white hover:bg-navy-800/60'
            }`}
          >
            Admin & Audit
          </button>
        </nav>

        {/* Right Status & User Panel */}
        <div className="flex items-center gap-3">
          {/* Socket Connection Pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-navy-950 border border-navy-800">
            <Radio className={`w-3.5 h-3.5 ${isConnected ? 'text-emerald-400 animate-pulse' : 'text-red-400'}`} />
            <span className="text-[11px] font-medium text-slate-300 hidden sm:inline">
              {isConnected ? 'Telemetry Live' : 'Connecting...'}
            </span>
          </div>

          {/* Browser Notification Bell */}
          <button
            onClick={requestNotificationPermission}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-colors border ${
              notificationPermission === 'granted'
                ? 'bg-navy-950 border-cyan-800/80 text-cyan-300 hover:border-cyan-500'
                : 'bg-amber-950/60 border-amber-700/80 text-amber-300 hover:bg-amber-900/60'
            }`}
            title={
              notificationPermission === 'granted'
                ? 'Browser notifications active (Click to test alert sound)'
                : 'Click to enable real-time browser notifications & audio alerts'
            }
          >
            {notificationPermission === 'granted' ? (
              <Bell className="w-3.5 h-3.5 text-cyan-400" />
            ) : (
              <BellOff className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
            )}
            <span className="text-[11px] font-medium hidden sm:inline">
              {notificationPermission === 'granted' ? 'Alerts On' : 'Enable Alerts'}
            </span>
          </button>

          {/* PWA Install Button */}
          {isInstallable && (
            <button
              onClick={installPwa}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 border border-cyan-500/40 transition-colors"
              title="Install application as standalone desktop/mobile PWA"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Install App</span>
            </button>
          )}

          {/* User Profile / Auth */}
          {user ? (
            <div className="flex items-center gap-2">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-semibold text-white leading-tight">{user.fullName}</p>
                <p className="text-[10px] text-cyan-400 font-mono tracking-tight">{user.role}</p>
              </div>
              <button
                onClick={logout}
                className="p-2 rounded-lg bg-navy-800 hover:bg-red-950/70 hover:text-red-400 text-slate-400 transition-colors border border-navy-700"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setActiveView('login')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-navy-800 hover:bg-navy-700 text-slate-200 border border-navy-700 transition-colors"
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
