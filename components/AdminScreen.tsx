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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center hover:shadow-md transition">
                    <div className="bg-blue-100 p-3 rounded-full mb-2">
                        <Users className="w-6 h-6 text-blue-600" />
                    </div>
                    <span className="text-3xl font-bold text-gray-800">{totalStaff}</span>
                    <span className="text-xs uppercase font-bold text-gray-400 tracking-wider">Total Staff</span>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center hover:shadow-md transition">
                    <div className="bg-green-100 p-3 rounded-full mb-2">
                        <Activity className="w-6 h-6 text-green-600" />
                    </div>
                    <span className="text-3xl font-bold text-gray-800">{activeCount}</span>
                    <span className="text-xs uppercase font-bold text-gray-400 tracking-wider">On Duty</span>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center relative overflow-hidden hover:shadow-md transition">
                    <div className="bg-yellow-100 p-3 rounded-full mb-2 z-10">
                        <FileWarning className="w-6 h-6 text-yellow-600" />
                    </div>
                    <span className="text-3xl font-bold text-gray-800 z-10">{pendingCount}</span>
                    <span className="text-xs uppercase font-bold text-gray-400 tracking-wider z-10">Pending Requests</span>
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
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div> Live Monitor
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-50/50">
                            <tr>
                                <th className="px-6 py-4">Employee</th>
                                <th className="px-6 py-4">Role</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Last Activity</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {employeeStatusMap.length === 0 ? (
                                <tr><td colSpan={4} className="p-4 text-center text-gray-400 text-xs">No employees found.</td></tr>
                            ) : (
                                employeeStatusMap.map((item) => (
                                    <tr key={item.user.id} className="hover:bg-gray-50 transition">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-800">{item.user.name}</div>
                                            <div className="text-xs text-gray-400 font-mono">ID: {item.user.id}</div>
                                        </td>
                                        <td className="px-6 py-4 text-xs text-gray-600 uppercase font-semibold">
                                            {item.user.jobTitle || 'Employee'}
                                        </td>
                                        <td className="px-6 py-4">
                                            {item.status === 'ACTIVE' && (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                                                    <span className="w-2 h-2 bg-green-500 rounded-full"></span> CLOCKED IN
                                                </span>
                                            )}
                                            {item.status === 'OUT' && (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">
                                                    <span className="w-2 h-2 bg-gray-400 rounded-full"></span> CLOCKED OUT
                                                </span>
                                            )}
                                            {item.status === 'ABSENT' && (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-400">
                                                    <span className="w-2 h-2 bg-red-300 rounded-full"></span> ABSENT
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {item.lastLog ? (
                                                <div className="flex flex-col">
                                                    <span className="font-mono text-xs text-gray-700">
                                                        {new Date(item.lastLog.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                    </span>
                                                    {item.lastLog.locationName && (
                                                        <span className="text-[10px] text-gray-400 flex items-center gap-1 truncate max-w-[200px]">
                                                            <MapPin className="w-3 h-3" /> {item.lastLog.locationName}
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
                <div className="relative">
                    <input type="text" placeholder="Search..." className="pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-48" />
                    <Search className="w-3 h-3 text-gray-400 absolute left-2.5 top-2" />
                </div>
            </div>
            <div className="flex-1 overflow-y-auto">
                 <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                        <tr>
                            <th className="px-6 py-4">Name / ID</th>
                            <th className="px-6 py-4">Role</th>
                            <th className="px-6 py-4">Department</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {users.filter(u => u.role !== 'ADMIN').map(u => (
                            <tr key={u.id} className="hover:bg-gray-50 transition">
                                <td className="px-6 py-4">
                                    <div className="font-bold text-gray-800">{u.name}</div>
                                    <div className="text-xs text-gray-400 font-mono">ID: {u.id}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="inline-block bg-blue-50 text-blue-700 px-2.5 py-1 rounded text-xs font-bold uppercase">
                                        {u.jobTitle || 'Employee'}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-gray-500 text-xs">
                                    Operations
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-xs text-green-600 font-bold flex items-center gap-1.5">
                                        <CheckCircle className="w-3.5 h-3.5" /> Active
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button className="text-blue-600 hover:underline text-xs font-semibold">Edit</button>
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
            <div className="flex items-center justify-between mb-4 bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex gap-2">
                     <button 
                        onClick={() => setCategoryTab('LEAVE')}
                        className={`px-4 py-2 text-xs font-bold rounded-lg transition ${categoryTab === 'LEAVE' ? 'bg-blue-600 text-white shadow' : 'text-gray-500 hover:bg-gray-100'}`}
                    >
                        LEAVE APPLICATIONS
                    </button>
                    <button 
                        onClick={() => setCategoryTab('OT')}
                        className={`px-4 py-2 text-xs font-bold rounded-lg transition ${categoryTab === 'OT' ? 'bg-blue-600 text-white shadow' : 'text-gray-500 hover:bg-gray-100'}`}
                    >
                        OVERTIME
                    </button>
                    <button 
                        onClick={() => setCategoryTab('CORRECTION')}
                        className={`px-4 py-2 text-xs font-bold rounded-lg transition ${categoryTab === 'CORRECTION' ? 'bg-blue-600 text-white shadow' : 'text-gray-500 hover:bg-gray-100'}`}
                    >
                        TIME CORRECTIONS
                    </button>
                </div>
                <div className="flex bg-gray-100 rounded-lg p-1">
                    <button 
                        onClick={() => setStatusFilter('PENDING')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${statusFilter === 'PENDING' ? 'bg-white shadow text-gray-800' : 'text-gray-400'}`}
                    >
                        Pending
                    </button>
                    <button 
                        onClick={() => setStatusFilter('ALL')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${statusFilter === 'ALL' ? 'bg-white shadow text-gray-800' : 'text-gray-400'}`}
                    >
                        All History
                    </button>
                </div>
            </div>

            {/* Desktop Table View */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                <div className="overflow-auto custom-scrollbar flex-1">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4 font-bold text-gray-600">Employee Details</th>
                                <th className="px-6 py-4 font-bold text-gray-600">Request Type</th>
                                <th className="px-6 py-4 font-bold text-gray-600">Description/Reason</th>
                                <th className="px-6 py-4 font-bold text-gray-600">Date/Time</th>
                                <th className="px-6 py-4 font-bold text-gray-600 text-center">Status</th>
                                <th className="px-6 py-4 font-bold text-gray-600 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredRequests.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-10 text-center text-gray-400 flex flex-col items-center justify-center w-full">
                                        <CheckCircle className="w-12 h-12 mb-3 opacity-20" />
                                        <p className="text-sm">No {statusFilter.toLowerCase()} requests found.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredRequests.map(req => (
                                    <tr key={req.id} className="hover:bg-gray-50 transition">
                                        {/* Employee */}
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-800">{req.name}</div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-xs text-gray-400 font-mono">ID: {req.uid}</span>
                                                {req.jobTitle && (
                                                    <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 rounded uppercase font-bold tracking-tight">{req.jobTitle}</span>
                                                )}
                                            </div>
                                        </td>
                                        
                                        {/* Type */}
                                        <td className="px-6 py-4">
                                             {req.category === 'LEAVE' && (
                                                 <div className="text-sm font-semibold text-gray-700">{req.leaveType}</div>
                                             )}
                                             {req.category === 'OT' && (
                                                 <div className="text-sm font-semibold text-gray-700">{req.otHours} hrs Overtime</div>
                                             )}
                                             {req.category === 'CORRECTION' && (
                                                 <div className="text-sm font-semibold text-gray-700">{req.correctionType}</div>
                                             )}
                                        </td>

                                        {/* Reason */}
                                        <td className="px-6 py-4 max-w-xs">
                                            <p className="text-sm text-gray-600 italic truncate" title={req.reason}>"{req.reason}"</p>
                                        </td>

                                        {/* Date */}
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-gray-800">
                                                {req.category === 'LEAVE' ? `${new Date(req.startDate!).toLocaleDateString()} - ${new Date(req.endDate!).toLocaleDateString()}` : 
                                                 req.category === 'OT' ? new Date(req.otDate!).toLocaleDateString() : 
                                                 new Date(req.date).toLocaleDateString()}
                                            </div>
                                            <div className="text-xs text-gray-400">{new Date(req.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                                        </td>

                                        {/* Status */}
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-block text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase ${getStatusColor(req.status)}`}>
                                                {req.status}
                                            </span>
                                        </td>

                                        {/* Actions */}
                                        <td className="px-6 py-4">
                                            <div className="flex justify-center gap-2">
                                                {req.status === 'PENDING' && (
                                                    <button 
                                                        onClick={() => handleStatusUpdate(req, 'PROCESSING')}
                                                        className="p-2 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-lg transition"
                                                        title="Mark as Processing"
                                                    >
                                                        <Clock className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {(req.status === 'PENDING' || req.status === 'PROCESSING') && (
                                                    <>
                                                        <button 
                                                            onClick={() => handleStatusUpdate(req, 'APPROVED')}
                                                            className="p-2 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg transition"
                                                            title="Approve"
                                                        >
                                                            <CheckCircle className="w-4 h-4" />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleStatusUpdate(req, 'REJECTED')}
                                                            className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition"
                                                            title="Reject"
                                                        >
                                                            <XCircle className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}
                                                {req.status !== 'PENDING' && req.status !== 'PROCESSING' && (
                                                    <span className="text-gray-300 text-xs">-</span>
                                                )}
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
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-100 relative">
      {/* Toast Notification */}
      {notification && (
        <div className="absolute top-4 right-4 z-50 animate-slide-in">
            <div className="bg-slate-800 text-white p-4 rounded-xl shadow-2xl flex items-center gap-4 border-l-4 border-yellow-500 min-w-[300px]">
                <div className="bg-yellow-500 p-2 rounded-full">
                    <Bell className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                    <p className="font-bold text-sm">System Notification</p>
                    <p className="text-xs text-slate-300">{notification}</p>
                </div>
                <button onClick={() => setNotification(null)}>
                    <X className="w-4 h-4 text-slate-400 hover:text-white" />
                </button>
            </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-slate-800 text-white shadow-md flex-none">
        <div className="px-8 py-4">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <div className="bg-slate-700 p-2 rounded-lg">
                        <ShieldAlert className="w-6 h-6 text-yellow-500" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold leading-tight">Admin Portal</h1>
                        <p className="text-slate-400 text-xs">Logged in as {currentUser.name}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={onSwitchToEmployee}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition text-xs font-bold"
                        title="Switch to Personal Dashboard"
                    >
                        <LayoutDashboard className="w-4 h-4 text-white" />
                        <span className="hidden sm:inline">Employee View</span>
                    </button>
                    <div className="h-8 w-px bg-slate-600 mx-2"></div>
                    <button onClick={onLogout} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition text-xs font-bold">
                        <LogOut className="w-4 h-4" />
                        Logout
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-8">
                <button 
                    onClick={() => setActiveTab('OVERVIEW')}
                    className={`pb-3 text-sm font-bold transition border-b-2 flex items-center gap-2 ${activeTab === 'OVERVIEW' ? 'text-white border-blue-500' : 'text-slate-400 border-transparent hover:text-slate-200'}`}
                >
                    <LayoutDashboard className="w-4 h-4" />
                    Dashboard
                </button>
                <button 
                    onClick={() => setActiveTab('EMPLOYEES')}
                    className={`pb-3 text-sm font-bold transition border-b-2 flex items-center gap-2 ${activeTab === 'EMPLOYEES' ? 'text-white border-blue-500' : 'text-slate-400 border-transparent hover:text-slate-200'}`}
                >
                    <Users className="w-4 h-4" />
                    Employees
                </button>
                <button 
                    onClick={() => setActiveTab('REQUESTS')}
                    className={`pb-3 text-sm font-bold transition border-b-2 flex items-center gap-2 ${activeTab === 'REQUESTS' ? 'text-white border-blue-500' : 'text-slate-400 border-transparent hover:text-slate-200'}`}
                >
                    <FileWarning className="w-4 h-4" />
                    Requests & Approvals
                    {pendingCount > 0 && <span className="ml-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{pendingCount}</span>}
                </button>
            </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-8 flex-1 overflow-hidden flex flex-col max-w-[1600px] w-full mx-auto">
        {activeTab === 'OVERVIEW' && renderOverview()}
        {activeTab === 'EMPLOYEES' && renderEmployees()}
        {activeTab === 'REQUESTS' && renderRequests()}
      </div>
    </div>
  );
};