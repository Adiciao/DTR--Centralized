import React, { useState, useEffect, useRef } from 'react';
import { User, UserRequest, RequestCategory, AttendanceLog } from '../types';
import { getRequests, updateRequest, getUsers, getLogs } from '../services/db';
import { LogOut, Filter, CheckCircle, XCircle, Clock, AlertCircle, CalendarDays, Briefcase, FileWarning, Bell, X, LayoutDashboard, Users, Activity, MapPin, Search, ShieldAlert } from 'lucide-react';

interface AdminScreenProps {
  currentUser: User;
  onLogout: () => void;
  onSwitchToEmployee: () => void;
}

type AdminTab = 'OVERVIEW' | 'EMPLOYEES' | 'REQUESTS';

export const AdminScreen: React.FC<AdminScreenProps> = ({ currentUser, onLogout, onSwitchToEmployee }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('OVERVIEW');
  
  // Data State
  const [requests, setRequests] = useState<UserRequest[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  
  // Requests View State
  const [categoryTab, setCategoryTab] = useState<RequestCategory>('LEAVE');
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'ALL'>('PENDING');

  // Notification & Security State
  const [notification, setNotification] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const prevPendingRef = useRef(0);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- SECURITY: Auto Logout ---
  const resetLogoutTimer = () => {
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      // Set to 30 minutes (1800000 ms)
      logoutTimerRef.current = setTimeout(() => {
          alert("Session expired due to inactivity.");
          onLogout();
      }, 1800000); 
  };

  useEffect(() => {
    // Attach event listeners for activity
    window.addEventListener('mousemove', resetLogoutTimer);
    window.addEventListener('keypress', resetLogoutTimer);
    window.addEventListener('click', resetLogoutTimer);
    
    resetLogoutTimer(); // Start timer

    return () => {
        if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
        window.removeEventListener('mousemove', resetLogoutTimer);
        window.removeEventListener('keypress', resetLogoutTimer);
        window.removeEventListener('click', resetLogoutTimer);
    };
  }, []);

  // --- DATA LOADING ---
  useEffect(() => {
    loadData(true);
    const interval = setInterval(() => loadData(false), 3000); // Poll every 3s
    return () => clearInterval(interval);
  }, []);

  const loadData = (isInitial = false) => {
    const allRequests = getRequests();
    const allUsers = getUsers();
    const allLogs = getLogs();

    setRequests(allRequests);
    setUsers(allUsers);
    setLogs(allLogs);
    
    // Notification Logic
    const currentPending = allRequests.filter(r => r.status === 'PENDING').length;
    if (!isInitial && currentPending > prevPendingRef.current) {
        setNotification("New Request Received");
        setTimeout(() => setNotification(null), 5000);
    }
    prevPendingRef.current = currentPending;
    setPendingCount(currentPending);
  };

  const handleStatusUpdate = (req: UserRequest, newStatus: 'PROCESSING' | 'APPROVED' | 'REJECTED') => {
    const updated = { ...req, status: newStatus, isRead: false };
    updateRequest(updated);
    loadData();
  };

  // --- HELPERS ---
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'PROCESSING': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'APPROVED': return 'bg-green-100 text-green-800 border-green-200';
      case 'REJECTED': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // --- RENDERERS ---

  const renderOverview = () => {
    // Calculate Live Stats
    const totalStaff = users.filter(u => u.role !== 'ADMIN').length;
    
    // Determine active employees (Clocked In but not Clocked Out today)
    const todayStr = new Date().toDateString();
    
    const employeeStatusMap = users.filter(u => u.role !== 'ADMIN').map(u => {
        const userLogsToday = logs
            .filter(l => l.uid === u.id && new Date(l.timestamp).toDateString() === todayStr)
            .sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()); // Newest first

        const lastLog = userLogsToday[0];
        let status: 'ACTIVE' | 'OUT' | 'ABSENT' = 'ABSENT';
        
        if (lastLog) {
            status = lastLog.type === 'IN' ? 'ACTIVE' : 'OUT';
        }

        return {
            user: u,
            status,
            lastLog
        };
    });

    const activeCount = employeeStatusMap.filter(e => e.status === 'ACTIVE').length;

    return (
        <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center">
                    <div className="bg-blue-100 p-2 rounded-full mb-2">
                        <Users className="w-5 h-5 text-blue-600" />
                    </div>
                    <span className="text-2xl font-bold text-gray-800">{totalStaff}</span>
                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Total Staff</span>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center">
                    <div className="bg-green-100 p-2 rounded-full mb-2">
                        <Activity className="w-5 h-5 text-green-600" />
                    </div>
                    <span className="text-2xl font-bold text-gray-800">{activeCount}</span>
                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">On Duty</span>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center relative overflow-hidden">
                    <div className="bg-yellow-100 p-2 rounded-full mb-2 z-10">
                        <FileWarning className="w-5 h-5 text-yellow-600" />
                    </div>
                    <span className="text-2xl font-bold text-gray-800 z-10">{pendingCount}</span>
                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider z-10">Pending Requests</span>
                    {pendingCount > 0 && <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full animate-ping"></div>}
                </div>
            </div>

            {/* Live Status Board */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-700 flex items-center gap-2 text-sm">
                        <Activity className="w-4 h-4 text-blue-500" /> Real-Time Status
                    </h3>
                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div> Live
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-50/50">
                            <tr>
                                <th className="px-4 py-3">Employee</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Last Activity</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {employeeStatusMap.length === 0 ? (
                                <tr><td colSpan={3} className="p-4 text-center text-gray-400 text-xs">No employees found.</td></tr>
                            ) : (
                                employeeStatusMap.map((item) => (
                                    <tr key={item.user.id} className="hover:bg-gray-50 transition">
                                        <td className="px-4 py-3">
                                            <div className="font-bold text-gray-800">{item.user.name}</div>
                                            <div className="text-[10px] text-gray-500">{item.user.jobTitle || 'Employee'}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            {item.status === 'ACTIVE' && (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-green-100 text-green-700">
                                                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> CLOCKED IN
                                                </span>
                                            )}
                                            {item.status === 'OUT' && (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600">
                                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span> CLOCKED OUT
                                                </span>
                                            )}
                                            {item.status === 'ABSENT' && (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-red-50 text-red-400">
                                                    ABSENT
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {item.lastLog ? (
                                                <div className="flex flex-col">
                                                    <span className="font-mono text-xs text-gray-700">
                                                        {new Date(item.lastLog.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                    </span>
                                                    {item.lastLog.locationName && (
                                                        <span className="text-[10px] text-gray-400 flex items-center gap-1 truncate max-w-[120px]">
                                                            <MapPin className="w-2 h-2" /> {item.lastLog.locationName}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-gray-300 text-xs">--</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
  };

  const renderEmployees = () => {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                <h3 className="font-bold text-gray-700 flex items-center gap-2 text-sm">
                    <Users className="w-4 h-4 text-blue-600" /> Employee Directory
                </h3>
            </div>
            <div className="flex-1 overflow-y-auto">
                 <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                        <tr>
                            <th className="px-4 py-3">Name / ID</th>
                            <th className="px-4 py-3">Role</th>
                            <th className="px-4 py-3">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {users.filter(u => u.role !== 'ADMIN').map(u => (
                            <tr key={u.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3">
                                    <div className="font-bold text-gray-800">{u.name}</div>
                                    <div className="text-[10px] text-gray-400 font-mono">ID: {u.id}</div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="inline-block bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                                        {u.jobTitle || 'Employee'}
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <span className="text-[10px] text-green-600 font-bold flex items-center gap-1">
                                        <CheckCircle className="w-3 h-3" /> Active
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
  };

  const renderRequests = () => {
    const filteredRequests = requests.filter(r => {
        if (r.category !== categoryTab) return false;
        if (statusFilter === 'PENDING') {
            return r.status === 'PENDING' || r.status === 'PROCESSING';
        }
        return true;
    });

    return (
        <div className="flex flex-col h-full">
            {/* Filter Bar */}
            <div className="flex items-center justify-between mb-4 bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
                <div className="flex gap-1">
                     <button 
                        onClick={() => setCategoryTab('LEAVE')}
                        className={`px-3 py-1.5 text-[10px] font-bold rounded transition ${categoryTab === 'LEAVE' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                    >
                        LEAVES
                    </button>
                    <button 
                        onClick={() => setCategoryTab('OT')}
                        className={`px-3 py-1.5 text-[10px] font-bold rounded transition ${categoryTab === 'OT' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                    >
                        OVERTIME
                    </button>
                    <button 
                        onClick={() => setCategoryTab('CORRECTION')}
                        className={`px-3 py-1.5 text-[10px] font-bold rounded transition ${categoryTab === 'CORRECTION' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                    >
                        ISSUES
                    </button>
                </div>
                <div className="flex bg-gray-100 rounded p-0.5">
                    <button 
                        onClick={() => setStatusFilter('PENDING')}
                        className={`px-2 py-1 text-[10px] font-bold rounded transition ${statusFilter === 'PENDING' ? 'bg-white shadow text-gray-800' : 'text-gray-400'}`}
                    >
                        PENDING
                    </button>
                    <button 
                        onClick={() => setStatusFilter('ALL')}
                        className={`px-2 py-1 text-[10px] font-bold rounded transition ${statusFilter === 'ALL' ? 'bg-white shadow text-gray-800' : 'text-gray-400'}`}
                    >
                        ALL
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pb-4">
                {filteredRequests.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                        <CheckCircle className="w-10 h-10 mb-2 opacity-20" />
                        <p className="text-sm">No {statusFilter.toLowerCase()} requests.</p>
                    </div>
                ) : (
                    filteredRequests.map(req => (
                        <div key={req.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${getStatusColor(req.status)}`}>
                                            {req.status}
                                        </span>
                                    </div>
                                    <h3 className="font-bold text-gray-800 mt-1">{req.name}</h3>
                                    <div className="flex items-center gap-2">
                                         <p className="text-xs text-gray-500">ID: {req.uid}</p>
                                         {req.jobTitle && (
                                             <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 rounded uppercase font-bold tracking-tight">{req.jobTitle}</span>
                                         )}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-gray-400">{new Date(req.timestamp).toLocaleDateString()}</p>
                                    <p className="text-[10px] text-gray-300">{new Date(req.timestamp).toLocaleTimeString()}</p>
                                </div>
                            </div>

                            <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-700 mb-3 border border-gray-100">
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                    {req.category === 'LEAVE' && (
                                        <>
                                            <div className="text-xs text-gray-400 uppercase">Type: <span className="text-gray-800 font-bold">{req.leaveType}</span></div>
                                            <div className="text-xs text-gray-400 uppercase">Range: <span className="text-gray-800 font-bold">{new Date(req.startDate!).toLocaleDateString()} - {new Date(req.endDate!).toLocaleDateString()}</span></div>
                                        </>
                                    )}
                                    {req.category === 'OT' && (
                                        <>
                                            <div className="text-xs text-gray-400 uppercase">Date: <span className="text-gray-800 font-bold">{req.otDate}</span></div>
                                            <div className="text-xs text-gray-400 uppercase">Hours: <span className="text-gray-800 font-bold">{req.otHours} hrs</span></div>
                                        </>
                                    )}
                                    {req.category === 'CORRECTION' && (
                                        <div className="col-span-2 text-xs text-gray-400 uppercase">Issue: <span className="text-gray-800 font-bold">{req.correctionType} on {new Date(req.date).toLocaleDateString()}</span></div>
                                    )}
                                </div>
                                <p className="italic text-gray-600 bg-white p-2 rounded border border-gray-100">"{req.reason}"</p>
                            </div>

                            <div className="flex gap-2">
                                {req.status === 'PENDING' && (
                                    <button 
                                        onClick={() => handleStatusUpdate(req, 'PROCESSING')}
                                        className="flex-1 bg-orange-100 hover:bg-orange-200 text-orange-700 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1"
                                    >
                                        <Clock className="w-3 h-3" /> PROCESS
                                    </button>
                                )}
                                {(req.status === 'PENDING' || req.status === 'PROCESSING') && (
                                    <>
                                        <button 
                                            onClick={() => handleStatusUpdate(req, 'APPROVED')}
                                            className="flex-1 bg-green-100 hover:bg-green-200 text-green-700 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1"
                                        >
                                            <CheckCircle className="w-3 h-3" /> APPROVE
                                        </button>
                                        <button 
                                            onClick={() => handleStatusUpdate(req, 'REJECTED')}
                                            className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1"
                                        >
                                            <XCircle className="w-3 h-3" /> DENY
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-100 relative">
      {/* Toast Notification */}
      {notification && (
        <div className="absolute top-4 left-4 right-4 z-50 animate-slide-in">
            <div className="bg-slate-800 text-white p-4 rounded-xl shadow-2xl flex items-center justify-between border-l-4 border-yellow-500">
                <div className="flex items-center gap-3">
                    <div className="bg-yellow-500 p-2 rounded-full">
                        <Bell className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <p className="font-bold text-sm">New Alert</p>
                        <p className="text-xs text-slate-300">{notification}</p>
                    </div>
                </div>
                <button onClick={() => setNotification(null)}>
                    <X className="w-5 h-5 text-slate-400 hover:text-white" />
                </button>
            </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-slate-800 text-white rounded-t-2xl shadow-md flex-none">
        <div className="p-6 pb-4">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5 text-yellow-500" />
                        Admin Portal
                    </h1>
                    <p className="text-slate-400 text-xs mt-1">Logged in as {currentUser.name}</p>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={onSwitchToEmployee}
                        className="relative p-2 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition"
                        title="Switch to Personal Dashboard"
                    >
                        <LayoutDashboard className="w-4 h-4 text-white" />
                    </button>
                    <button onClick={onLogout} className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg transition flex items-center gap-1 h-full">
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-4 border-b border-slate-600">
                <button 
                    onClick={() => setActiveTab('OVERVIEW')}
                    className={`pb-2 text-sm font-bold transition border-b-2 ${activeTab === 'OVERVIEW' ? 'text-white border-blue-500' : 'text-slate-400 border-transparent hover:text-slate-200'}`}
                >
                    Dashboard
                </button>
                <button 
                    onClick={() => setActiveTab('EMPLOYEES')}
                    className={`pb-2 text-sm font-bold transition border-b-2 ${activeTab === 'EMPLOYEES' ? 'text-white border-blue-500' : 'text-slate-400 border-transparent hover:text-slate-200'}`}
                >
                    Employees
                </button>
                <button 
                    onClick={() => setActiveTab('REQUESTS')}
                    className={`pb-2 text-sm font-bold transition border-b-2 ${activeTab === 'REQUESTS' ? 'text-white border-blue-500' : 'text-slate-400 border-transparent hover:text-slate-200'}`}
                >
                    Requests
                    {pendingCount > 0 && <span className="ml-2 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">{pendingCount}</span>}
                </button>
            </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-4 flex-1 overflow-hidden flex flex-col">
        {activeTab === 'OVERVIEW' && renderOverview()}
        {activeTab === 'EMPLOYEES' && renderEmployees()}
        {activeTab === 'REQUESTS' && renderRequests()}
      </div>
    </div>
  );
};