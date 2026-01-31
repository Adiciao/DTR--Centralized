import React, { useState } from 'react';
import { User } from '../types';
import { getUsers } from '../services/db';
import { UserCog, Users } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const users = getUsers();
    const user = users.find(u => u.id === id && u.password === password);

    if (user) {
      onLoginSuccess(user);
    } else {
      setError('Invalid Employee ID or Password');
    }
  };

  return (
    <div className="p-8">
      <div className="text-center mb-8">
        <div className="bg-blue-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
          <UserCog className="text-white w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">Employee Login</h2>
        <p className="text-gray-500 text-sm mt-1">Enter your credentials to access the portal</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center border border-red-100 animate-pulse">
            {error}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID Number</label>
          <input
            type="text"
            value={id}
            onChange={(e) => setId(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            placeholder="e.g. 1001"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            placeholder="•••••••"
            required
          />
        </div>
        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-lg shadow-blue-200 transition-all transform active:scale-95"
        >
          LOG IN
        </button>
      </form>
      
      <div className="mt-8 bg-gray-50 p-4 rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 mb-2 justify-center text-gray-400">
              <Users className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wide">Demo Credentials</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white p-2 rounded border border-gray-200 text-center">
                  <div className="font-bold text-gray-800">Programmer</div>
                  <div className="text-gray-500">ID: 1001</div>
              </div>
              <div className="bg-white p-2 rounded border border-gray-200 text-center">
                  <div className="font-bold text-gray-800">Operator</div>
                  <div className="text-gray-500">ID: 1002</div>
              </div>
              <div className="bg-white p-2 rounded border border-gray-200 text-center">
                  <div className="font-bold text-gray-800">Technician</div>
                  <div className="text-gray-500">ID: 1003</div>
              </div>
              <div className="bg-white p-2 rounded border border-gray-200 text-center">
                  <div className="font-bold text-gray-800">Admin</div>
                  <div className="text-gray-500">ID: ADMIN</div>
              </div>
          </div>
          <div className="text-center mt-2 text-[10px] text-gray-400">
              Default Password for all: <span className="font-mono font-bold text-gray-600">admin123</span>
          </div>
      </div>
    </div>
  );
};