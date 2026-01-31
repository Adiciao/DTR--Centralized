import React, { useState, useEffect, useMemo } from 'react';
import { User, AttendanceLog, UserRequest } from '../types';
import { getLogs, getRequests } from '../services/db';
import { ArrowLeft, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Image as ImageIcon, CheckCircle, AlertCircle, X, FileQuestion, Briefcase, Table as TableIcon, Download, FileText, MapPin, Building2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface HistoryScreenProps {
  currentUser: User;
  onBack: () => void;
}

interface DayData {
  dateStr: string;
  rawDate: Date; // For sorting
  logs: AttendanceLog[];
  requests: UserRequest[];
  clockIn?: AttendanceLog;
  clockOut?: AttendanceLog;
  duration?: string;
  status: 'COMPLETE' | 'ONGOING' | 'MISSED_OUT' | 'ABSENT' | 'FUTURE';
  hasRequest: boolean;
}

type ViewMode = 'CALENDAR' | 'TABLE';

export const HistoryScreen: React.FC<HistoryScreenProps> = ({ currentUser, onBack }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('CALENDAR');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [requests, setRequests] = useState<UserRequest[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // 1. Fetch Data
  useEffect(() => {
    const allLogs = getLogs();
    const allReqs = getRequests();
    setLogs(allLogs.filter(l => l.uid === currentUser.id));
    setRequests(allReqs.filter(r => r.uid === currentUser.id));
  }, [currentUser.id]);

  // 2. Process Data into a Map
  const dayDataMap = useMemo<Record<string, DayData>>(() => {
    const map: Record<string, DayData> = {};

    const getInitDay = (dateStr: string, rawDate: Date): DayData => ({
      dateStr,
      rawDate,
      logs: [],
      requests: [],
      status: 'ABSENT',
      hasRequest: false
    });

    // Map Logs
    logs.forEach(log => {
      const dateObj = new Date(log.timestamp);
      const dateStr = dateObj.toLocaleDateString();
      if (!map[dateStr]) map[dateStr] = getInitDay(dateStr, dateObj);
      map[dateStr].logs.push(log);
    });

    // Map Requests
    requests.forEach(req => {
      // Logic to place requests on specific dates
      let targetDateStr = '';
      let targetDateObj = new Date();

      if (req.category === 'LEAVE' && req.startDate) {
          // Simplification: Just putting it on the start date for calendar view
          const parsed = new Date(req.startDate);
          targetDateStr = parsed.toLocaleDateString();
          targetDateObj = parsed;
      } else if (req.category === 'OT' && req.otDate) {
          const parsed = new Date(req.otDate);
          targetDateStr = parsed.toLocaleDateString();
          targetDateObj = parsed;
      } else if (req.date) {
         const parsed = new Date(req.date);
         if (!isNaN(parsed.getTime())) {
             targetDateStr = parsed.toLocaleDateString();
             targetDateObj = parsed;
         }
      }
      
      if (targetDateStr) {
          // Handle timezone offset simply
          const normalizedStr = targetDateObj.toLocaleDateString();
          
          if (!map[normalizedStr]) map[normalizedStr] = getInitDay(normalizedStr, targetDateObj);
          map[normalizedStr].requests.push(req);
          map[normalizedStr].hasRequest = true;
      }
    });

    // Process Status & Duration
    Object.values(map).forEach(day => {
      const ins = day.logs.filter(l => l.type === 'IN').sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const outs = day.logs.filter(l => l.type === 'OUT').sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      day.clockIn = ins[0];
      day.clockOut = outs[0];

      if (day.clockIn && day.clockOut) {
        day.status = 'COMPLETE';
        const start = new Date(day.clockIn.timestamp).getTime();
        const end = new Date(day.clockOut.timestamp).getTime();
        const diffMs = end - start;
        const hours = Math.floor(diffMs / 3600000);
        const mins = Math.floor((diffMs % 3600000) / 60000);
        day.duration = `${hours}h ${mins}m`;
      } else if (day.clockIn) {
        const isToday = new Date().toLocaleDateString() === day.dateStr;
        day.status = isToday ? 'ONGOING' : 'MISSED_OUT';
        day.duration = '--';
      }
    });

    return map;
  }, [logs, requests]);

  const sortedTableData = useMemo(() => {
    return Object.values(dayDataMap).sort((a: DayData, b: DayData) => b.rawDate.getTime() - a.rawDate.getTime());
  }, [dayDataMap]);

  // 3. Calendar Helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sunday
    return { daysInMonth, firstDayOfWeek };
  };

  const changeMonth = (delta: number) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + delta);
    setCurrentMonth(newDate);
  };

  // Helper for status colors
  const getRequestStatusColor = (status: string) => {
      switch (status) {
          case 'PENDING': return 'bg-yellow-100 text-yellow-700';
          case 'PROCESSING': return 'bg-orange-100 text-orange-700';
          case 'APPROVED': return 'bg-green-100 text-green-700';
          case 'REJECTED': return 'bg-red-100 text-red-700';
          default: return 'bg-gray-100 text-gray-700';
      }
  };

  // 4. PDF Download Handler
  const handleDownloadPDF = () => {
    const doc = new jsPDF();

    // Header
    doc.setFillColor(37, 99, 235); // Blue header
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text('Daily Time Record', 14, 25);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 32);

    // User Info
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(12);
    doc.text(`Employee Name: ${currentUser.name}`, 14, 50);
    doc.text(`Employee ID: ${currentUser.id}`, 14, 56);
    if(currentUser.jobTitle) {
        doc.text(`Position: ${currentUser.jobTitle}`, 14, 62);
    }

    // Table Data preparation
    const tableRows = sortedTableData.map(day => {
        const timeIn = day.clockIn ? new Date(day.clockIn.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '---';
        
        let location = '---';
        if (day.clockIn?.locationName) {
            location = day.clockIn.locationName;
        } else if (day.clockIn?.location) {
            location = `${day.clockIn.location.lat.toFixed(5)}, ${day.clockIn.location.lng.toFixed(5)}`;
        }

        const timeOut = day.clockOut ? new Date(day.clockOut.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '---';
        
        let notes = day.status;
        if (day.requests.length > 0) {
            notes = `${day.requests.length} Request(s)`;
        }

        return [
            day.dateStr,
            timeIn,
            location,
            timeOut,
            day.duration || '---',
            notes
        ];
    });

    const startY = currentUser.jobTitle ? 70 : 65;

    // AutoTable
    autoTable(doc, {
        startY: startY,
        head: [['Date', 'Time In', 'Location', 'Time Out', 'Hours', 'Status/Notes']],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [37, 99, 235] },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        styles: { fontSize: 8, cellPadding: 2 },
    });

    doc.save(`DTR_${currentUser.id}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const { daysInMonth, firstDayOfWeek } = getDaysInMonth(currentMonth);
  const selectedDayData = dayDataMap[selectedDate.toLocaleDateString()];

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      
      {/* --- HEADER --- */}
      <div className="bg-white p-4 shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
                <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition">
                    <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
                <div>
                    <h2 className="text-lg font-bold text-gray-800">History</h2>
                    <p className="text-xs text-gray-500">ID: {currentUser.id}</p>
                </div>
            </div>
            {/* View Toggle */}
            <div className="flex bg-gray-100 p-1 rounded-lg">
                <button 
                    onClick={() => setViewMode('CALENDAR')}
                    className={`p-2 rounded-md transition-all ${viewMode === 'CALENDAR' ? 'bg-white shadow text-blue-600' : 'text-gray-400'}`}
                    title="Calendar View"
                >
                    <CalendarIcon className="w-5 h-5" />
                </button>
                <button 
                    onClick={() => setViewMode('TABLE')}
                    className={`p-2 rounded-md transition-all ${viewMode === 'TABLE' ? 'bg-white shadow text-blue-600' : 'text-gray-400'}`}
                    title="Table View"
                >
                    <TableIcon className="w-5 h-5" />
                </button>
            </div>
        </div>

        {/* --- CALENDAR VIEW HEADER COMPONENTS --- */}
        {viewMode === 'CALENDAR' && (
            <>
                {/* Month Navigation */}
                <div className="flex items-center justify-between bg-gray-50 p-2 rounded-xl mb-2">
                    <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-white rounded-lg shadow-sm transition">
                        <ChevronLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <div className="font-bold text-gray-800 flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-blue-600" />
                        {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </div>
                    <button onClick={() => changeMonth(1)} className="p-2 hover:bg-white rounded-lg shadow-sm transition">
                        <ChevronRight className="w-5 h-5 text-gray-600" />
                    </button>
                </div>

                {/* Week Days Header */}
                <div className="grid grid-cols-7 text-center mb-2">
                    {['S','M','T','W','T','F','S'].map((d, i) => (
                        <div key={i} className="text-[10px] font-bold text-gray-400">{d}</div>
                    ))}
                </div>
            </>
        )}
      </div>

      {/* --- BODY CONTENT --- */}
      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
        
        {viewMode === 'CALENDAR' ? (
            <div className="p-4">
                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-2 mb-6">
                    {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                        <div key={`empty-${i}`} className="aspect-square"></div>
                    ))}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                        const dayNum = i + 1;
                        const dateObj = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), dayNum);
                        const dateStr = dateObj.toLocaleDateString();
                        const isSelected = selectedDate.toLocaleDateString() === dateStr;
                        const isToday = new Date().toLocaleDateString() === dateStr;
                        const data = dayDataMap[dateStr];
                        
                        let indicatorColor = null;
                        if (data) {
                            if (data.status === 'COMPLETE') indicatorColor = 'bg-green-500';
                            else if (data.status === 'ONGOING') indicatorColor = 'bg-blue-500';
                            else if (data.status === 'MISSED_OUT') indicatorColor = 'bg-red-500';
                        }
                        if (data?.hasRequest) indicatorColor = 'bg-yellow-500';

                        return (
                            <button 
                                key={dayNum}
                                onClick={() => setSelectedDate(dateObj)}
                                className={`
                                    aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all
                                    ${isSelected ? 'bg-blue-600 text-white shadow-lg scale-105 z-10' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-100'}
                                    ${isToday && !isSelected ? 'border-blue-300 border-2' : ''}
                                `}
                            >
                                <span className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-gray-700'}`}>{dayNum}</span>
                                {indicatorColor && (
                                    <div className={`w-1.5 h-1.5 rounded-full mt-1 ${isSelected ? 'bg-white' : indicatorColor}`}></div>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Day Details */}
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <Briefcase className="w-3 h-3" />
                    Details for {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </h3>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4">
                    {!selectedDayData || (!selectedDayData.clockIn && !selectedDayData.clockOut && !selectedDayData.hasRequest) ? (
                        <div className="p-8 text-center text-gray-400 flex flex-col items-center">
                            <CalendarIcon className="w-8 h-8 mb-2 opacity-20" />
                            <span className="text-sm">No activity recorded.</span>
                        </div>
                    ) : (
                        <>
                            <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                                <span className="text-xs font-bold text-gray-500 uppercase">Shift Status</span>
                                <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider 
                                    ${selectedDayData.status === 'COMPLETE' ? 'bg-green-100 text-green-700' : 
                                    selectedDayData.status === 'ONGOING' ? 'bg-blue-100 text-blue-700' : 
                                    selectedDayData.status === 'MISSED_OUT' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                                    {selectedDayData.status === 'MISSED_OUT' ? 'Incomplete' : selectedDayData.status}
                                </span>
                            </div>
                            <div className="p-4 grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1 border-r border-gray-100 pr-2">
                                    <div className="flex items-center gap-1 text-xs text-gray-400 font-bold uppercase">
                                        <Clock className="w-3 h-3" /> Time In
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl font-mono text-gray-800">
                                            {selectedDayData.clockIn ? new Date(selectedDayData.clockIn.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--'}
                                        </span>
                                        {selectedDayData.clockIn?.photo && (
                                            <button 
                                                onClick={() => setPreviewImage(selectedDayData.clockIn?.photo || null)}
                                                className="text-blue-500 hover:text-blue-600 bg-blue-50 p-1 rounded"
                                            >
                                                <ImageIcon className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                    {selectedDayData.clockIn?.locationName ? (
                                        <div className="flex items-center gap-1 text-[10px] text-gray-600 mt-1 font-semibold">
                                            <Building2 className="w-3 h-3 text-blue-500" />
                                            {selectedDayData.clockIn.locationName}
                                        </div>
                                    ) : selectedDayData.clockIn?.location && (
                                        <div className="flex items-center gap-1 text-[10px] text-gray-500 mt-1">
                                            <MapPin className="w-3 h-3" />
                                            {selectedDayData.clockIn.location.lat.toFixed(5)}, {selectedDayData.clockIn.location.lng.toFixed(5)}
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col gap-1 pl-2">
                                    <div className="flex items-center gap-1 text-xs text-gray-400 font-bold uppercase">
                                        <Clock className="w-3 h-3" /> Time Out
                                    </div>
                                    <span className="text-xl font-mono text-gray-800">
                                        {selectedDayData.clockOut ? new Date(selectedDayData.clockOut.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--'}
                                    </span>
                                </div>
                            </div>
                            
                            {/* Requests Section in Daily View */}
                            {selectedDayData.requests.length > 0 && (
                                <div className="p-4 border-t border-gray-100 bg-gray-50">
                                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Requests & Files</h4>
                                    <div className="space-y-2">
                                        {selectedDayData.requests.map(req => (
                                            <div key={req.id} className="bg-white p-2 rounded border border-gray-200 shadow-sm flex justify-between items-center">
                                                <div>
                                                    <div className="text-xs font-bold text-gray-700">{req.category}</div>
                                                    <div className="text-[10px] text-gray-500">{req.category === 'LEAVE' ? req.leaveType : req.category === 'OT' ? `${req.otHours}hrs` : req.correctionType}</div>
                                                </div>
                                                <div className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${getRequestStatusColor(req.status)}`}>
                                                    {req.status}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectedDayData.duration && (
                                <div className="bg-blue-50 px-4 py-3 flex justify-between items-center border-t border-blue-100">
                                    <span className="text-xs text-blue-700 font-medium">Total Hours Worked</span>
                                    <span className="text-sm font-bold text-blue-800 font-mono">{selectedDayData.duration}</span>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        ) : (
            <div className="p-4 flex flex-col h-full">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Full Attendance Records
                    </h3>
                    <button 
                        onClick={handleDownloadPDF}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 px-3 rounded-lg shadow flex items-center gap-2 transition"
                    >
                        <Download className="w-3 h-3" /> Download PDF
                    </button>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-4 py-3">Date</th>
                                    <th className="px-4 py-3">In</th>
                                    <th className="px-4 py-3">Out</th>
                                    <th className="px-4 py-3">Total</th>
                                    <th className="px-4 py-3">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedTableData.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                                            No attendance records found.
                                        </td>
                                    </tr>
                                ) : (
                                    sortedTableData.map((row, idx) => (
                                        <tr key={idx} className="bg-white border-b border-gray-100 hover:bg-gray-50">
                                            <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                                                {new Date(row.rawDate).toLocaleDateString('en-US', {month: 'short', day: '2-digit'})}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-mono">
                                                    {row.clockIn ? new Date(row.clockIn.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--'}
                                                </div>
                                                {row.clockIn?.locationName ? (
                                                     <div className="text-[10px] text-gray-500 flex items-center gap-1 font-semibold">
                                                        <Building2 className="w-2 h-2 text-blue-500" />
                                                        {row.clockIn.locationName}
                                                    </div>
                                                ) : row.clockIn?.location && (
                                                    <div className="text-[10px] text-gray-400 flex items-center gap-1">
                                                        <MapPin className="w-2 h-2" />
                                                        {row.clockIn.location.lat.toFixed(4)}, {row.clockIn.location.lng.toFixed(4)}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 font-mono">
                                                {row.clockOut ? new Date(row.clockOut.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--'}
                                            </td>
                                            <td className="px-4 py-3 font-semibold text-blue-600">
                                                {row.duration || '-'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col gap-1">
                                                 <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase w-fit
                                                    ${row.status === 'COMPLETE' ? 'bg-green-100 text-green-700' : 
                                                    row.status === 'ONGOING' ? 'bg-blue-100 text-blue-700' : 
                                                    row.status === 'MISSED_OUT' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                                                    {row.status === 'MISSED_OUT' ? 'Missed' : row.status}
                                                </span>
                                                {row.requests.map(req => (
                                                    <span key={req.id} className={`text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase w-fit ${getRequestStatusColor(req.status)}`}>
                                                        {req.category}: {req.status}
                                                    </span>
                                                ))}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}

      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
            <button className="absolute top-4 right-4 text-white p-2">
                <X className="w-6 h-6" />
            </button>
            <img src={previewImage} alt="Clock In Verification" className="max-w-full max-h-[80vh] rounded-lg shadow-2xl" />
            <p className="text-white mt-4 text-sm opacity-70">Tap anywhere to close</p>
        </div>
      )}

    </div>
  );
};