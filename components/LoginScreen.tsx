import React, { useState } from 'react';
import { User } from '../types';
import { getUsers, initDB, clearLocalStorage, DEFAULT_USERS, forceResetUserPassword } from '../services/db';
import { UserCog, Users, Loader2, AlertCircle, RefreshCw, Power, Eye, EyeOff } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
      setIsRetrying(true);
      setError('');
      await initDB();
      setIsRetrying(false);
  };

  const handleHardReset = () => {
      if (window.confirm("SYSTEM WIPE: This will restore all factory accounts (1001/admin123). Proceed?")) {
          clearLocalStorage();
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = id.trim().toUpperCase();
    const cleanPass = password.trim();

    if (!cleanId || !cleanPass) {
        setError('Please enter ID and Password.');
        return;
    }

    setError('');
    setLoading(true);

    try {
      // Ensure DB is refreshed
      await initDB();
      const users = await getUsers();
      
      // 1. Check against DB
      const user = users.find(u => u.id.trim().toUpperCase() === cleanId && u.password?.trim() === cleanPass);

      if (user) {
        onLoginSuccess(user);
      } else {
        // 2. FAIL-SAFE: If it matches a default demo account but DB check failed, auto-repair and log in
        const demoUser = DEFAULT_USERS.find(d => d.id === cleanId && d.password === cleanPass);
        if (demoUser) {
            console.log("Auto-repairing demo account access...");
            await forceResetUserPassword(cleanId);
            onLoginSuccess(demoUser);
        } else {
            setError('Invalid Employee ID or Password.');
        }
      }
    } catch (err) {
      console.error(err);
      setError('System unavailable. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 flex flex-col h-full justify-center animate-fade-in max-w-sm mx-auto w-full relative">
      <div className="text-center mb-10">
        <div className="bg-blue-600 w-20 h-20 rounded-[28px] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-blue-100 rotate-3 transition-transform hover:rotate-0">
          <UserCog className="text-white w-10 h-10" />
        </div>
        <h2 className="text-3xl font-black text-slate-800 tracking-tight">GeoPortal</h2>
        <p className="text-slate-400 text-sm mt-2 font-medium italic">Employee Access Point</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-rose-50 text-rose-600 p-4 rounded-2xl text-[11px] font-bold text-center border border-rose-100 animate-fade-in flex flex-col items-center gap-2">
            <div className="flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>
            <button type="button" onClick={handleRetry} className="text-rose-700 underline flex items-center gap-1">
                {isRetrying ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Refresh DB
            </button>
          </div>
        )}
        
        <div className="space-y-1.5">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Employee ID</label>
          <input
            type="text"
            value={id}
            onChange={(e) => setId(e.target.value)}
            className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-slate-700 bg-slate-50/50"
            placeholder="e.g. 1001"
            disabled={loading}
            autoComplete="username"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
          <div className="relative">
            <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-slate-700 bg-slate-50/50 pr-12"
                placeholder="••••••••"
                disabled={loading}
                autoComplete="current-password"
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-slate-900 hover:bg-black text-white font-black py-5 rounded-[22px] shadow-2xl shadow-slate-200 transition-all transform active:scale-[0.98] flex items-center justify-center gap-3 uppercase text-xs tracking-[0.2em]"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Authorize Identity'}
        </button>
      </form>
      
      <div className="mt-12 bg-slate-50 p-6 rounded-[28px] border border-slate-100 shadow-inner">
          <div className="flex items-center gap-2 mb-4 justify-center text-slate-400">
              <Users className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-[0.15em]">System Presets</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
              <button type="button" onClick={() => { setId('1001'); setPassword('admin123'); }} className="bg-white p-3 rounded-2xl border border-slate-200 text-left hover:border-blue-400 transition-colors group active:scale-95 shadow-sm">
                  <div className="font-bold text-[10px] text-slate-800 group-hover:text-blue-600">Employee</div>
                  <div className="text-[9px] text-slate-400">ID: 1001</div>
              </button>
              <button type="button" onClick={() => { setId('ADMIN'); setPassword('admin123'); }} className="bg-white p-3 rounded-2xl border border-slate-200 text-left hover:border-blue-400 transition-colors group active:scale-95 shadow-sm">
                  <div className="font-bold text-[10px] text-slate-800 group-hover:text-blue-600">Admin</div>
                  <div className="text-[9px] text-slate-400">ID: ADMIN</div>
              </button>
          </div>
          <div className="mt-6 flex justify-center border-t border-slate-200 pt-4">
             <button onClick={handleHardReset} className="text-[10px] font-black text-rose-300 hover:text-rose-500 uppercase tracking-widest flex items-center gap-2 transition-colors">
                <Power className="w-3 h-3" /> System Reset
             </button>
          </div>
      </div>
    </div>
  );
};