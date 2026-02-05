import React, { useState } from 'react';
import { X, FileText, Send, Clock, AlertTriangle } from 'lucide-react';
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
        date: startDate
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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md bg-white rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden animate-slide-up flex flex-col max-h-[92vh] border-t sm:border border-slate-200">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
          <div className="flex items-center gap-3">
              <div className="bg-blue-50 p-2 rounded-xl"><FileText className="w-5 h-5 text-blue-600" /></div>
              <h3 className="font-black text-slate-800 tracking-tight">Formal Request</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition active:scale-90">
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 min-h-0 bg-white">
            {/* Category Tabs */}
            <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-6 shadow-inner">
                {['LEAVE', 'OT', 'CORRECTION'].map((cat) => (
                    <button 
                        key={cat}
                        type="button"
                        onClick={() => setCategory(cat as any)}
                        className={`flex-1 py-2.5 text-[10px] font-black rounded-xl transition-all tracking-widest ${category === cat ? 'bg-white shadow-md text-blue-600' : 'text-slate-500 hover:text-slate-600'}`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 pb-6">
                
                {/* --- LEAVE FORM --- */}
                {category === 'LEAVE' && (
                    <div className="space-y-4 animate-fade-in">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Type of Leave</label>
                            <select 
                                value={leaveType}
                                onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                                className="w-full p-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-sm font-bold bg-slate-50 appearance-none shadow-sm"
                            >
                                <option value="SICK">Sick Leave (SL)</option>
                                <option value="VACATION">Vacation Leave (VL)</option>
                                <option value="MATERNITY">Maternity Leave</option>
                                <option value="EMERGENCY">Emergency Leave</option>
                                <option value="OTHER">Other Type</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Start</label>
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-4 rounded-2xl border border-slate-200 text-sm font-bold shadow-sm focus:ring-4 focus:ring-blue-500/10 outline-none" required />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">End</label>
                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-4 rounded-2xl border border-slate-200 text-sm font-bold shadow-sm focus:ring-4 focus:ring-blue-500/10 outline-none" required />
                            </div>
                        </div>
                    </div>
                )}

                {/* --- OT FORM --- */}
                {category === 'OT' && (
                    <div className="space-y-4 animate-fade-in">
                         <div className="bg-emerald-50 p-4 rounded-2xl text-[11px] text-emerald-700 border border-emerald-100 flex items-start gap-3 font-medium">
                            <Clock className="w-4 h-4 shrink-0 mt-0.5" />
                            Overtime requires pre-approval or immediate post-shift reporting.
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Service Date</label>
                                <input type="date" value={otDate} onChange={e => setOtDate(e.target.value)} className="w-full p-4 rounded-2xl border border-slate-200 text-sm font-bold shadow-sm focus:ring-4 focus:ring-blue-500/10 outline-none" required />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Total Hours</label>
                                <input type="number" min="1" max="24" value={otHours} onChange={e => setOtHours(Number(e.target.value))} className="w-full p-4 rounded-2xl border border-slate-200 text-sm font-bold shadow-sm focus:ring-4 focus:ring-blue-500/10 outline-none" required />
                            </div>
                        </div>
                    </div>
                )}

                {/* --- CORRECTION FORM --- */}
                {category === 'CORRECTION' && (
                    <div className="space-y-4 animate-fade-in">
                        <div className="bg-amber-50 p-4 rounded-2xl text-[11px] text-amber-700 border border-amber-100 flex items-start gap-3 font-medium">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                            Only for system malfunctions or inadvertent missed punches.
                        </div>
                         <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Discrepancy Type</label>
                            <select value={correctionType} onChange={(e) => setCorrectionType(e.target.value as any)} className="w-full p-4 rounded-2xl border border-slate-200 text-sm font-bold bg-slate-50 shadow-sm appearance-none outline-none">
                                <option value="MISSED_IN">Missed Clock-IN</option>
                                <option value="MISSED_OUT">Missed Clock-OUT</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Actual Date</label>
                                <input type="date" value={correctionDate} onChange={e => setCorrectionDate(e.target.value)} className="w-full p-4 rounded-2xl border border-slate-200 text-sm font-bold shadow-sm outline-none" required />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Actual Time</label>
                                <input type="time" value={correctionTime} onChange={e => setCorrectionTime(e.target.value)} className="w-full p-4 rounded-2xl border border-slate-200 text-sm font-bold shadow-sm outline-none" required />
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Justification</label>
                    <textarea 
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="w-full p-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-sm min-h-[120px] font-medium shadow-sm"
                        placeholder="Provide details for administrative review..."
                        required
                    ></textarea>
                </div>

                <div className="sticky bottom-0 bg-white pt-2 border-t border-slate-50">
                    <button 
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-[18px] shadow-[0_12px_24px_-8px_rgba(37,99,235,0.4)] transition-all active:scale-[0.98] flex items-center justify-center gap-2 uppercase text-xs tracking-[0.2em] mt-2"
                    >
                        <Send className="w-4 h-4" /> Finalize Submission
                    </button>
                </div>
            </form>
        </div>
      </div>
    </div>
  );
};