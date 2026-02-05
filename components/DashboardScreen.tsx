
import React, { useState, useEffect, useRef } from 'react';
import { User, AttendanceLog, UserRequest, Message } from '../types';
import { useGeolocation } from '../hooks/useGeolocation';
import { getDistanceFromLatLonInM } from '../utils/geoUtils';
import { AFFILIATED_COMPANIES, ALLOWED_RADIUS_METERS } from '../constants';
import { getLogs, addLog, addRequest, getRequests, getMessages } from '../services/db';
import { LogOut, MapPin, MapPinOff, Clock, User as UserIcon, Loader2, Globe, Camera, AlertCircle, FileQuestion, History, Building2, Bell, Briefcase, X, ShieldCheck, CheckCircle2, MessageSquare } from 'lucide-react';
import { CameraCapture } from './CameraCapture';
import { RequestModal } from './RequestModal';

interface DashboardScreenProps {
  currentUser: User;
  onLogout: () => void;
  onViewHistory: () => void;
  onViewMessages: () => void;
  onSwitchToAdmin?: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ currentUser, onLogout, onViewHistory, onViewMessages, onSwitchToAdmin }) => {
  const geo = useGeolocation();
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [distance, setDistance] = useState<number | null>(null);
  const [currentLocationName, setCurrentLocationName] = useState<string>('Unknown');
  const [liveTime, setLiveTime] = useState<string>(new Date().toLocaleTimeString('en-US', { hour12: false }));
  const [inRange, setInRange] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  
  const [notification, setNotification] = useState<string | null>(null);
  const prevUnreadRef = useRef<number>(0);
  
  const [showCamera, setShowCamera] = useState(false);
  const [showRequest, setShowRequest] = useState(false);

  const [todayIn, setTodayIn] = useState<AttendanceLog | undefined>(undefined);
  const [todayOut, setTodayOut] = useState<AttendanceLog | undefined>(undefined);

  const isAdmin = currentUser.role === 'ADMIN';

  useEffect(() => {
    const timer = setInterval(() => {
      setLiveTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const checkUpdates = async (isInitial = false) => {
        try {
          const [allRequests, allMessages] = await Promise.all([getRequests(), getMessages()]);
          
          const userRequests = allRequests.filter(r => r.uid === currentUser.id);
          const unreadReqs = userRequests.filter(r => !r.isRead).length;
          
          const userMessages = allMessages.filter(m => m.toId === currentUser.id || m.toId === 'ALL');
          const unreadMsgs = userMessages.filter(m => !m.isRead).length;

          const totalUnread = unreadReqs + unreadMsgs;
          
          if (!isInitial && totalUnread > prevUnreadRef.current) {
              setNotification("New message or update received!");
              setTimeout(() => setNotification(null), 5000);
          }

          prevUnreadRef.current = totalUnread;
          setUnreadCount(totalUnread);
        } catch (e) { console.error(e); }
    };

    checkUpdates(true);
    const interval = setInterval(() => checkUpdates(false), 5000); 
    return () => clearInterval(interval);
  }, [currentUser.id]);

  useEffect(() => {
    if (geo.lat && geo.lng) {
      let minDistance = Infinity;
      let nearestCompany = null;

      AFFILIATED_COMPANIES.forEach(company => {
        const dist = getDistanceFromLatLonInM(geo.lat!, geo.lng!, company.lat, company.lng);
        if (dist < minDistance) {
          minDistance = dist;
          nearestCompany = company;
        }
      });

      if (nearestCompany && minDistance <= ALLOWED_RADIUS_METERS) {
        setDistance(minDistance);
        setInRange(true);
        setCurrentLocationName(nearestCompany.name);
      } else {
        setDistance(minDistance);
        setInRange(false);
        setCurrentLocationName(nearestCompany ? `Near ${nearestCompany.name} (Too Far)` : 'Remote Location');
      }
    } else {
      setInRange(false);
      setCurrentLocationName('locating...');
    }
  }, [geo.lat, geo.lng]);

  const loadLogs = async () => {
    try {
      const allLogs = await getLogs();
      const userLogs = allLogs.filter(l => l.uid === currentUser.id);
      setLogs(userLogs);
      
      const today = new Date().toDateString();
      setTodayIn(userLogs.find(l => l.type === 'IN' && new Date(l.timestamp).toDateString() === today));
      setTodayOut(userLogs.find(l => l.type === 'OUT' && new Date(l.timestamp).toDateString() === today));
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    loadLogs();
  }, [currentUser.id]);

  const handleClockInStart = () => {
    if (todayIn) return;
    if (geo.loading) { alert("Please wait for GPS location..."); return; }
    if (!geo.lat || !geo.lng) { alert("GPS Location is required to Clock In."); return; }
    setShowCamera(true);
  };

  const handlePhotoCaptured = async (photo: string) => {
    setShowCamera(false);
    if (!geo.lat || !geo.lng) { alert("Error: Location data missing."); return; }

    let locationLabel = currentLocationName;
    if (!inRange) { locationLabel = `Remote (${geo.lat.toFixed(4)}, ${geo.lng.toFixed(4)})`; }

    const newLog: AttendanceLog = {
      uid: currentUser.id,
      name: currentUser.name,
      type: 'IN',
      timestamp: new Date().toISOString(),
      photo,
      location: { lat: geo.lat, lng: geo.lng },
      locationName: locationLabel
    };

    await addLog(newLog);
    loadLogs();
  };

  const handleClockOut = async () => {
    if (!todayIn || todayOut) return;
    if (geo.loading || !geo.lat || !geo.lng) { alert("GPS Location is required to Clock Out."); return; }

    let locationLabel = currentLocationName;
    if (!inRange) { locationLabel = `Remote (${geo.lat.toFixed(4)}, ${geo.lng.toFixed(4)})`; }

    const newLog: AttendanceLog = {
      uid: currentUser.id,
      name: currentUser.name,
      type: 'OUT',
      timestamp: new Date().toISOString(),
      location: { lat: geo.lat, lng: geo.lng },
      locationName: locationLabel
    };

    await addLog(newLog);
    loadLogs();
  };

  const handleRequestSubmit = async (req: UserRequest) => {
      await addRequest(req);
      setShowRequest(false);
      alert("Request submitted successfully.");
  };

  const getStatusContent = () => {
    if (geo.loading) return <div className="flex items-center justify-center text-gray-500 gap-2 font-medium"><Loader2 className="w-4 h-4 animate-spin" /><span>Synchronizing GPS...</span></div>;
    if (geo.error) return <div className="flex items-center justify-center text-amber-600 gap-2 font-medium"><MapPinOff className="w-4 h-4" /><span>Remote Session Enabled</span></div>;
    if (inRange) return <div className="flex items-center justify-center text-green-700 gap-2 font-medium"><Building2 className="w-4 h-4" /><span>{currentLocationName} ({Math.round(distance || 0)}m)</span></div>;
    return <div className="flex items-center justify-center text-blue-600 gap-2 font-medium"><Globe className="w-4 h-4" /><span>{currentLocationName}</span></div>;
  };

  const getStatusClass = () => {
      if (geo.loading) return "bg-gray-50 border-gray-200";
      if (geo.error) return "bg-amber-50 border-amber-200";
      if (inRange) return "bg-green-50 border-green-200";
      return "bg-blue-50 border-blue-200";
  };

  const canClockIn = !todayIn;
  const canClockOut = !!todayIn && !todayOut;
  const isDayComplete = !!todayIn && !!todayOut;
  const isClockOutLoading = canClockOut && geo.loading;

  return (
    <div className="flex flex-col h-full bg-white relative">
      {notification && (
        <div className="absolute top-4 left-4 right-4 z-[60] animate-slide-in">
            <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between border-l-4 border-blue-500">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-600 p-2 rounded-full"><Bell className="w-4 h-4 text-white" /></div>
                    <div><p className="font-bold text-sm">Update</p><p className="text-xs text-slate-400">{notification}</p></div>
                </div>
                <button onClick={() => setNotification(null)} className="p-1 hover:bg-white/10 rounded-full transition"><X className="w-5 h-5 text-slate-400 hover:text-white" /></button>
            </div>
        </div>
      )}

      {showCamera && <CameraCapture onCapture={handlePhotoCaptured} onClose={() => setShowCamera(false)} geo={geo} locationName={currentLocationName} />}
      {showRequest && <RequestModal uid={currentUser.id} userName={currentUser.name} jobTitle={currentUser.jobTitle} onSubmit={handleRequestSubmit} onClose={() => setShowRequest(false)} />}

      <div className="bg-blue-600 p-6 text-white shrink-0 relative overflow-hidden">
        <div className="relative z-10 flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500/50 backdrop-blur-sm p-2 rounded-xl border border-white/20"><UserIcon className="w-6 h-6 text-white" /></div>
            <div>
              <h1 className="text-lg font-bold leading-tight">{currentUser.name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-blue-100 text-[10px] font-mono opacity-80 uppercase tracking-tighter">ID {currentUser.id}</span>
                  {currentUser.jobTitle && <span className="bg-blue-500/50 px-2 py-0.5 rounded text-[9px] uppercase tracking-wide font-bold border border-white/10">{currentUser.jobTitle}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onSwitchToAdmin && <button onClick={onSwitchToAdmin} className="relative p-2.5 bg-blue-500/40 rounded-xl hover:bg-blue-500 transition active:scale-95 border border-white/10" title="Admin Portal"><ShieldCheck className="w-4 h-4 text-white" /></button>}
            <button onClick={onViewMessages} className="relative p-2.5 bg-blue-500/40 rounded-xl hover:bg-blue-500 transition active:scale-95 border border-white/10"><MessageSquare className="w-4 h-4 text-white" />{unreadCount > 0 && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-blue-600"></span>}</button>
            <button onClick={onLogout} className="p-2.5 bg-blue-700 hover:bg-blue-800 rounded-xl transition active:scale-95 shadow-sm"><LogOut className="w-4 h-4 text-white" /></button>
          </div>
        </div>
        <div className="mt-8 text-center relative z-10">
            <p className="text-blue-200 text-[10px] tracking-[0.2em] font-bold uppercase mb-1 opacity-80">Local Server Time</p>
            <div className="text-5xl font-mono font-bold tracking-tighter drop-shadow-xl">{liveTime}</div>
        </div>
        <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-blue-400 rounded-full opacity-30 blur-3xl"></div>
      </div>

      <div className="p-6 flex-1 flex flex-col min-h-0 bg-white rounded-t-[32px] -mt-4 relative z-20">
        <div className={`mb-6 p-3 rounded-2xl border text-sm transition-all duration-300 shadow-sm ${getStatusClass()}`}>{getStatusContent()}</div>

        {!isAdmin ? (
            <div className="grid grid-cols-2 gap-4 mb-6">
              <button 
                onClick={handleClockInStart} 
                disabled={!canClockIn} 
                className={`group relative overflow-hidden p-5 rounded-[24px] shadow-lg transition-all transform flex flex-col items-center justify-center gap-3 border ${canClockIn ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-emerald-400 hover:shadow-emerald-200 active:scale-95' : 'bg-gray-50 text-gray-400 border-gray-100 opacity-60'}`}
              >
                <div className={`p-3.5 rounded-2xl ${canClockIn ? 'bg-white/20' : 'bg-gray-100'}`}>{canClockIn ? <Camera className="w-7 h-7" /> : <Clock className="w-7 h-7" />}</div>
                <div className="flex flex-col items-center"><span className="font-bold text-lg tracking-tight">CLOCK IN</span>{todayIn && <span className="text-[10px] font-medium opacity-90">{new Date(todayIn.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}</div>
              </button>
              <button 
                onClick={handleClockOut} 
                disabled={!canClockOut || isClockOutLoading} 
                className={`group relative overflow-hidden p-5 rounded-[24px] shadow-lg transition-all transform flex flex-col items-center justify-center gap-3 border ${canClockOut ? 'bg-gradient-to-br from-rose-500 to-rose-600 text-white border-rose-400 hover:shadow-rose-200 active:scale-95' : 'bg-gray-50 text-gray-400 border-gray-100 opacity-60'}`}
              >
                <div className={`p-3.5 rounded-2xl ${canClockOut ? 'bg-white/20' : 'bg-gray-100'}`}>{isClockOutLoading ? <Loader2 className="w-7 h-7 animate-spin" /> : <LogOut className="w-7 h-7" />}</div>
                <div className="flex flex-col items-center"><span className="font-bold text-lg tracking-tight">{isClockOutLoading ? 'PENDING...' : 'CLOCK OUT'}</span>{todayOut && <span className="text-[10px] font-medium opacity-90">{new Date(todayOut.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}</div>
              </button>
            </div>
        ) : (
             <div className="mb-6 p-6 bg-slate-50 border border-slate-200 rounded-[24px] flex flex-col items-center text-center gap-3 shadow-sm">
                <div className="bg-slate-200 p-4 rounded-2xl"><ShieldCheck className="w-8 h-8 text-slate-700" /></div>
                <div><h3 className="text-base font-bold text-slate-900">Admin Mode Active</h3><p className="text-xs text-slate-500 mt-1 max-w-[200px] mx-auto leading-relaxed">Personal time tracking is disabled. Use the portal to manage your team.</p></div>
            </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-6">
            <button onClick={onViewHistory} className="py-3.5 bg-white border border-slate-200 text-slate-700 rounded-2xl text-sm font-bold hover:bg-slate-50 transition active:scale-95 flex items-center justify-center gap-2 shadow-sm"><History className="w-4 h-4 text-blue-500" />History</button>
            <button onClick={onViewMessages} className="py-3.5 bg-white border border-slate-200 text-slate-700 rounded-2xl text-sm font-bold hover:bg-slate-50 transition active:scale-95 flex items-center justify-center gap-2 shadow-sm relative"><Bell className="w-4 h-4 text-blue-500" />Inbox{unreadCount > 0 && <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full ml-1 border-2 border-white shadow-sm">{unreadCount}</span>}</button>
            <button onClick={() => setShowRequest(true)} className="col-span-2 py-3.5 bg-slate-900 text-white rounded-2xl text-sm font-bold hover:bg-slate-800 transition active:scale-95 flex items-center justify-center gap-2 shadow-md"><FileQuestion className="w-4 h-4 text-blue-400" />Submit Formal Request</button>
        </div>

        {!isAdmin && isDayComplete && (
            <div className="mb-6 p-3 bg-emerald-50 text-emerald-700 text-center rounded-xl border border-emerald-100 text-xs font-bold flex items-center justify-center gap-2 animate-pulse">
                <CheckCircle2 className="w-4 h-4" /> Today's shift is officially recorded.
            </div>
        )}

        <div className="flex-1 bg-slate-50 rounded-[28px] p-5 border border-slate-100 overflow-hidden flex flex-col shadow-inner">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-sm"></div>Real-time Logs</h3>
                <span className="text-[10px] text-slate-400 font-medium">Recent 10 items</span>
            </div>
            <div className="overflow-y-auto flex-1 pr-1 custom-scrollbar min-h-0">
                {logs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs italic py-8">
                        <div className="p-3 bg-slate-100 rounded-full mb-2"><Clock className="w-6 h-6 opacity-20" /></div>
                        <span>No clocking activity today.</span>
                    </div>
                ) : (
                    <ul className="space-y-3">
                        {logs.slice(0, 10).map((log, index) => (
                            <li key={index} className="flex justify-between items-center bg-white p-3.5 rounded-[18px] border border-slate-100 shadow-sm">
                                <div className="flex items-center gap-3.5">
                                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${log.type === 'IN' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                        {log.type === 'IN' ? <Clock className="w-5 h-5"/> : <LogOut className="w-5 h-5"/>}
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm text-slate-800">{log.type === 'IN' ? 'Clock In' : 'Clock Out'}</div>
                                        <div className="text-slate-400 text-[10px] font-mono mt-0.5">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                        {log.locationName && (
                                            <div className="text-[9px] text-slate-500 flex items-center gap-1 mt-1 font-bold truncate max-w-[120px]">
                                                <MapPin className="w-2.5 h-2.5" />{log.locationName}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {log.photo ? (
                                    <div className="w-11 h-11 rounded-xl overflow-hidden border border-slate-200 shadow-sm"><img src={log.photo} alt="Identity" className="w-full h-full object-cover" /></div>
                                ) : (
                                    <div className="w-11 h-11 bg-slate-100 rounded-xl flex items-center justify-center"><Globe className="w-4 h-4 text-slate-300" /></div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};
