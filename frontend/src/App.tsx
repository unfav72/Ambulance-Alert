import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { SocketProvider } from './context/SocketContext.js';
import { Navbar } from './components/common/Navbar.js';
import { OfflineAlert } from './components/common/OfflineAlert.js';
import { EmergencyIntakeForm } from './components/requester/EmergencyIntakeForm.js';
import { CaseLiveTracker } from './components/requester/CaseLiveTracker.js';
import { DispatcherDashboard } from './components/dispatcher/DispatcherDashboard.js';
import { CrewMdtDashboard } from './components/crew/CrewMdtDashboard.js';
import { HospitalStaffDashboard } from './components/hospital/HospitalStaffDashboard.js';
import { AdminDashboard } from './components/admin/AdminDashboard.js';
import { LoginPage } from './pages/LoginPage.js';
import { RegisterPage } from './pages/RegisterPage.js';
import { AcceptInvitePage } from './pages/AcceptInvitePage.js';
import { Siren, Shield, Search } from 'lucide-react';
import { api } from './services/api.js';
import { UserRole } from './types/index.js';

const MainApp: React.FC = () => {
  const { user } = useAuth();
  const [activeView, setActiveView] = useState<string>('requester');
  const [registerRole, setRegisterRole] = useState<UserRole>('PATIENT_REQUESTER');
  const [trackedCaseId, setTrackedCaseId] = useState<string | null>(null);
  const [searchCaseNumber, setSearchCaseNumber] = useState<string>('');
  const [isSearchingCase, setIsSearchingCase] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleCaseCreated = (createdCase: any) => {
    setTrackedCaseId(createdCase.id);
  };

  const handleSearchCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchCaseNumber.trim()) return;

    setIsSearchingCase(true);
    setSearchError(null);

    try {
      const res = await api.trackCase(searchCaseNumber.trim().toUpperCase());
      setTrackedCaseId(res.case.id);
      setActiveView('requester');
      setSearchCaseNumber('');
    } catch (err: any) {
      setSearchError(err.message || 'Emergency case not found.');
    } finally {
      setIsSearchingCase(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-navy-950 text-slate-100">
      <OfflineAlert />
      <Navbar activeView={activeView} setActiveView={setActiveView} />

      {/* Main Operational Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeView === 'requester' && (
          <div className="space-y-6">
            {/* Quick Public Case Tracker Search Bar */}
            {!trackedCaseId && (
              <div className="max-w-2xl mx-auto p-4 bg-navy-900 border border-navy-800 rounded-xl shadow-md">
                <form onSubmit={handleSearchCase} className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={searchCaseNumber}
                      onChange={(e) => setSearchCaseNumber(e.target.value)}
                      placeholder="Already have an Incident Case Number? (e.g. EMG-K9Z1-8241)"
                      className="w-full bg-navy-950 border border-navy-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white uppercase font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSearchingCase}
                    className="px-4 py-2 bg-navy-800 hover:bg-navy-700 text-cyan-400 font-bold text-xs rounded-xl border border-navy-700 transition-colors"
                  >
                    {isSearchingCase ? 'Locating...' : 'Track Incident'}
                  </button>
                </form>
                {searchError && (
                  <p className="text-[11px] text-red-400 mt-2 font-mono">{searchError}</p>
                )}
              </div>
            )}

            {trackedCaseId ? (
              <CaseLiveTracker
                caseId={trackedCaseId}
                onBackToIntake={() => setTrackedCaseId(null)}
              />
            ) : (
              <EmergencyIntakeForm onCaseCreated={handleCaseCreated} />
            )}
          </div>
        )}

        {activeView === 'dispatcher' && (
          user ? <DispatcherDashboard /> : (
            <div className="max-w-md mx-auto my-12 p-8 bg-navy-900 border border-navy-700 rounded-2xl shadow-2xl text-center space-y-4">
              <div className="w-12 h-12 rounded-xl bg-sky-950 border border-sky-500/40 text-sky-400 mx-auto flex items-center justify-center">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Dispatcher CAD Authentication Required</h3>
              <p className="text-xs text-slate-400">
                In compliance with security rules, live tactical maps and fleet queues require an authenticated account. Please sign in or create an authorized Dispatcher CAD account.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={() => setActiveView('login')}
                  className="py-2.5 px-3 rounded-xl text-xs font-bold bg-navy-800 hover:bg-navy-700 text-slate-200 uppercase tracking-wider transition-colors border border-navy-700"
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    setRegisterRole('DISPATCHER');
                    setActiveView('register');
                  }}
                  className="py-2.5 px-3 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-400 text-navy-950 uppercase tracking-wider transition-colors shadow-md"
                >
                  Register Dispatcher
                </button>
              </div>
            </div>
          )
        )}

        {activeView === 'crew' && (
          user ? <CrewMdtDashboard /> : (
            <div className="max-w-md mx-auto my-12 p-8 bg-navy-900 border border-navy-700 rounded-2xl shadow-2xl text-center space-y-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-950 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Crew MDT Authentication Required</h3>
              <p className="text-xs text-slate-400">
                To broadcast live GPS telemetry and progress clinical run sheets, sign in or register an Ambulance Paramedic / Crew account.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={() => setActiveView('login')}
                  className="py-2.5 px-3 rounded-xl text-xs font-bold bg-navy-800 hover:bg-navy-700 text-slate-200 uppercase tracking-wider transition-colors border border-navy-700"
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    setRegisterRole('AMBULANCE_CREW');
                    setActiveView('register');
                  }}
                  className="py-2.5 px-3 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-navy-950 uppercase tracking-wider transition-colors shadow-md"
                >
                  Register Crew
                </button>
              </div>
            </div>
          )
        )}

        {activeView === 'hospital' && (
          user ? <HospitalStaffDashboard /> : (
            <div className="max-w-md mx-auto my-12 p-8 bg-navy-900 border border-navy-700 rounded-2xl shadow-2xl text-center space-y-4">
              <div className="w-12 h-12 rounded-xl bg-purple-950 border border-purple-500/40 text-purple-400 mx-auto flex items-center justify-center">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Hospital Staff Authentication Required</h3>
              <p className="text-xs text-slate-400">
                Managing emergency bed capacities and clinical diversion decisions requires authenticated hospital or administrator credentials.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={() => setActiveView('login')}
                  className="py-2.5 px-3 rounded-xl text-xs font-bold bg-navy-800 hover:bg-navy-700 text-slate-200 uppercase tracking-wider transition-colors border border-navy-700"
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    setRegisterRole('HOSPITAL_STAFF');
                    setActiveView('register');
                  }}
                  className="py-2.5 px-3 rounded-xl text-xs font-bold bg-purple-500 hover:bg-purple-400 text-white uppercase tracking-wider transition-colors shadow-md"
                >
                  Register Staff
                </button>
              </div>
            </div>
          )
        )}

        {activeView === 'admin' && (
          user ? <AdminDashboard /> : (
            <div className="max-w-md mx-auto my-12 p-8 bg-navy-900 border border-navy-700 rounded-2xl shadow-2xl text-center space-y-4">
              <div className="w-12 h-12 rounded-xl bg-amber-950 border border-amber-500/40 text-amber-400 mx-auto flex items-center justify-center">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Administrator Access Required</h3>
              <p className="text-xs text-slate-400">
                Sign in with your provisioned System Administrator account, or create an administrator profile to inspect immutable audit logs and manage platform assets.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={() => setActiveView('login')}
                  className="py-2.5 px-3 rounded-xl text-xs font-bold bg-navy-800 hover:bg-navy-700 text-slate-200 uppercase tracking-wider transition-colors border border-navy-700"
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    setRegisterRole('SYSTEM_ADMIN');
                    setActiveView('register');
                  }}
                  className="py-2.5 px-3 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-navy-950 uppercase tracking-wider transition-colors shadow-md"
                >
                  Register Admin
                </button>
              </div>
            </div>
          )
        )}

        {activeView === 'login' && (
          <LoginPage
            onSuccess={() => setActiveView('dispatcher')}
            onNavigateRegister={() => {
              setRegisterRole('PATIENT_REQUESTER');
              setActiveView('register');
            }}
            onNavigateAcceptInvite={() => setActiveView('accept-invite')}
          />
        )}

        {activeView === 'register' && (
          <RegisterPage
            initialRole={registerRole}
            onSuccess={(role) => {
              if (role === 'DISPATCHER') setActiveView('dispatcher');
              else if (role === 'AMBULANCE_CREW') setActiveView('crew');
              else if (role === 'HOSPITAL_STAFF') setActiveView('hospital');
              else if (role === 'SYSTEM_ADMIN') setActiveView('admin');
              else setActiveView('requester');
            }}
            onNavigateLogin={() => setActiveView('login')}
          />
        )}

        {activeView === 'accept-invite' && (
          <AcceptInvitePage
            onSuccess={() => setActiveView('crew')}
            onNavigateLogin={() => setActiveView('login')}
          />
        )}
      </main>

      {/* Production Operations Footer */}
      <footer className="border-t border-navy-800/80 bg-navy-900/60 py-4 px-6 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-400" />
            <span>Concurrent Ambulance Allocation & Hospital Coordination System • Production PWA</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-mono text-slate-500">
            <span>Leaflet 1.9.4 & OpenStreetMap Tiles</span>
            <span>OSRM Dynamic Routing</span>
            <span>ACID Row-Lock Concurrency</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <MainApp />
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
