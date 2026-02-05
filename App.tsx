import React, { useState, useEffect } from 'react';
import { User, ScreenState } from './types';
import { SESSION_KEY } from './constants';
import { initDB, getUsers } from './services/db';
import { LoginScreen } from './components/LoginScreen';
import { ChangePasswordScreen } from './components/ChangePasswordScreen';
import { DashboardScreen } from './components/DashboardScreen';
import { HistoryScreen } from './components/HistoryScreen';
import { AdminScreen } from './components/AdminScreen';
import { MessagesScreen } from './components/MessagesScreen';
import { Loader2, ShieldCheck } from 'lucide-react';

const App: React.FC = () => {
  const [screen, setScreen] = useState<ScreenState>(ScreenState.LOGIN);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const start = async () => {
      try {
        await initDB();
        const dbUsers = await getUsers();

        const savedUser = sessionStorage.getItem(SESSION_KEY);
        if (savedUser) {
            const user = JSON.parse(savedUser);
            // Case-insensitive verification
            const validUser = dbUsers.find(u => u.id.toUpperCase() === user.id.toUpperCase());
            
            if (validUser) {
                setCurrentUser(validUser);
                if (validUser.role === 'ADMIN') {
                  setScreen(ScreenState.ADMIN_DASHBOARD);
                } else {
                  setScreen(ScreenState.DASHBOARD);
                }
            } else {
                sessionStorage.removeItem(SESSION_KEY);
                setScreen(ScreenState.LOGIN);
            }
        }
      } catch (e) {
        console.error("Initialization failed:", e);
        sessionStorage.removeItem(SESSION_KEY);
        setScreen(ScreenState.LOGIN);
      } finally {
        setTimeout(() => setIsInitializing(false), 800);
      }
    };
    start();
  }, []);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    if (user.isDefaultPass) {
      setScreen(ScreenState.CHANGE_PASSWORD);
    } else {
      startSession(user);
    }
  };

  const handlePasswordChanged = (updatedUser: User) => {
    setCurrentUser(updatedUser);
    alert("Password updated successfully!");
    startSession(updatedUser);
  };

  const startSession = (user: User) => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    if (user.role === 'ADMIN') {
        setScreen(ScreenState.ADMIN_DASHBOARD);
    } else {
        setScreen(ScreenState.DASHBOARD);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setCurrentUser(null);
    setScreen(ScreenState.LOGIN);
  };

  const renderScreen = () => {
    if (isInitializing) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-fade-in h-full">
                <div className="w-20 h-20 bg-blue-600 rounded-[24px] shadow-2xl shadow-blue-200 flex items-center justify-center mb-6 relative overflow-hidden group">
                    <ShieldCheck className="w-10 h-10 text-white relative z-10" />
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                </div>
                <h1 className="text-2xl font-black text-slate-800 tracking-tight mb-2">GeoPortal</h1>
                <p className="text-slate-400 text-sm font-medium tracking-wide uppercase flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    Syncing Records...
                </p>
            </div>
        );
    }

    switch (screen) {
      case ScreenState.LOGIN:
        return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
      case ScreenState.CHANGE_PASSWORD:
        return currentUser ? (
          <ChangePasswordScreen 
            currentUser={currentUser} 
            onPasswordChanged={handlePasswordChanged} 
          />
        ) : null;
      case ScreenState.DASHBOARD:
        return currentUser ? (
          <DashboardScreen 
            currentUser={currentUser} 
            onLogout={handleLogout} 
            onViewHistory={() => setScreen(ScreenState.HISTORY)}
            onViewMessages={() => setScreen(ScreenState.MESSAGES)}
            onSwitchToAdmin={currentUser.role === 'ADMIN' ? () => setScreen(ScreenState.ADMIN_DASHBOARD) : undefined}
          />
        ) : null;
      case ScreenState.HISTORY:
        return currentUser ? (
          <HistoryScreen 
            currentUser={currentUser}
            onBack={() => setScreen(ScreenState.DASHBOARD)}
          />
        ) : null;
      case ScreenState.MESSAGES:
        return currentUser ? (
          <MessagesScreen 
            currentUser={currentUser}
            onBack={() => setScreen(ScreenState.DASHBOARD)}
          />
        ) : null;
      case ScreenState.ADMIN_DASHBOARD:
        return currentUser ? (
            <AdminScreen 
                currentUser={currentUser}
                onLogout={handleLogout}
                onSwitchToEmployee={() => setScreen(ScreenState.DASHBOARD)}
            />
        ) : null;
      default:
        return <div className="p-10 text-center">Unknown State</div>;
    }
  };

  const isAdminScreen = screen === ScreenState.ADMIN_DASHBOARD && !isInitializing;

  return (
    <div className={`min-h-screen flex items-center justify-center transition-colors duration-500 
      ${isAdminScreen ? 'bg-slate-50 p-0' : 'bg-slate-100 sm:p-4 p-0'}
    `}>
      <div className={`bg-white relative transition-all duration-500 ease-in-out flex flex-col
        ${isAdminScreen 
            ? 'w-full h-screen rounded-none border-none'
            : 'w-full sm:max-w-md sm:min-h-[700px] sm:rounded-[48px] min-h-screen rounded-none shadow-2xl overflow-hidden'
        }`}>
         {renderScreen()}
      </div>
    </div>
  );
};

export default App;