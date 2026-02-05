
import React, { useEffect, useState } from 'react';
import { User, UserRequest, Message } from '../types';
import { getRequests, getMessages, markRequestsAsRead, markMessagesAsRead } from '../services/db';
import { ArrowLeft, Inbox, CheckCircle, XCircle, Clock, AlertCircle, CalendarDays, Loader2, MessageSquare, ShieldCheck, ChevronRight } from 'lucide-react';

interface MessagesScreenProps {
  currentUser: User;
  onBack: () => void;
}

type TabMode = 'UPDATES' | 'MESSAGES';

export const MessagesScreen: React.FC<MessagesScreenProps> = ({ currentUser, onBack }) => {
  const [activeTab, setActiveTab] = useState<TabMode>('UPDATES');
  const [requests, setRequests] = useState<UserRequest[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [allReqs, allMsgs] = await Promise.all([getRequests(), getMessages()]);
      
      const userReqs = allReqs.filter(r => r.uid === currentUser.id);
      setRequests(userReqs);
      
      const userMsgs = allMsgs.filter(m => m.toId === currentUser.id || m.toId === 'ALL');
      setMessages(userMsgs);

      await Promise.all([
          markRequestsAsRead(currentUser.id),
          markMessagesAsRead(currentUser.id)
      ]);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
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
      <div className="bg-white p-5 border-b border-slate-100 sticky top-0 z-10">
        <div className="flex items-center gap-4 mb-6">
            <button onClick={selectedMessage ? () => setSelectedMessage(null) : onBack} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl transition active:scale-90">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
                <h2 className="text-xl font-black text-slate-800 tracking-tight">{selectedMessage ? 'Message' : 'Notification Hub'}</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{selectedMessage ? 'Read Memo' : 'Track your interactions'}</p>
            </div>
        </div>

        {!selectedMessage && (
            <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                <button 
                    onClick={() => setActiveTab('UPDATES')} 
                    className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'UPDATES' ? 'bg-white shadow-md text-blue-600' : 'text-slate-400'}`}
                >
                    Status Updates
                </button>
                <button 
                    onClick={() => setActiveTab('MESSAGES')} 
                    className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'MESSAGES' ? 'bg-white shadow-md text-blue-600' : 'text-slate-400'}`}
                >
                    Direct Messages
                </button>
            </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center mt-20 gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Syncing Inbox...</p>
          </div>
        ) : selectedMessage ? (
            <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm animate-fade-in">
                <div className="flex items-center gap-4 mb-8">
                    <div className="bg-blue-600 p-4 rounded-2xl shadow-lg shadow-blue-100"><ShieldCheck className="w-8 h-8 text-white" /></div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">From Admin: {selectedMessage.fromName}</p>
                        <h3 className="text-xl font-black text-slate-800 tracking-tight">{selectedMessage.subject}</h3>
                    </div>
                </div>
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner mb-8 min-h-[200px]">
                    <p className="text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">{selectedMessage.content}</p>
                </div>
                <div className="text-right">
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Received {new Date(selectedMessage.timestamp).toLocaleString()}</span>
                </div>
            </div>
        ) : activeTab === 'UPDATES' ? (
            requests.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400 opacity-30">
                    <Inbox className="w-16 h-16 mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em]">No status changes</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {requests.map(req => (
                        <div key={req.id} className="bg-white rounded-[24px] shadow-sm border border-slate-200 overflow-hidden relative group hover:shadow-md transition-all">
                             <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${getStatusColor(req.status)}`}></div>
                             <div className="p-6 pl-8">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        {getStatusIcon(req.status)}
                                        <span className="font-black text-slate-800 text-sm tracking-tight">{getStatusText(req.status)}</span>
                                    </div>
                                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{new Date(req.timestamp).toLocaleDateString()}</span>
                                </div>
                                <div className="mb-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{req.category}</span>
                                        <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                                        <span className="text-[10px] font-bold text-slate-600">{req.category === 'LEAVE' ? req.leaveType : req.category === 'OT' ? `${req.otHours} Hours` : req.correctionType}</span>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center gap-3">
                                        <CalendarDays className="w-4 h-4 text-blue-500" />
                                        <span className="text-[11px] font-bold text-slate-500">
                                            {req.category === 'LEAVE' ? `${new Date(req.startDate!).toLocaleDateString()} - ${new Date(req.endDate!).toLocaleDateString()}` : new Date(req.date).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                                {req.reason && <p className="text-xs text-slate-400 italic line-clamp-2">"{req.reason}"</p>}
                             </div>
                        </div>
                    ))}
                </div>
            )
        ) : (
            messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400 opacity-30">
                    <MessageSquare className="w-16 h-16 mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em]">Your inbox is empty</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {messages.map(msg => (
                        <button 
                            key={msg.id} 
                            onClick={() => setSelectedMessage(msg)}
                            className="w-full text-left bg-white rounded-[24px] p-6 border border-slate-200 shadow-sm relative group hover:border-blue-200 transition-all active:scale-[0.98]"
                        >
                            {!msg.isRead && <div className="absolute top-6 right-6 w-2 h-2 bg-blue-600 rounded-full shadow-lg shadow-blue-200"></div>}
                            <div className="flex items-center gap-4 mb-4">
                                <div className="bg-slate-50 p-3 rounded-xl group-hover:bg-blue-50 transition-colors">
                                    <ShieldCheck className="w-6 h-6 text-slate-400 group-hover:text-blue-500" />
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Administrative Memo</p>
                                    <h4 className="font-black text-slate-800 text-sm tracking-tight">{msg.subject}</h4>
                                </div>
                            </div>
                            <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed mb-4 italic">"{msg.content}"</p>
                            <div className="flex justify-between items-center">
                                <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{new Date(msg.timestamp).toLocaleDateString()}</span>
                                <span className="text-[9px] font-black text-blue-600 uppercase tracking-[0.2em] flex items-center gap-1 group-hover:translate-x-1 transition-transform">Read Full Message <ChevronRight className="w-3 h-3" /></span>
                            </div>
                        </button>
                    ))}
                </div>
            )
        )}
      </div>
    </div>
  );
};
