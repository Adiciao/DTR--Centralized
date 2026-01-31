import React, { useEffect, useState } from 'react';
import { User, UserRequest } from '../types';
import { getRequests, markRequestsAsRead } from '../services/db';
import { ArrowLeft, Inbox, CheckCircle, XCircle, Clock, AlertCircle, CalendarDays } from 'lucide-react';

interface MessagesScreenProps {
  currentUser: User;
  onBack: () => void;
}

export const MessagesScreen: React.FC<MessagesScreenProps> = ({ currentUser, onBack }) => {
  const [requests, setRequests] = useState<UserRequest[]>([]);

  useEffect(() => {
    // 1. Get User Requests
    const all = getRequests();
    const userReqs = all.filter(r => r.uid === currentUser.id);
    setRequests(userReqs);

    // 2. Mark as read immediately when viewing this screen
    markRequestsAsRead(currentUser.id);
  }, [currentUser.id]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-500';
      case 'PROCESSING': return 'bg-orange-500';
      case 'APPROVED': return 'bg-green-500';
      case 'REJECTED': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING': return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'PROCESSING': return <Clock className="w-5 h-5 text-orange-500" />;
      case 'APPROVED': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'REJECTED': return <XCircle className="w-5 h-5 text-red-500" />;
      default: return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
      switch(status) {
          case 'PENDING': return 'Pending Approval';
          case 'PROCESSING': return 'In Review';
          case 'APPROVED': return 'Request Approved';
          case 'REJECTED': return 'Request Denied';
          default: return status;
      }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      <div className="bg-white p-4 shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition">
                <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
                <h2 className="text-lg font-bold text-gray-800">Status Updates</h2>
                <p className="text-xs text-gray-500">Track your application status</p>
            </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
        {requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <Inbox className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-sm">No requests found.</p>
                <p className="text-xs">Submit a leave or overtime request to see it here.</p>
            </div>
        ) : (
            <div className="space-y-4">
                {requests.map(req => (
                    <div key={req.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
                         {/* Status Indicator Strip */}
                         <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${getStatusColor(req.status)}`}></div>
                         
                         <div className="p-4 pl-5">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                    {getStatusIcon(req.status)}
                                    <span className="font-bold text-gray-800 text-sm">{getStatusText(req.status)}</span>
                                </div>
                                <span className="text-[10px] text-gray-400">{new Date(req.timestamp).toLocaleDateString()}</span>
                            </div>

                            <div className="mb-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">{req.category}</span>
                                    <span className="text-gray-300">•</span>
                                    <span className="text-xs text-gray-700">
                                        {req.category === 'LEAVE' ? req.leaveType : req.category === 'OT' ? `${req.otHours} Hours` : req.correctionType}
                                    </span>
                                </div>
                                
                                {/* Date Context */}
                                <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                    <CalendarDays className="w-3 h-3" />
                                    {req.category === 'LEAVE' ? (
                                        <span>{new Date(req.startDate!).toLocaleDateString()} - {new Date(req.endDate!).toLocaleDateString()}</span>
                                    ) : req.category === 'OT' ? (
                                        <span>{new Date(req.otDate!).toLocaleDateString()}</span>
                                    ) : (
                                        <span>{new Date(req.date).toLocaleDateString()}</span>
                                    )}
                                </div>
                            </div>

                            {req.reason && (
                                <p className="text-xs text-gray-500 italic">
                                    "{req.reason}"
                                </p>
                            )}
                         </div>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
};