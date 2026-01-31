import React, { useState } from 'react';
import { User } from '../types';
import { updateUser } from '../services/db';
import { KeyRound } from 'lucide-react';

interface ChangePasswordScreenProps {
  currentUser: User;
  onPasswordChanged: (updatedUser: User) => void;
}

export const ChangePasswordScreen: React.FC<ChangePasswordScreenProps> = ({ currentUser, onPasswordChanged }) => {
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPass !== confirmPass) {
      setError("Passwords do not match!");
      return;
    }
    if (newPass.length < 4) {
      setError("Password is too short (min 4 chars).");
      return;
    }

    const updated: User = { ...currentUser, password: newPass, isDefaultPass: false };
    updateUser(updated);
    onPasswordChanged(updated);
  };

  return (
    <div className="p-8">
      <div className="text-center mb-6">
        <div className="bg-orange-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-200">
          <KeyRound className="text-white w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-gray-800">Security Update</h2>
        <p className="text-gray-500 text-sm mt-2">
          You are using a default password. Please update it to continue to the dashboard.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center border border-red-100">
                {error}
            </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
          <input
            type="password"
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
          <input
            type="password"
            value={confirmPass}
            onChange={(e) => setConfirmPass(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
            required
          />
        </div>
        <button
          type="submit"
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-lg shadow-lg shadow-orange-200 transition-all transform active:scale-95"
        >
          UPDATE PASSWORD
        </button>
      </form>
    </div>
  );
};