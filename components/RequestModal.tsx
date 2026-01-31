import React, { useState } from 'react';
import { X, FileText, Send, Clock, CalendarDays, AlertTriangle } from 'lucide-react';
import { UserRequest, RequestCategory, LeaveType } from '../types';

interface RequestModalProps {
  uid: string;
  userName: string;
  jobTitle?: string;
  onSubmit: (req: UserRequest) => void;
  onClose: () => void;
}

export const RequestModal: React.FC<RequestModalProps> = ({ uid, userName, jobTitle, onSubmit, onClose }) => {
  const [category, setCategory] = useState<RequestCategory>('LEAVE');
  
  // Common Fields
  const [reason, setReason] = useState('');
  
  // Leave Fields
  const [leaveType, setLeaveType] = useState<LeaveType>('SICK');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  // OT Fields
  const [otDate, setOtDate] = useState(new Date().toISOString().split('T')[0]);
  const [otHours, setOtHours] = useState<number>(1);

  // Correction Fields
  const [correctionType, setCorrectionType] = useState<'MISSED_IN' | 'MISSED_OUT'>('MISSED_IN');
  const [correctionDate, setCorrectionDate] = useState(new Date().toISOString().split('T')[0]);
  const [correctionTime, setCorrectionTime] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    let req: UserRequest = {
      id: Date.now().toString(),
      uid,
      name: userName,
      category,
      date: new Date().toISOString(), // Default
      reason,
      status: 'PENDING',
      timestamp: new Date().toISOString(),
      isRead: true,
      jobTitle: jobTitle || 'Employee'
    };

    if (category === 'LEAVE') {
      req = {
        ...req,
        leaveType,
        startDate,
        endDate,
        date: startDate // Main reference date
      };
    } else if (category === 'OT') {
      req = {
        ...req,
        otDate,
        otHours,
        date: otDate
      };
    } else if (category === 'CORRECTION') {
      req = {
        ...req,
        correctionType,
        date: `${correctionDate} ${correctionTime}`,
      };
    }

    onSubmit(req);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden animate-slide-up sm:animate-fade-in flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Submit Request
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto custom-scrollbar">
            {/* Category Tabs */}
            <div className="flex bg-gray-100 p-1 rounded-lg mb-6">
                <button 
                    onClick={() => setCategory('LEAVE')}
                    className={`flex-1 py-2 text-xs font-bold rounded-md transition ${category === 'LEAVE' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                >
                    LEAVE
                </button>
                <button 
                    onClick={() => setCategory('OT')}
                    className={`flex-1 py-2 text-xs font-bold rounded-md transition ${category === 'OT' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                >
                    OVERTIME
                </button>
                <button 
                    onClick={() => setCategory('CORRECTION')}
                    className={`flex-1 py-2 text-xs font-bold rounded-md transition ${category === 'CORRECTION' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                >
                    CORRECTION
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                
                {/* --- LEAVE FORM --- */}
                {category === 'LEAVE' && (
                    <>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Leave Type</label>
                            <select 
                                value={leaveType}
                                onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                                className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                            >
                                <option value="SICK">Sick Leave (SL)</option>
                                <option value="VACATION">Vacation Leave (VL)</option>
                                <option value="MATERNITY">Maternity Leave</option>
                                <option value="EMERGENCY">Emergency Leave</option>
                                <option value="OTHER">Other</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Start Date</label>
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-3 rounded-lg border border-gray-300 text-sm" required />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">End Date</label>
                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-3 rounded-lg border border-gray-300 text-sm" required />
                            </div>
                        </div>
                    </>
                )}

                {/* --- OT FORM --- */}
                {category === 'OT' && (
                    <>
                         <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-700 border border-blue-100 flex items-start gap-2">
                            <Clock className="w-4 h-4 shrink-0 mt-0.5" />
                            Overtime must be requested before the shift begins or immediately after.
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date</label>
                                <input type="date" value={otDate} onChange={e => setOtDate(e.target.value)} className="w-full p-3 rounded-lg border border-gray-300 text-sm" required />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Hours</label>
                                <input type="number" min="1" max="24" value={otHours} onChange={e => setOtHours(Number(e.target.value))} className="w-full p-3 rounded-lg border border-gray-300 text-sm" required />
                            </div>
                        </div>
                    </>
                )}

                {/* --- CORRECTION FORM --- */}
                {category === 'CORRECTION' && (
                    <>
                        <div className="bg-yellow-50 p-3 rounded-lg text-xs text-yellow-700 border border-yellow-100 flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                            Correction requests are for missed punches or technical issues only.
                        </div>
                         <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Issue</label>
                            <select value={correctionType} onChange={(e) => setCorrectionType(e.target.value as any)} className="w-full p-3 rounded-lg border border-gray-300 text-sm bg-white">
                                <option value="MISSED_IN">Forgot Clock IN</option>
                                <option value="MISSED_OUT">Forgot Clock OUT</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date</label>
                                <input type="date" value={correctionDate} onChange={e => setCorrectionDate(e.target.value)} className="w-full p-3 rounded-lg border border-gray-300 text-sm" required />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Time</label>
                                <input type="time" value={correctionTime} onChange={e => setCorrectionTime(e.target.value)} className="w-full p-3 rounded-lg border border-gray-300 text-sm" required />
                            </div>
                        </div>
                    </>
                )}

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Reason / Notes</label>
                    <textarea 
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm min-h-[100px]"
                        placeholder="Please explain why..."
                        required
                    ></textarea>
                </div>

                <button 
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
                >
                    <Send className="w-4 h-4" /> SUBMIT {category} REQUEST
                </button>
            </form>
        </div>
      </div>
    </div>
  );
};