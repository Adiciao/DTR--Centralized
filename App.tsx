import React, { useState, useEffect } from 'react';
import { User, ScreenState } from './types';
import { SESSION_KEY } from './constants';
import { initDB } from './services/db';
import { LoginScreen } from './components/LoginScreen';
import { ChangePasswordScreen } from './components/ChangePasswordScreen';
import { DashboardScreen } from './components/DashboardScreen';
import { HistoryScreen } from './components/HistoryScreen';
import { AdminScreen } from './components/AdminScreen';
import { MessagesScreen } from './components/MessagesScreen';

const App: React.FC = () => {
  const [screen, setScreen] = useState<ScreenState>(ScreenState.LOGIN);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    // 1. Initialize Mock DB
    initDB();

    // 2. Check Session
    const savedUser = sessionStorage.getItem(SESSION_KEY);
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setCurrentUser(user);
      if (user.role === 'ADMIN') {
        setScreen(ScreenState.ADMIN_DASHBOARD);
      } else {
        setScreen(ScreenState.DASHBOARD);
      }
    }
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

  const isAdminScreen = screen === ScreenState.ADMIN_DASHBOARD;

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-500 ${isAdminScreen ? 'bg-slate-200' : 'bg-gray-100'}`}>
      <div className={`bg-white shadow-2xl overflow-hidden flex flex-col relative transition-all duration-500 ease-in-out
        ${isAdminScreen 
            ? 'w-full max-w-[1400px] h-[90vh] rounded-xl' // Desktop/Web Mode
            : 'w-full max-w-md min-h-[600px] rounded-3xl' // Mobile App Mode
        }`}>
         {renderScreen()}
      </div>
    </div>
  );
};

export default App;