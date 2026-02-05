
import React, { useState, useEffect, useMemo } from 'react';
import { User, AttendanceLog, UserRequest } from '../types';
import { getLogs, getRequests, getSettings } from '../services/db';
import { ArrowLeft, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, CheckCircle, AlertCircle, X, FileQuestion, Briefcase, Table as TableIcon, Download, FileText, MapPin, Building2, Loader2, Info } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface HistoryScreenProps {
  currentUser: User;
  onBack: () => void;
}

interface DayData {
  dateStr: string;
  rawDate: Date;
  logs: AttendanceLog[];
  requests: UserRequest[];
  clockIn?: AttendanceLog;
  clockOut?: AttendanceLog;
  duration?: string;
  durationMs?: number;
  status: 'COMPLETE' | 'HALF_DAY' | 'MISSED_OUT' | 'ABSENT' | 'LEAVE' | 'FUTURE';
  remark: string;
  hasRequest: boolean;
}

type ViewMode = 'CALENDAR' | 'TABLE';

export const HistoryScreen: React.FC<HistoryScreenProps> = ({ currentUser, onBack }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('CALENDAR');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [requests, setRequests] = useState<UserRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [allLogs, allReqs] = await Promise.all([getLogs(), getRequests()]);
        setLogs(allLogs.filter(l => l.uid === currentUser.id));
        setRequests(allReqs.filter(r => r.uid === currentUser.id));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, [currentUser.id]);

  const dayDataMap = useMemo<Record<string, DayData>>(() => {
    const map: Record<string, DayData> = {};
    const todayStr = new Date().toLocaleDateString();
    
    // 1. Map logs
    logs.forEach(log => {
      const dStr = new Date(log.timestamp).toLocaleDateString();
      if (!map[dStr]) map[dStr] = { dateStr: dStr, rawDate: new Date(log.timestamp), logs: [], requests: [], status: 'ABSENT', remark: 'Absent', hasRequest: false };
      map[dStr].logs.push(log);
    });

    // 2. Map Requests (Leaves)
    requests.forEach(req => {
      if (req.status === 'APPROVED' && req.category === 'LEAVE' && req.startDate && req.endDate) {
          const start = new Date(req.startDate);
          const end = new Date(req.endDate);
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
              const dStr = d.toLocaleDateString();
              if (!map[dStr]) map[dStr] = { dateStr: dStr, rawDate: new Date(d), logs: [], requests: [], status: 'LEAVE', remark: `Leave (${req.leaveType})`, hasRequest: true };
              else {
                  map[dStr].status = 'LEAVE';
                  map[dStr].remark = `Leave (${req.leaveType})`;
                  map[dStr].hasRequest = true;
              }
          }
      }
    });

    // 3. Finalize Status and Remarks
    Object.values(map).forEach(day => {
      const ins = day.logs.filter(l => l.type === 'IN').sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const outs = day.logs.filter(l => l.type === 'OUT').sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      day.clockIn = ins[0];
      day.clockOut = outs[0];

      if (day.clockIn && day.clockOut) {
          const start = new Date(day.clockIn.timestamp).getTime();
          const end = new Date(day.clockOut.timestamp).getTime();
          const diffMs = end - start;
          day.durationMs = diffMs;
          day.duration = `${Math.floor(diffMs / 3600000)}h ${Math.floor((diffMs % 3600000) / 60000)}m`;
          
          if (diffMs < 5 * 3600000) { // Less than 5 hours is half day
              day.status = 'HALF_DAY';
              day.remark = 'Half Day';
          } else {
              day.status = 'COMPLETE';
              day.remark = 'Complete';
          }
      } else if (day.clockIn) {
          if (day.dateStr === todayStr) {
              day.status = 'FUTURE'; // Use FUTURE for "In Progress" today
              day.remark = 'On-going';
          } else {
              day.status = 'HALF_DAY';
              day.remark = 'Half day (not clocked out)';
          }
      } else if (day.status !== 'LEAVE') {
          // Check if it's a weekend or future date
          const dayOfWeek = day.rawDate.getDay();
          if (dayOfWeek === 0 || dayOfWeek === 6) {
              day.remark = 'Weekend';
          } else if (day.rawDate > new Date()) {
              day.remark = 'Upcoming';
              day.status = 'FUTURE';
          } else {
              day.remark = 'Absent';
              day.status = 'ABSENT';
          }
      }
    });

    return map;
  }, [logs, requests]);

  // Fix: Explicitly cast Object.values(dayDataMap) to DayData[] to resolve 'unknown' type error in sort()
  const sortedTableData = useMemo(() => {
      return (Object.values(dayDataMap) as DayData[]).sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());
  }, [dayDataMap]);

  const { daysInMonth, firstDayOfWeek } = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    return { daysInMonth: new Date(year, month + 1, 0).getDate(), firstDayOfWeek: new Date(year, month, 1).getDay() };
  }, [currentMonth]);

  const changeMonth = (delta: number) => { 
      const newDate = new Date(currentMonth); 
      newDate.setMonth(newDate.getMonth() + delta); 
      setCurrentMonth(newDate); 
  };

  const getStatusBadge = (status: string, remark: string) => {
    switch(status) {
        case 'COMPLETE': return <span className="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider">{remark}</span>;
        case 'HALF_DAY': return <span className="bg-amber-100 text-amber-700 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider">{remark}</span>;
        case 'ABSENT': return <span className="bg-rose-100 text-rose-700 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider">{remark}</span>;
        case 'LEAVE': return <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider">{remark}</span>;
        default: return <span className="bg-slate-100 text-slate-500 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider">{remark}</span>;
    }
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    doc.setFillColor(37, 99, 235); doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(22); doc.text('Attendance Audit Report', 14, 25);
    doc.setFontSize(10); doc.text(`Employee: ${currentUser.name} | Period: ${currentMonth.toLocaleDateString('en-US', {month: 'long', year: 'numeric'})}`, 14, 33);
    
    const rows = sortedTableData
        .filter(d => d.rawDate.getMonth() === currentMonth.getMonth() && d.rawDate.getFullYear() === currentMonth.getFullYear())
        .map(day => [
            day.dateStr, 
            day.clockIn ? new Date(day.clockIn.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--', 
            day.clockOut ? new Date(day.clockOut.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--', 
            day.duration || '--', 
            day.remark
        ]);
        
    autoTable(doc, { 
        startY: 50, 
        head: [['Date', 'Clock In', 'Clock Out', 'Duration', 'Remark']], 
        body: rows, 
        headStyles: { fillColor: [37, 99, 235] },
        styles: { fontSize: 8 }
    });
    doc.save(`DTR_${currentUser.id}_${currentMonth.getMonth()+1}.pdf`);
  };

  const selectedDayData = dayDataMap[selectedDate.toLocaleDateString()];

  return (
    <div className="flex flex-col h-full bg-white relative">
      <div className="bg-white p-5 border-b border-slate-100 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl transition active:scale-90"><ArrowLeft className="w-5 h-5 text-slate-600" /></button>
                <div><h2 className="text-xl font-black text-slate-800 tracking-tight">Time Ledger</h2><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">DTR History Logs</p></div>
            </div>
            <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                <button onClick={() => setViewMode('CALENDAR')} className={`p-2.5 rounded-xl transition-all ${viewMode === 'CALENDAR' ? 'bg-white shadow-md text-blue-600' : 'text-slate-400'}`}><CalendarIcon className="w-5 h-5" /></button>
                <button onClick={() => setViewMode('TABLE')} className={`p-2.5 rounded-xl transition-all ${viewMode === 'TABLE' ? 'bg-white shadow-md text-blue-600' : 'text-slate-400'}`}><TableIcon className="w-5 h-5" /></button>
            </div>
        </div>
        {viewMode === 'CALENDAR' && (
            <div className="animate-fade-in">
                <div className="flex items-center justify-between bg-slate-50 p-2 rounded-2xl mb-4">
                    <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-white rounded-xl transition shadow-sm"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
                    <div className="font-black text-slate-800 uppercase text-[11px] tracking-widest">{currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
                    <button onClick={() => changeMonth(1)} className="p-2 hover:bg-white rounded-xl transition shadow-sm"><ChevronRight className="w-5 h-5 text-slate-600" /></button>
                </div>
                <div className="grid grid-cols-7 text-center mb-2">
                    {['S','M','T','W','T','F','S'].map((d, i) => (<div key={i} className="text-[10px] font-black text-slate-300 uppercase">{d}</div>))}
                </div>
            </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-5 bg-white">
        {loading ? (
            <div className="flex flex-col items-center justify-center mt-20 gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-blue-600"/>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Compiling Records...</p>
            </div>
        ) : (
          viewMode === 'CALENDAR' ? (
            <div className="animate-fade-in">
                <div className="grid grid-cols-7 gap-2 mb-8">
                    {Array.from({ length: firstDayOfWeek }).map((_, i) => (<div key={i} className="aspect-square opacity-0"></div>))}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                        const dateObj = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i + 1);
                        const dateStr = dateObj.toLocaleDateString();
                        const data = dayDataMap[dateStr];
                        const isSelected = selectedDate.toLocaleDateString() === dateStr;
                        
                        let dotColor = 'bg-slate-200';
                        if (data) {
                            if (data.status === 'COMPLETE') dotColor = 'bg-emerald-500';
                            else if (data.status === 'HALF_DAY') dotColor = 'bg-amber-500';
                            else if (data.status === 'ABSENT') dotColor = 'bg-rose-500';
                            else if (data.status === 'LEAVE') dotColor = 'bg-blue-500';
                        }

                        return (
                            <button 
                                key={i} 
                                onClick={() => setSelectedDate(dateObj)} 
                                className={`aspect-square rounded-[20px] flex flex-col items-center justify-center relative border transition-all ${isSelected ? 'bg-slate-900 text-white border-slate-900 shadow-xl scale-105 z-10' : 'bg-white border-slate-100 hover:bg-slate-50'}`}
                            >
                                <span className={`text-xs font-black ${isSelected ? 'text-white' : 'text-slate-700'}`}>{i+1}</span>
                                {data && <div className={`w-1.5 h-1.5 rounded-full mt-1.5 ${isSelected ? 'bg-white' : dotColor} shadow-sm`}></div>}
                            </button>
                        );
                    })}
                </div>
                
                <div className="bg-slate-50 rounded-[32px] p-8 border border-slate-100 shadow-inner min-h-[250px] flex flex-col justify-center">
                    {!selectedDayData ? (
                        <div className="text-center space-y-3">
                            <Info className="w-10 h-10 text-slate-200 mx-auto" />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No activity recorded for this date.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center"><span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Shift Status</span>{getStatusBadge(selectedDayData.status, selectedDayData.remark)}</div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm"><p className="text-[9px] font-black text-slate-400 uppercase mb-1">Time In</p><p className="font-mono font-bold text-slate-800 text-lg">{selectedDayData.clockIn ? new Date(selectedDayData.clockIn.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--'}</p></div>
                                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm"><p className="text-[9px] font-black text-slate-400 uppercase mb-1">Time Out</p><p className="font-mono font-bold text-slate-800 text-lg">{selectedDayData.clockOut ? new Date(selectedDayData.clockOut.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--'}</p></div>
                            </div>
                            {selectedDayData.duration && (
                                <div className="bg-slate-900 p-5 rounded-2xl flex justify-between items-center shadow-lg"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Rendering</span><span className="font-mono font-black text-white text-xl">{selectedDayData.duration}</span></div>
                            )}
                        </div>
                    )}
                </div>
            </div>
          ) : (
            <div className="animate-fade-in space-y-6">
                <div className="flex justify-between items-center mb-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Monthly Ledger Record</p>
                    <button onClick={handleDownloadPDF} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-black transition shadow-lg"><Download className="w-4 h-4"/> PDF Export</button>
                </div>
                <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-400 tracking-widest border-b border-slate-100">
                            <tr><th className="px-6 py-4">Date</th><th className="px-6 py-4">Logs</th><th className="px-6 py-4 text-right">Remark</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {sortedTableData.map((d, i) => (
                                <tr key={i} className="hover:bg-slate-50/50 transition cursor-default">
                                    <td className="px-6 py-5 font-black text-slate-800">{d.dateStr}</td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-3 font-mono text-[11px] font-bold">
                                            <span className="text-emerald-600">{d.clockIn ? new Date(d.clockIn.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '--:--'}</span>
                                            <span className="text-slate-300">|</span>
                                            <span className="text-rose-600">{d.clockOut ? new Date(d.clockOut.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '--:--'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-right">{getStatusBadge(d.status, d.remark)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};
