
import React, { useState, useEffect, useRef } from 'react';
import { User, UserRequest, RequestCategory, AttendanceLog, JobTitle, SystemSettings, Geofence, Shift, Holiday, LeaveType, Message } from '../types';
import { getRequests, updateRequest, getUsers, getLogs, addUser, updateUser, deleteUser, exportDatabase, importDatabase, getSettings, updateSettings, DEFAULT_SETTINGS, addMessage, getMessages } from '../services/db';
import { LogOut, CheckCircle, XCircle, Clock, FileWarning, Bell, X, Users, Activity, ShieldAlert, UserPlus, Edit, Trash2, Save, Download, Upload, Loader2, Search, Filter, MapPin, Calendar, Eye, FileText, Camera, Briefcase, ArrowLeft, ExternalLink, FileDown, Settings, Plus, Globe, Smartphone, Coffee, CalendarDays, KeyRound, EyeOff, MessageSquare, Send } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface AdminScreenProps {
  currentUser: User;
  onLogout: () => void;
  onSwitchToEmployee: () => void;
}

type AdminTab = 'OVERVIEW' | 'EMPLOYEES' | 'DTR_LOGS' | 'REQUESTS' | 'SYSTEM' | 'LEAVE' | 'COMMUNICATIONS';

export const AdminScreen: React.FC<AdminScreenProps> = ({ currentUser, onLogout, onSwitchToEmployee }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('OVERVIEW');
  const [requests, setRequests] = useState<UserRequest[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  // Drill-down State
  const [viewingEmployee, setViewingEmployee] = useState<User | null>(null);

  // Modals
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  // Settings sub-states
  const [configSection, setConfigSection] = useState<'GENERAL' | 'GEOFENCES' | 'SHIFTS' | 'HOLIDAYS'>('GENERAL');

  // Messaging sub-states
  const [msgSubject, setMsgSubject] = useState('');
  const [msgContent, setMsgContent] = useState('');
  const [msgRecipient, setMsgRecipient] = useState('ALL');

  // Filters for DTR Logs
  const [dtrSearch, setDtrSearch] = useState('');
  const [dtrDateFilter, setDtrDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [dtrTypeFilter, setDtrTypeFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  
  const [categoryTab, setCategoryTab] = useState<RequestCategory>('LEAVE');
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'ALL'>('PENDING');

  // Form State for User Registry
  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formPassword, setFormPassword] = useState('admin123');
  const [formJobTitle, setFormJobTitle] = useState<JobTitle>('Programmer');
  const [formRole, setFormRole] = useState<'EMPLOYEE' | 'ADMIN'>('EMPLOYEE');
  const [showFormPassword, setShowFormPassword] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  const loadData = async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const [allRequests, allUsers, allLogs, allSettings, allMsgs] = await Promise.all([
        getRequests(),
        getUsers(),
        getLogs(),
        getSettings(),
        getMessages()
      ]);
      setRequests(allRequests);
      setUsers(allUsers);
      setLogs(allLogs);
      setSettings(allSettings);
      setMessages(allMsgs);
      setPendingCount(allRequests.filter(r => r.status === 'PENDING').length);
    } catch (e) { console.error(e); }
    finally { if (isInitial) setLoading(false); }
  };

  useEffect(() => {
    loadData(true);
    const interval = setInterval(() => loadData(false), 15000);
    return () => clearInterval(interval);
  }, []);

  const handleStatusUpdate = async (req: UserRequest, newStatus: 'PROCESSING' | 'APPROVED' | 'REJECTED') => {
    const updated = { ...req, status: newStatus, isRead: false };
    await updateRequest(updated);
    if (newStatus === 'APPROVED' && req.category === 'LEAVE') {
        const user = users.find(u => u.id === req.uid);
        if (user && user.leaveBalances && req.leaveType) {
            const start = new Date(req.startDate!);
            const end = new Date(req.endDate!);
            const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;
            const updatedUser = {
                ...user,
                leaveBalances: {
                    ...user.leaveBalances,
                    [req.leaveType]: Math.max(0, (user.leaveBalances[req.leaveType] || 0) - diffDays)
                }
            };
            await updateUser(updatedUser);
        }
    }
    loadData();
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgSubject || !msgContent) return;

    const newMsg: Message = {
      id: Date.now().toString(),
      fromId: currentUser.id,
      fromName: currentUser.name,
      toId: msgRecipient,
      subject: msgSubject,
      content: msgContent,
      timestamp: new Date().toISOString(),
      isRead: false
    };

    await addMessage(newMsg);
    setMsgSubject('');
    setMsgContent('');
    setNotification("Communication sent successfully.");
    loadData();
  };

  const handleUpdateBalance = async (user: User, type: LeaveType, amount: number) => {
      const updatedUser = {
          ...user,
          leaveBalances: {
              ...(user.leaveBalances || {}),
              [type]: amount
          } as any
      };
      await updateUser(updatedUser);
      setViewingEmployee(updatedUser);
      loadData();
  };

  const saveSettings = async (newSettings: SystemSettings) => {
      setSettings(newSettings);
      await updateSettings(newSettings);
      setNotification("System settings updated.");
      setTimeout(() => setNotification(null), 3000);
  };

  const handleDownloadDTRReport = (filteredLogs: AttendanceLog[]) => {
    const doc = new jsPDF();
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text('DTR Attendance Report', 14, 25);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 33);
    const rows = filteredLogs.map(log => [
        log.name, log.uid, log.type, 
        new Date(log.timestamp).toLocaleDateString(), 
        new Date(log.timestamp).toLocaleTimeString(), 
        log.locationName || 'N/A'
    ]);
    autoTable(doc, {
      startY: 50,
      head: [['Name', 'ID', 'Type', 'Date', 'Time', 'Location']],
      body: rows,
      headStyles: { fillColor: [37, 99, 235] }
    });
    doc.save(`Attendance_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleDownloadEmployeeDossier = (user: User, userLogs: AttendanceLog[]) => {
    const doc = new jsPDF();
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text('Employee Dossier', 14, 25);
    doc.setFontSize(10);
    doc.text(`Name: ${user.name} | ID: ${user.id} | Position: ${user.jobTitle}`, 14, 33);
    const rows = userLogs.map(log => [
        new Date(log.timestamp).toLocaleDateString(),
        log.type,
        new Date(log.timestamp).toLocaleTimeString(),
        log.locationName || 'N/A'
    ]);
    autoTable(doc, {
        startY: 50,
        head: [['Date', 'Type', 'Time', 'Location']],
        body: rows,
        headStyles: { fillColor: [37, 99, 235] }
    });
    doc.save(`Dossier_${user.id}.pdf`);
  };

  const handleBackup = async () => { await exportDatabase(); };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const res = await importDatabase(file);
        if (res.success) {
            setNotification("Database restored successfully.");
            loadData();
        } else { alert(res.message); }
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formId.trim() || !formName.trim() || !formPassword.trim()) {
        alert("Please fill in all required fields.");
        return;
    }

    const userData: User = {
        id: formId.trim().toUpperCase(),
        name: formName.trim(),
        jobTitle: formJobTitle,
        role: formRole,
        isDefaultPass: !editingUser || (editingUser && formPassword !== editingUser.password),
        password: formPassword.trim(),
        leaveBalances: editingUser?.leaveBalances || { SICK: 10, VACATION: 12, MATERNITY: 0, EMERGENCY: 5, OTHER: 0 }
    };
    
    if (editingUser) await updateUser(userData);
    else await addUser(userData);
    
    setShowUserModal(false);
    loadData();
  };

  // --- RENDER FUNCTIONS ---

  const renderOverview = () => {
    const totalStaff = users.filter(u => u.role !== 'ADMIN').length;
    const activeNow = users.filter(u => {
        const userLogs = logs.filter(l => l.uid === u.id && new Date(l.timestamp).toDateString() === new Date().toDateString()).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return userLogs[0]?.type === 'IN';
    }).length;

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Total Staff', val: totalStaff, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'Active Now', val: activeNow, icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'Pending Reqs', val: pendingCount, icon: FileWarning, color: 'text-amber-600', bg: 'bg-amber-50' },
                    { label: 'Sites Tracked', val: settings.geofences.length, icon: Globe, color: 'text-indigo-600', bg: 'bg-indigo-50' }
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 flex flex-col items-center justify-center gap-1 transition-all hover:scale-[1.02] cursor-default">
                        <div className={`${stat.bg} p-5 rounded-3xl mb-2`}><stat.icon className={`w-10 h-10 ${stat.color}`} /></div>
                        <span className="text-4xl font-black text-slate-800 tracking-tighter">{stat.val}</span>
                        <span className="text-[11px] uppercase font-black text-slate-400 tracking-[0.2em]">{stat.label}</span>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-[32px] shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[500px]">
                    <div className="p-8 border-b bg-slate-50/50 flex justify-between items-center shrink-0">
                        <h3 className="font-black text-slate-800 text-sm tracking-tight flex items-center gap-2"><Activity className="w-5 h-5 text-emerald-500" /> Recent Arrivals</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left text-sm">
                            <tbody className="divide-y divide-slate-100">
                                {logs.filter(l => l.type === 'IN').slice(0, 15).map((log, idx) => {
                                    const u = users.find(user => user.id === log.uid);
                                    return (
                                        <tr key={idx} className="hover:bg-slate-50 transition cursor-pointer" onClick={() => u && setViewingEmployee(u)}>
                                            <td className="px-8 py-5">
                                                <div className="font-black text-slate-800 tracking-tight text-base">{log.name}</div>
                                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Clocked in at {new Date(log.timestamp).toLocaleTimeString()}</div>
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <div className="text-xs font-black text-slate-500 flex items-center justify-end gap-2"><MapPin className="w-4 h-4 text-blue-500"/> {log.locationName}</div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-slate-900 rounded-[32px] shadow-xl p-10 flex flex-col justify-between text-white relative overflow-hidden h-[500px]">
                    <div className="relative z-10">
                        <h3 className="text-3xl font-black tracking-tight leading-tight">System Backup</h3>
                        <p className="text-slate-400 text-sm mt-4 leading-relaxed">Secure all organizational records including logs, geofences, and personnel credentials with a localized encrypted backup.</p>
                    </div>
                    <div className="space-y-4 relative z-10">
                        <button onClick={handleBackup} className="w-full bg-white/10 hover:bg-white/20 text-white font-black py-5 rounded-2xl transition flex items-center justify-center gap-3 uppercase text-[11px] tracking-widest"><Download className="w-5 h-5"/> Export Data</button>
                        <button onClick={() => fileInputRef.current?.click()} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl transition flex items-center justify-center gap-3 uppercase text-[11px] tracking-widest"><Upload className="w-5 h-5"/> Restore Registry</button>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
                    </div>
                    <div className="absolute -top-10 -right-10 w-64 h-64 bg-blue-600/10 rounded-full blur-[80px]"></div>
                </div>
            </div>
        </div>
    );
  };

  const renderCommunications = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in pb-12">
        <div className="bg-white rounded-[40px] p-10 border border-slate-200 shadow-sm">
            <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-8 flex items-center gap-3"><Send className="w-6 h-6 text-blue-600" /> Outbound Portal</h3>
            <form onSubmit={handleSendMessage} className="space-y-6">
                <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Recipient</label>
                    <select 
                        value={msgRecipient}
                        onChange={e => setMsgRecipient(e.target.value)}
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700 shadow-inner"
                    >
                        <option value="ALL">Everyone (Broadcast)</option>
                        {users.filter(u => u.role !== 'ADMIN').map(u => (
                            <option key={u.id} value={u.id}>{u.name} (ID: {u.id})</option>
                        ))}
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Subject</label>
                    <input 
                        type="text"
                        value={msgSubject}
                        onChange={e => setMsgSubject(e.target.value)}
                        placeholder="Urgent: System Maintenance..."
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700 shadow-inner"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Message Content</label>
                    <textarea 
                        value={msgContent}
                        onChange={e => setMsgContent(e.target.value)}
                        placeholder="Type your formal memo here..."
                        className="w-full p-6 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-medium text-slate-700 shadow-inner min-h-[200px]"
                    />
                </div>
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 transition shadow-lg shadow-blue-200">
                    <Send className="w-5 h-5" /> Dispatch Message
                </button>
            </form>
        </div>

        <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[700px]">
            <div className="p-8 border-b bg-slate-50/50 flex justify-between items-center shrink-0">
                <h3 className="font-black text-slate-800 text-lg tracking-tight">Sent Archives</h3>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{messages.length} Records</span>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="divide-y divide-slate-100">
                    {messages.length === 0 ? (
                        <div className="p-20 text-center text-slate-400">
                            <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-10" />
                            <p className="text-[11px] font-black uppercase tracking-widest">No sent messages yet</p>
                        </div>
                    ) : (
                        messages.map(m => (
                            <div key={m.id} className="p-8 hover:bg-slate-50 transition cursor-default">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">To: {m.toId === 'ALL' ? 'Everyone' : m.toId}</span>
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-bold">{new Date(m.timestamp).toLocaleString()}</span>
                                </div>
                                <h4 className="font-black text-slate-800 text-lg mb-2">{m.subject}</h4>
                                <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed italic">"{m.content}"</p>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    </div>
  );

  const renderEmployees = () => (
    <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden flex flex-col animate-fade-in min-h-[600px] mb-12">
        <div className="p-8 border-b bg-slate-50/50 flex justify-between items-center shrink-0">
            <h3 className="font-black text-slate-800 text-lg tracking-tight">Staff Registry</h3>
            <button onClick={() => {
                setEditingUser(null);
                setFormId(''); setFormName(''); setFormPassword('admin123'); setFormJobTitle('Programmer'); setFormRole('EMPLOYEE');
                setShowUserModal(true);
            }} className="bg-blue-600 text-white px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2 transition active:scale-95 shadow-lg shadow-blue-600/20"><UserPlus className="w-5 h-5"/> Add Personnel</button>
        </div>
        <div className="flex-1">
            <table className="w-full text-left">
                <thead className="bg-slate-50 sticky top-0 z-10 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                    <tr><th className="px-10 py-5">Employee</th><th className="px-10 py-5">Role</th><th className="px-10 py-5 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {users.map(u => (
                        <tr key={u.id} className="hover:bg-slate-50 transition cursor-pointer group" onClick={() => setViewingEmployee(u)}>
                            <td className="px-10 py-6">
                                <div className="font-black text-slate-800 text-base tracking-tight group-hover:text-blue-600 transition-colors">{u.name}</div>
                                <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">{u.jobTitle} • ID {u.id}</div>
                            </td>
                            <td className="px-10 py-6">
                                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg ${u.role === 'ADMIN' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{u.role}</span>
                            </td>
                            <td className="px-10 py-6 text-right">
                                <div className="flex justify-end gap-3" onClick={e => e.stopPropagation()}>
                                    <button onClick={() => { 
                                        setEditingUser(u); 
                                        setFormId(u.id); 
                                        setFormName(u.name); 
                                        setFormPassword(u.password || ''); 
                                        setFormJobTitle(u.jobTitle || 'Programmer'); 
                                        setFormRole(u.role || 'EMPLOYEE'); 
                                        setShowUserModal(true); 
                                    }} className="p-3 text-slate-400 hover:text-blue-600 transition hover:bg-blue-50 rounded-xl"><Edit className="w-5 h-5"/></button>
                                    <button onClick={async () => { if (confirm(`Delete ${u.name}?`)) { await deleteUser(u.id); loadData(); } }} className="p-3 text-slate-400 hover:text-rose-600 transition hover:bg-rose-50 rounded-xl"><Trash2 className="w-5 h-5"/></button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
  );

  const renderDTRLogs = () => {
    const filtered = logs.filter(l => {
        const matchesSearch = l.name.toLowerCase().includes(dtrSearch.toLowerCase()) || l.uid.toLowerCase().includes(dtrSearch.toLowerCase());
        const matchesDate = !dtrDateFilter || new Date(l.timestamp).toISOString().split('T')[0] === dtrDateFilter;
        const matchesType = dtrTypeFilter === 'ALL' || l.type === dtrTypeFilter;
        return matchesSearch && matchesDate && matchesType;
    });

    return (
        <div className="flex flex-col animate-fade-in gap-6 pb-12">
            <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm flex flex-wrap items-center gap-6 shrink-0">
                <div className="flex-1 min-w-[300px] relative">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input type="text" placeholder="Search by name or ID..." className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-base focus:ring-4 focus:ring-blue-500/10 outline-none font-bold shadow-inner" value={dtrSearch} onChange={e => setDtrSearch(e.target.value)} />
                </div>
                <input type="date" className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-base font-bold outline-none shadow-inner" value={dtrDateFilter} onChange={e => setDtrDateFilter(e.target.value)} />
                <button onClick={() => handleDownloadDTRReport(filtered)} className="bg-slate-900 text-white px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center gap-3 hover:bg-black transition shadow-lg shadow-slate-900/20"><FileDown className="w-5 h-5"/> Export PDF</button>
            </div>

            <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden min-h-[600px]">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 sticky top-0 z-10 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                        <tr><th className="px-10 py-5">Employee</th><th className="px-10 py-5">Type</th><th className="px-10 py-5">Time</th><th className="px-10 py-5 text-right">Verification</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filtered.map((log, idx) => {
                            const u = users.find(user => user.id === log.uid);
                            return (
                                <tr key={idx} className="hover:bg-slate-50 transition cursor-pointer group" onClick={() => u && setViewingEmployee(u)}>
                                    <td className="px-10 py-6">
                                        <div className="font-black text-slate-800 text-base tracking-tight group-hover:text-blue-600 transition-colors">{log.name}</div>
                                        <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">ID {log.uid}</div>
                                    </td>
                                    <td className="px-10 py-6">
                                        <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg ${log.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{log.type}</span>
                                    </td>
                                    <td className="px-10 py-6">
                                        <div className="text-base font-bold text-slate-700">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                        <div className="text-[11px] text-slate-400 font-bold">{new Date(log.timestamp).toLocaleDateString()}</div>
                                    </td>
                                    <td className="px-10 py-6 text-right">
                                        <div className="flex items-center justify-end gap-4" onClick={e => e.stopPropagation()}>
                                            {log.photo && <button onClick={() => setPreviewImage(log.photo!)} className="p-3 bg-slate-100 hover:bg-slate-200 rounded-xl transition"><Camera className="w-5 h-5 text-slate-600"/></button>}
                                            <div className="text-xs font-bold text-slate-500 flex items-center gap-2"><MapPin className="w-4 h-4 text-blue-500"/> {log.locationName || 'N/A'}</div>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
  };

  const renderRequests = () => {
    const filtered = requests.filter(r => r.category === categoryTab && (statusFilter === 'ALL' || r.status === statusFilter));
    return (
        <div className="flex flex-col animate-fade-in gap-6 pb-12">
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex gap-3 overflow-x-auto hide-scrollbar shrink-0">
                {(['LEAVE', 'OT', 'CORRECTION'] as RequestCategory[]).map(cat => (
                    <button key={cat} onClick={() => setCategoryTab(cat)} className={`flex-1 py-4 px-8 rounded-xl text-[11px] font-black tracking-widest uppercase transition-all whitespace-nowrap ${categoryTab === cat ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>{cat}</button>
                ))}
            </div>

            <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden min-h-[600px]">
                <div className="p-8 border-b bg-slate-50/50 flex justify-between items-center shrink-0">
                    <h3 className="font-black text-slate-800 text-lg tracking-tight">{categoryTab} Management</h3>
                    <select className="bg-slate-100 border border-slate-200 p-3 rounded-xl outline-none font-bold text-blue-600 text-xs shadow-inner" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
                        <option value="PENDING">Pending Only</option>
                        <option value="ALL">All Statuses</option>
                    </select>
                </div>
                <div>
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 sticky top-0 z-10 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                            <tr><th className="px-10 py-5">Applicant</th><th className="px-10 py-5">Details</th><th className="px-10 py-5 text-right">Action</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filtered.map(req => {
                                const u = users.find(user => user.id === req.uid);
                                return (
                                    <tr key={req.id} className="hover:bg-slate-50 transition cursor-pointer" onClick={() => u && setViewingEmployee(u)}>
                                        <td className="px-10 py-6">
                                            <div className="font-black text-slate-800 text-base tracking-tight">{req.name}</div>
                                            <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">{req.jobTitle}</div>
                                        </td>
                                        <td className="px-10 py-6">
                                            <div className="text-sm font-bold text-slate-700">
                                                {req.category === 'LEAVE' && `${req.leaveType}: ${req.startDate} to ${req.endDate}`}
                                                {req.category === 'OT' && `${req.otHours} Hours on ${req.otDate}`}
                                                {req.category === 'CORRECTION' && `${req.correctionType} on ${req.date}`}
                                            </div>
                                            <p className="text-[11px] text-slate-400 mt-2 italic line-clamp-2">"{req.reason}"</p>
                                        </td>
                                        <td className="px-10 py-6 text-right">
                                            {req.status === 'PENDING' ? (
                                                <div className="flex justify-end gap-3" onClick={e => e.stopPropagation()}>
                                                    <button onClick={() => handleStatusUpdate(req, 'APPROVED')} className="p-3 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-500 hover:text-white transition-all shadow-sm"><CheckCircle className="w-6 h-6"/></button>
                                                    <button onClick={() => handleStatusUpdate(req, 'REJECTED')} className="p-3 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-500 hover:text-white transition-all shadow-sm"><XCircle className="w-6 h-6"/></button>
                                                </div>
                                            ) : (
                                                <span className={`text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-lg ${req.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{req.status}</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
  };

  const renderLeaveManagement = () => (
      <div className="flex flex-col animate-fade-in gap-6 pb-12">
          <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden min-h-[600px]">
              <div className="p-8 border-b bg-slate-50/50 flex justify-between items-center shrink-0">
                  <h3 className="font-black text-slate-800 text-xl tracking-tight">Personnel Leave Credits</h3>
              </div>
              <div>
                  <table className="w-full text-left">
                      <thead className="bg-slate-50 sticky top-0 z-10 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                          <tr><th className="px-10 py-5">Employee</th><th className="px-10 py-5">Sick</th><th className="px-10 py-5">Vacation</th><th className="px-10 py-5">Emergency</th><th className="px-10 py-5 text-right">Actions</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {users.filter(u => u.role !== 'ADMIN').map(u => (
                              <tr key={u.id} className="hover:bg-slate-50 transition cursor-pointer" onClick={() => setViewingEmployee(u)}>
                                  <td className="px-10 py-6">
                                      <div className="font-black text-slate-800 text-base tracking-tight">{u.name}</div>
                                      <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">ID {u.id}</div>
                                  </td>
                                  <td className="px-10 py-6"><span className="font-black text-emerald-600 text-xl">{u.leaveBalances?.SICK || 0}</span></td>
                                  <td className="px-10 py-6"><span className="font-black text-blue-600 text-xl">{u.leaveBalances?.VACATION || 0}</span></td>
                                  <td className="px-10 py-6"><span className="font-black text-amber-600 text-xl">{u.leaveBalances?.EMERGENCY || 0}</span></td>
                                  <td className="px-10 py-6 text-right"><button className="bg-slate-900 text-white p-3.5 rounded-xl transition active:scale-95 shadow-md shadow-slate-900/10"><ExternalLink className="w-5 h-5"/></button></td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      </div>
  );

  const renderSystemConfig = () => (
      <div className="flex flex-col animate-fade-in gap-6 pb-12">
          <div className="flex bg-white p-3 rounded-[28px] border border-slate-200 shadow-sm gap-3 overflow-x-auto hide-scrollbar shrink-0">
              {[
                  { id: 'GENERAL', label: 'General Rules', icon: Settings },
                  { id: 'GEOFENCES', label: 'Geofences', icon: MapPin },
                  { id: 'SHIFTS', label: 'Shift Mgmt', icon: Clock },
                  { id: 'HOLIDAYS', label: 'Holidays', icon: CalendarDays }
              ].map(sec => (
                  <button key={sec.id} onClick={() => setConfigSection(sec.id as any)} className={`flex-1 py-4 px-6 rounded-2xl text-[11px] font-black tracking-widest uppercase transition-all flex items-center justify-center gap-3 whitespace-nowrap ${configSection === sec.id ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-500 hover:bg-slate-50'}`}><sec.icon className="w-5 h-5" />{sec.label}</button>
              ))}
          </div>

          <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm p-10 overflow-hidden">
              {configSection === 'GENERAL' && (
                  <div className="space-y-10 max-w-4xl">
                      <div className="flex items-center justify-between p-8 bg-slate-50 rounded-[32px] border border-slate-100 shadow-inner">
                          <div><h4 className="font-black text-slate-800 text-lg tracking-tight">Allow Remote Clock-In</h4><p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-2">Enable for personnel working from verified remote sites or WFH</p></div>
                          <button onClick={() => saveSettings({ ...settings, allowRemoteClockIn: !settings.allowRemoteClockIn })} className={`w-16 h-10 rounded-full transition-all relative ${settings.allowRemoteClockIn ? 'bg-emerald-500' : 'bg-slate-300'}`}><div className={`absolute top-1.5 w-7 h-7 bg-white rounded-full transition-all ${settings.allowRemoteClockIn ? 'left-8' : 'left-1.5'}`}></div></button>
                      </div>
                      <div className="flex items-center justify-between p-8 bg-slate-50 rounded-[32px] border border-slate-100 shadow-inner">
                          <div><h4 className="font-black text-slate-800 text-lg tracking-tight">Device Restriction Protocol</h4><p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-2">Force user accounts to be bound to unique hardware signatures</p></div>
                          <button onClick={() => saveSettings({ ...settings, deviceRestrictionEnabled: !settings.deviceRestrictionEnabled })} className={`w-16 h-10 rounded-full transition-all relative ${settings.deviceRestrictionEnabled ? 'bg-blue-600' : 'bg-slate-300'}`}><div className={`absolute top-1.5 w-7 h-7 bg-white rounded-full transition-all ${settings.deviceRestrictionEnabled ? 'left-8' : 'left-1.5'}`}></div></button>
                      </div>
                      <div className="space-y-4">
                          <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-3"><Coffee className="w-5 h-5"/> Standard Break Threshold (Minutes)</label>
                          <input type="number" value={settings.breakDuration} onChange={e => saveSettings({...settings, breakDuration: Number(e.target.value)})} className="w-full max-w-md p-5 border border-slate-200 rounded-2xl bg-slate-50 focus:ring-4 focus:ring-blue-500/10 outline-none font-black text-slate-800 shadow-inner text-lg" />
                      </div>
                  </div>
              )}

              {configSection === 'GEOFENCES' && (
                  <div className="space-y-8">
                      <div className="flex justify-between items-center mb-6"><h4 className="font-black text-slate-800 text-2xl tracking-tight">Geofence Registry</h4><button onClick={() => { const newGeo: Geofence = { id: Date.now().toString(), name: 'New Operational Site', lat: 14.5, lng: 121, radius: 200 }; saveSettings({ ...settings, geofences: [...settings.geofences, newGeo] }); }} className="bg-blue-600 text-white px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center gap-3 transition active:scale-95 shadow-xl shadow-blue-600/20"><Plus className="w-5 h-5"/> Provision Site</button></div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {settings.geofences.map((geo, idx) => (
                              <div key={geo.id} className="p-8 border border-slate-100 rounded-[32px] bg-slate-50 shadow-inner hover:border-blue-200 transition-all group relative">
                                  <button onClick={() => saveSettings({ ...settings, geofences: settings.geofences.filter(g => g.id !== geo.id) })} className="absolute top-6 right-6 text-slate-300 hover:text-rose-500 transition"><Trash2 className="w-5 h-5"/></button>
                                  <input className="w-full bg-transparent font-black text-slate-800 border-none outline-none focus:ring-0 mb-4 text-xl" value={geo.name} onChange={e => { const updated = [...settings.geofences]; updated[idx].name = e.target.value; saveSettings({ ...settings, geofences: updated }); }} />
                                  <div className="space-y-4">
                                      <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Detection Radius (M)</label><input type="number" className="w-full p-3 bg-white rounded-xl border border-slate-200 text-sm font-black shadow-sm" value={geo.radius} onChange={e => { const updated = [...settings.geofences]; updated[idx].radius = Number(e.target.value); saveSettings({ ...settings, geofences: updated }); }} /></div>
                                      <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">GPS Baseline</label><div className="text-xs font-mono text-slate-500 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">{geo.lat.toFixed(5)}, {geo.lng.toFixed(5)}</div></div>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              )}

              {configSection === 'SHIFTS' && (
                  <div className="space-y-8">
                      <div className="flex justify-between items-center mb-6"><h4 className="font-black text-slate-800 text-2xl tracking-tight">Organizational Shifts</h4><button onClick={() => { const newShift: Shift = { id: Date.now().toString(), name: 'Alpha Shift', startTime: '08:00', endTime: '17:00', gracePeriod: 15 }; saveSettings({ ...settings, shifts: [...settings.shifts, newShift] }); }} className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center gap-3 transition active:scale-95 shadow-xl shadow-slate-900/20"><Plus className="w-5 h-5"/> New Schedule</button></div>
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                          {settings.shifts.map((shift, idx) => (
                              <div key={shift.id} className="flex flex-wrap items-center justify-between p-8 bg-slate-50 border border-slate-100 rounded-[32px] gap-8 shadow-inner">
                                  <input className="font-black text-slate-800 bg-transparent outline-none text-xl min-w-[200px]" value={shift.name} onChange={e => { const upd = [...settings.shifts]; upd[idx].name = e.target.value; saveSettings({...settings, shifts: upd}); }} />
                                  <div className="flex gap-6 items-center">
                                      <div className="flex flex-col"><label className="text-[10px] font-black text-slate-400 uppercase mb-2">Shift Start</label><input type="time" className="p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold shadow-sm" value={shift.startTime} onChange={e => { const upd = [...settings.shifts]; upd[idx].startTime = e.target.value; saveSettings({...settings, shifts: upd}); }} /></div>
                                      <div className="flex flex-col"><label className="text-[10px] font-black text-slate-400 uppercase mb-2">Shift End</label><input type="time" className="p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold shadow-sm" value={shift.endTime} onChange={e => { const upd = [...settings.shifts]; upd[idx].endTime = e.target.value; saveSettings({...settings, shifts: upd}); }} /></div>
                                      <div className="flex flex-col"><label className="text-[10px] font-black text-slate-400 uppercase mb-2">Grace (Min)</label><input type="number" className="w-20 p-3 bg-white border border-slate-200 rounded-xl text-sm font-black shadow-sm" value={shift.gracePeriod} onChange={e => { const upd = [...settings.shifts]; upd[idx].gracePeriod = Number(e.target.value); saveSettings({...settings, shifts: upd}); }} /></div>
                                      <button onClick={() => saveSettings({...settings, shifts: settings.shifts.filter(s => s.id !== shift.id)})} className="p-4 text-rose-400 hover:bg-rose-50 rounded-2xl transition shadow-sm bg-white border border-slate-100"><Trash2 className="w-5 h-5"/></button>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              )}

              {configSection === 'HOLIDAYS' && (
                  <div className="space-y-8">
                      <div className="flex justify-between items-center mb-6"><h4 className="font-black text-slate-800 text-2xl tracking-tight">Holiday Calendar</h4><button onClick={() => { const newHol: Holiday = { id: Date.now().toString(), name: 'Gazetted Holiday', date: new Date().toISOString().split('T')[0], type: 'REGULAR' }; saveSettings({ ...settings, holidays: [...settings.holidays, newHol] }); }} className="bg-emerald-600 text-white px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center gap-3 transition active:scale-95 shadow-xl shadow-emerald-600/20"><Plus className="w-5 h-5"/> Add Entry</button></div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                          {settings.holidays.map((hol, idx) => (
                              <div key={hol.id} className="p-6 bg-slate-50 border border-slate-200 rounded-[28px] space-y-4 shadow-inner">
                                  <div className="flex justify-between items-center"><span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg ${hol.type === 'REGULAR' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{hol.type}</span><button onClick={() => saveSettings({...settings, holidays: settings.holidays.filter(h => h.id !== hol.id)})} className="text-slate-400 hover:text-rose-500 transition"><Trash2 className="w-5 h-5"/></button></div>
                                  <input className="font-black text-slate-800 bg-transparent border-none outline-none text-base w-full" value={hol.name} onChange={e => { const upd = [...settings.holidays]; upd[idx].name = e.target.value; saveSettings({...settings, holidays: upd}); }} />
                                  <input type="date" className="bg-white border border-slate-200 p-3 rounded-xl font-bold text-sm outline-none w-full shadow-sm" value={hol.date} onChange={e => { const upd = [...settings.holidays]; upd[idx].date = e.target.value; saveSettings({...settings, holidays: upd}); }} />
                              </div>
                          ))}
                      </div>
                  </div>
              )}
          </div>
      </div>
  );

  const renderEmployeeDetailView = (user: User) => {
    const userLogs = logs.filter(l => l.uid === user.id);
    const dayGroups: Record<string, { in?: AttendanceLog, out?: AttendanceLog }> = {};
    userLogs.forEach(log => {
        const d = new Date(log.timestamp).toLocaleDateString();
        if (!dayGroups[d]) dayGroups[d] = {};
        if (log.type === 'IN') dayGroups[d].in = log;
        else dayGroups[d].out = log;
    });
    const sortedDays = Object.keys(dayGroups).sort((a,b) => new Date(b).getTime() - new Date(a).getTime());

    return (
        <div className="flex flex-col animate-fade-in gap-8 pb-12">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 shrink-0">
                <div className="lg:col-span-2 bg-white rounded-[32px] p-10 border border-slate-200 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-8">
                        <button onClick={() => setViewingEmployee(null)} className="p-5 bg-slate-100 hover:bg-slate-200 rounded-2xl transition"><ArrowLeft className="w-6 h-6 text-slate-600"/></button>
                        <div>
                            <h2 className="text-4xl font-black text-slate-800 tracking-tighter">{user.name}</h2>
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">{user.jobTitle} • ID {user.id}</p>
                        </div>
                    </div>
                    <button onClick={() => handleDownloadEmployeeDossier(user, userLogs)} className="bg-slate-900 text-white px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center gap-3 hover:bg-black transition shadow-xl"><FileDown className="w-6 h-6"/> Export Dossier</button>
                </div>

                <div className="bg-white rounded-[32px] p-10 border border-slate-200 shadow-sm">
                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-3"><Briefcase className="w-5 h-5 text-blue-500"/> Credit Revision</h3>
                    <div className="grid grid-cols-3 gap-4">
                        {(['SICK', 'VACATION', 'EMERGENCY'] as LeaveType[]).map(lt => (
                            <div key={lt} className="space-y-2">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{lt}</label>
                                <input type="number" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-slate-800 shadow-inner" value={user.leaveBalances?.[lt] || 0} onChange={e => handleUpdateBalance(user, lt, Number(e.target.value))} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
                <div className="p-8 border-b bg-slate-50/50 shrink-0">
                    <h3 className="font-black text-slate-800 text-lg tracking-tight flex items-center gap-3"><Clock className="w-5 h-5 text-blue-500" /> Granular Attendance Audit</h3>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 sticky top-0 z-10 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                            <tr><th className="px-10 py-5">Date</th><th className="px-10 py-5 text-center">In</th><th className="px-10 py-5 text-center">Out</th><th className="px-10 py-5 text-right">Verification Site</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {sortedDays.map(day => {
                                const { in: lIn, out: lOut } = dayGroups[day];
                                return (
                                    <tr key={day} className="hover:bg-slate-50 transition">
                                        <td className="px-10 py-6 font-black text-slate-800 text-base">{day}</td>
                                        <td className="px-10 py-6 text-center">{lIn ? <span className="text-emerald-600 font-bold text-base">{new Date(lIn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span> : <span className="text-slate-300 italic text-base">--</span>}</td>
                                        <td className="px-10 py-6 text-center">{lOut ? <span className="text-rose-600 font-bold text-base">{new Date(lOut.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span> : <span className="text-slate-300 italic text-base">--</span>}</td>
                                        <td className="px-10 py-6 text-right">
                                            <div className="flex items-center justify-end gap-4">
                                                {lIn?.photo && <button onClick={() => setPreviewImage(lIn.photo!)} className="p-3 bg-slate-100 hover:bg-slate-200 rounded-xl transition border border-slate-200"><Camera className="w-5 h-5 text-slate-600"/></button>}
                                                <div className="text-xs font-bold text-slate-500 flex items-center gap-2"><MapPin className="w-4 h-4 text-blue-500"/> {lIn?.locationName || lOut?.locationName || 'Main Operation HQ'}</div>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative font-sans overflow-hidden">
      {notification && (
        <div className="absolute top-8 right-8 z-[100] animate-slide-in">
            <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-2xl flex items-center gap-6 border-l-8 border-blue-500">
                <Bell className="w-6 h-6 text-blue-500" />
                <div><p className="font-bold text-base tracking-tight">System Notification</p><p className="text-[11px] text-slate-400 uppercase tracking-widest">{notification}</p></div>
                <button onClick={() => setNotification(null)} className="p-2 hover:bg-white/10 rounded-full transition ml-4"><X className="w-5 h-5 text-slate-500" /></button>
            </div>
        </div>
      )}

      {previewImage && (
          <div className="fixed inset-0 bg-black/95 z-[200] flex items-center justify-center p-12 animate-fade-in" onClick={() => setPreviewImage(null)}>
              <div className="relative max-w-4xl w-full bg-white p-3 rounded-[40px] overflow-hidden shadow-2xl">
                  <img src={previewImage} className="w-full h-auto rounded-[32px]" alt="Verification Identity" />
                  <button className="absolute top-8 right-8 bg-black/50 hover:bg-black text-white p-3 rounded-full transition backdrop-blur-md"><X className="w-8 h-8" /></button>
              </div>
          </div>
      )}

      {/* FIXED HEADER */}
      <div className="bg-slate-900 text-white shrink-0 relative overflow-hidden">
        <div className="px-10 py-10 relative z-10">
            <div className="flex flex-wrap justify-between items-center gap-8 mb-12">
                <div className="flex items-center gap-6">
                    <div className="bg-slate-800 p-5 rounded-[32px] border border-slate-700 shadow-2xl ring-1 ring-slate-700/50"><ShieldAlert className="w-10 h-10 text-amber-500" /></div>
                    <div><h1 className="text-4xl font-black tracking-tighter">Command Center</h1><p className="text-slate-500 text-[11px] font-black tracking-[0.4em] uppercase opacity-70">Privileged Administrative Session • {currentUser.name}</p></div>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={onSwitchToEmployee} className="px-8 py-4 bg-slate-800 hover:bg-slate-700 rounded-2xl text-[11px] font-black uppercase tracking-widest transition active:scale-95 border border-slate-700 shadow-2xl">Return to Staff View</button>
                    <button onClick={onLogout} className="px-8 py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition active:scale-95 shadow-xl shadow-rose-900/40">Terminate Session</button>
                </div>
            </div>
            {!viewingEmployee && (
                <div className="flex gap-12 overflow-x-auto hide-scrollbar">
                    {[
                        { id: 'OVERVIEW', label: 'Overview', icon: Activity },
                        { id: 'EMPLOYEES', label: 'Personnel', icon: Users },
                        { id: 'DTR_LOGS', label: 'Time Audit', icon: Clock },
                        { id: 'REQUESTS', label: 'Approvals', icon: CheckCircle },
                        { id: 'COMMUNICATIONS', label: 'Communications', icon: MessageSquare },
                        { id: 'LEAVE', label: 'Leave Registry', icon: Briefcase },
                        { id: 'SYSTEM', label: 'System Architecture', icon: Settings }
                    ].map(t => (
                        <button key={t.id} onClick={() => setActiveTab(t.id as any)} className={`pb-6 text-[11px] font-black transition-all tracking-[0.3em] border-b-4 uppercase flex items-center gap-3 ${activeTab === t.id ? 'text-white border-blue-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}><t.icon className="w-5 h-5"/>{t.label}</button>
                    ))}
                </div>
            )}
            {viewingEmployee && (
                <div className="pb-6"><span className="text-blue-400 text-[11px] font-black tracking-[0.4em] uppercase border-b-4 border-blue-500 pb-6">Auditing Dossier: {viewingEmployee.name}</span></div>
            )}
        </div>
        <div className="absolute -top-40 -right-40 w-[800px] h-[800px] bg-blue-600/10 rounded-full blur-[160px]"></div>
        <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] bg-emerald-600/5 rounded-full blur-[140px]"></div>
      </div>

      {/* SCROLLABLE CONTENT AREA */}
      <div className="flex-1 min-h-0 flex flex-col w-full mx-auto overflow-y-auto custom-scrollbar">
        <div className="p-8 md:p-10 flex-1">
            {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-8 py-20">
                    <div className="relative"><div className="w-20 h-20 rounded-full border-4 border-slate-200 border-t-blue-600 animate-spin"></div><div className="absolute inset-0 flex items-center justify-center"><Activity className="w-8 h-8 text-blue-600 animate-pulse" /></div></div>
                    <p className="text-slate-400 text-[12px] font-black tracking-[0.4em] uppercase">Synchronizing Fleet Intelligence...</p>
                </div>
            ) : (
                <div className="animate-fade-in">
                    {viewingEmployee ? renderEmployeeDetailView(viewingEmployee) : (
                        <>
                            {activeTab === 'OVERVIEW' ? renderOverview() : 
                            activeTab === 'EMPLOYEES' ? renderEmployees() : 
                            activeTab === 'DTR_LOGS' ? renderDTRLogs() :
                            activeTab === 'REQUESTS' ? renderRequests() :
                            activeTab === 'COMMUNICATIONS' ? renderCommunications() :
                            activeTab === 'LEAVE' ? renderLeaveManagement() :
                            renderSystemConfig()}
                        </>
                    )}
                </div>
            )}
        </div>
      </div>

      {showUserModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[110] flex items-center justify-center p-8">
              <div className="bg-white rounded-[48px] shadow-[0_48px_80px_-16px_rgba(0,0,0,0.3)] w-full max-w-lg overflow-hidden animate-slide-up border border-slate-200">
                  <div className="px-12 py-8 border-b border-slate-100 bg-slate-50/80 flex justify-between items-center"><h3 className="font-black text-slate-800 tracking-tight text-2xl">{editingUser ? 'Profile Adjustment' : 'Personnel Commission'}</h3><button onClick={() => setShowUserModal(false)} className="p-3 hover:bg-slate-200 rounded-full transition"><X className="w-8 h-8 text-slate-400" /></button></div>
                  <form onSubmit={handleSaveUser} className="p-12 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                      <div className="space-y-2"><label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Operational ID</label><input type="text" value={formId} onChange={e => setFormId(e.target.value)} placeholder="EMP-2024-XXXX" className="w-full p-5 border border-slate-200 rounded-[20px] bg-slate-50 focus:ring-4 focus:ring-blue-500/10 outline-none font-black text-lg" disabled={!!editingUser} /></div>
                      <div className="space-y-2"><label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Legal Full Name</label><input type="text" value={formName} onChange={e => setFormName(e.target.value)} placeholder="Juan Dela Cruz" className="w-full p-5 border border-slate-200 rounded-[20px] focus:ring-4 focus:ring-blue-500/10 outline-none font-black text-lg" /></div>
                      
                      <div className="space-y-2">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Authentication Password</label>
                        <div className="relative">
                            <input 
                                type={showFormPassword ? "text" : "password"} 
                                value={formPassword} 
                                onChange={e => setFormPassword(e.target.value)} 
                                placeholder="••••••••" 
                                className="w-full p-5 border border-slate-200 rounded-[20px] focus:ring-4 focus:ring-blue-500/10 outline-none font-black text-lg pr-12" 
                            />
                            <button type="button" onClick={() => setShowFormPassword(!showFormPassword)} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400">
                                {showFormPassword ? <EyeOff className="w-5 h-5" /> : <KeyRound className="w-5 h-5" />}
                            </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-2"><label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Job Specification</label><select value={formJobTitle} onChange={e => setFormJobTitle(e.target.value as any)} className="w-full p-5 border border-slate-200 rounded-[20px] bg-white outline-none font-black text-base shadow-sm"><option value="Programmer">Programmer</option><option value="Operator">Operator</option><option value="Technician">Technician</option></select></div>
                          <div className="space-y-2"><label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Access Protocol</label><select value={formRole} onChange={e => setFormRole(e.target.value as any)} className="w-full p-5 border border-slate-200 rounded-[20px] bg-white outline-none font-black text-base shadow-sm"><option value="EMPLOYEE">Standard Staff</option><option value="ADMIN">System Admin</option></select></div>
                      </div>
                      <button type="submit" className="w-full bg-slate-900 hover:bg-black text-white font-black py-6 rounded-[24px] shadow-2xl transition-all active:scale-[0.98] uppercase text-[12px] tracking-widest">Commit to Mainframe</button>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};
