import React, { useState, useEffect, useRef } from 'react';
import { User, AttendanceLog, UserRequest } from '../types';
import { useGeolocation } from '../hooks/useGeolocation';
import { getDistanceFromLatLonInM } from '../utils/geoUtils';
import { AFFILIATED_COMPANIES, ALLOWED_RADIUS_METERS } from '../constants';
import { getLogs, addLog, addRequest, getRequests } from '../services/db';
import { LogOut, MapPin, MapPinOff, Clock, User as UserIcon, Loader2, Globe, Camera, AlertCircle, FileQuestion, History, Building2, Bell, Briefcase, X, ShieldCheck } from 'lucide-react';
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
  
  // Notification State
  const [notification, setNotification] = useState<string | null>(null);
  const prevUnreadRef = useRef<number>(0);
  
  // Modals
  const [showCamera, setShowCamera] = useState(false);
  const [showRequest, setShowRequest] = useState(false);

  // Status State
  const [todayIn, setTodayIn] = useState<AttendanceLog | undefined>(undefined);
  const [todayOut, setTodayOut] = useState<AttendanceLog | undefined>(undefined);

  const isAdmin = currentUser.role === 'ADMIN';

  // Clock Update
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Poll for Updates (Notification Logic)
  useEffect(() => {
    // Initial check
    const checkUpdates = (isInitial = false) => {
        const allRequests = getRequests();
        const userRequests = allRequests.filter(r => r.uid === currentUser.id);
        const unread = userRequests.filter(r => !r.isRead).length;
        
        // Detect increase in unread count (Admin updated something)
        if (!isInitial && unread > prevUnreadRef.current) {
            setNotification("Update received on your request!");
            // Auto-hide after 5 seconds
            setTimeout(() => setNotification(null), 5000);
        }

        prevUnreadRef.current = unread;
        setUnreadCount(unread);
    };

    checkUpdates(true); // Run once immediately

    const interval = setInterval(() => checkUpdates(false), 2000); 
    return () => clearInterval(interval);
  }, [currentUser.id]);


  // Distance & Location Calculation
  useEffect(() => {
    if (geo.lat && geo.lng) {
      let minDistance = Infinity;
      let nearestCompany = null;

      // Find nearest company
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
        setDistance(minDistance); // Distance to the closest one found, even if far
        setInRange(false);
        setCurrentLocationName(nearestCompany ? `Near ${nearestCompany.name} (Too Far)` : 'Remote Location');
      }
    } else {
      setInRange(false);
      setCurrentLocationName(' locating...');
    }
  }, [geo.lat, geo.lng]);

  // Load Logs & Calculate Daily Status
  useEffect(() => {
    const allLogs = getLogs();
    const userLogs = allLogs.filter(l => l.uid === currentUser.id);
    setLogs(userLogs);
    
    // Check today's status
    const today = new Date().toDateString();
    setTodayIn(userLogs.find(l => l.type === 'IN' && new Date(l.timestamp).toDateString() === today));
    setTodayOut(userLogs.find(l => l.type === 'OUT' && new Date(l.timestamp).toDateString() === today));
  }, [currentUser.id]);

  const handleClockInStart = () => {
    if (todayIn) return;
    
    if (geo.loading) {
        alert("Please wait for GPS location to initialize...");
        return;
    }

    // Require location strictly
    if (!geo.lat || !geo.lng) {
        alert("GPS Location is required to Clock In. Please check your permissions.");
        return;
    }

    setShowCamera(true);
  };

  const handlePhotoCaptured = (photo: string) => {
    setShowCamera(false);
    
    // Verify location again (defensive)
    if (!geo.lat || !geo.lng) {
        alert("Error: Location data missing during capture.");
        return;
    }

    // Determine final location name string
    let locationLabel = currentLocationName;
    if (!inRange) {
        locationLabel = `Remote (${geo.lat.toFixed(4)}, ${geo.lng.toFixed(4)})`;
    }

    const newLog: AttendanceLog = {
      uid: currentUser.id,
      name: currentUser.name,
      type: 'IN',
      timestamp: new Date().toISOString(),
      photo: photo,
      location: { lat: geo.lat, lng: geo.lng },
      locationName: locationLabel
    };

    addLog(newLog);
    setLogs(prev => [newLog, ...prev]);
    setTodayIn(newLog);
  };

  const handleClockOut = () => {
    if (!todayIn || todayOut) return;

    // Strict GPS Check for Clock Out
    if (geo.loading) {
        alert("Acquiring GPS Signal... Please wait a moment before clocking out.");
        return;
    }

    if (!geo.lat || !geo.lng) {
        alert("GPS Location is required to Clock Out. Please ensure your location is on.");
        return;
    }

    let locationLabel = currentLocationName;
    if (!inRange && geo.lat && geo.lng) {
         locationLabel = `Remote (${geo.lat.toFixed(4)}, ${geo.lng.toFixed(4)})`;
    }

    const newLog: AttendanceLog = {
      uid: currentUser.id,
      name: currentUser.name,
      type: 'OUT',
      timestamp: new Date().toISOString(),
      location: (geo.lat && geo.lng) ? { lat: geo.lat, lng: geo.lng } : undefined,
      locationName: locationLabel
    };

    addLog(newLog);
    setLogs(prev => [newLog, ...prev]);
    setTodayOut(newLog);
  };

  const handleRequestSubmit = (req: UserRequest) => {
      addRequest(req);
      setShowRequest(false);
      alert("Request submitted successfully. Waiting for Admin approval.");
  };

  const getStatusContent = () => {
    if (geo.loading) {
      return (
        <div className="flex items-center justify-center text-gray-500 gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Locating Satellite...</span>
        </div>
      );
    }
    if (geo.error) {
      return (
        <div className="flex items-center justify-center text-amber-600 gap-2">
            <MapPinOff className="w-4 h-4" />
            <span>GPS Unavailable - Remote Mode</span>
        </div>
      );
    }
    if (inRange) {
        return (
            <div className="flex items-center justify-center text-green-700 gap-2">
                <Building2 className="w-4 h-4" />
                <span>{currentLocationName} ({Math.round(distance || 0)}m)</span>
            </div>
        );
    }
    
    return (
        <div className="flex items-center justify-center text-blue-600 gap-2">
            <Globe className="w-4 h-4" />
            <span>{currentLocationName}</span>
        </div>
    );
  };

  const getStatusClass = () => {
      if (geo.loading) return "bg-gray-100 border-gray-200";
      if (geo.error) return "bg-amber-50 border-amber-200";
      if (inRange) return "bg-green-50 border-green-200";
      return "bg-blue-50 border-blue-200";
  };

  // UI Logic helpers
  const canClockIn = !todayIn;
  const canClockOut = !!todayIn && !todayOut;
  const isDayComplete = !!todayIn && !!todayOut;
  
  // Determine if we should show a loading state on the Clock Out button
  const isClockOutLoading = canClockOut && geo.loading;

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Toast Notification */}
      {notification && (
        <div className="absolute top-4 left-4 right-4 z-50 animate-slide-in">
            <div className="bg-slate-800 text-white p-4 rounded-xl shadow-2xl flex items-center justify-between border-l-4 border-blue-500">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-500 p-2 rounded-full">
                        <Bell className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <p className="font-bold text-sm">Notification</p>
                        <p className="text-xs text-slate-300">{notification}</p>
                    </div>
                </div>
                <button onClick={() => setNotification(null)}>
                    <X className="w-5 h-5 text-slate-400 hover:text-white" />
                </button>
            </div>
        </div>
      )}

      {/* Modals */}
      {showCamera && (
        <CameraCapture 
            onCapture={handlePhotoCaptured} 
            onClose={() => setShowCamera(false)}
            geo={geo} // Pass geo data
            locationName={currentLocationName} // Pass location name
        />
      )}
      {showRequest && (
        <RequestModal 
            uid={currentUser.id}
            userName={currentUser.name}
            jobTitle={currentUser.jobTitle}
            onSubmit={handleRequestSubmit}
            onClose={() => setShowRequest(false)}
        />
      )}

      {/* Header */}
      <div className="bg-blue-600 p-6 text-white rounded-t-2xl relative overflow-hidden">
        <div className="relative z-10 flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500 p-2 rounded-lg">
                <UserIcon className="w-6 h-6 text-blue-50" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">{currentUser.name}</h1>
              <p className="text-blue-200 text-xs font-mono mb-0.5">ID: {currentUser.id}</p>
              {currentUser.jobTitle && (
                  <div className="flex items-center gap-1 bg-blue-700/50 px-2 py-0.5 rounded text-[10px] w-fit">
                      <Briefcase className="w-3 h-3 text-blue-200" />
                      <span className="uppercase tracking-wide font-semibold">{currentUser.jobTitle}</span>
                  </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Header Notification Icon */}
            {onSwitchToAdmin && (
                 <button 
                    onClick={onSwitchToAdmin}
                    className="relative p-2 bg-blue-700/50 rounded-lg hover:bg-blue-700 transition"
                    title="Switch to Admin Portal"
                >
                    <ShieldCheck className="w-4 h-4 text-white" />
                </button>
            )}
            <button 
                onClick={onViewMessages}
                className="relative p-2 bg-blue-700/50 rounded-lg hover:bg-blue-700 transition"
            >
                <Bell className="w-4 h-4 text-white" />
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-blue-600"></span>
                )}
            </button>
            <button
                onClick={onLogout}
                className="text-xs bg-blue-700 hover:bg-blue-800 px-3 py-2 rounded-lg transition flex items-center gap-1 shadow-sm h-full"
            >
                <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="mt-8 text-center relative z-10">
            <p className="text-blue-200 text-xs tracking-widest uppercase mb-1">Current Time</p>
            <div className="text-4xl font-mono font-bold tracking-wider drop-shadow-md">
            {liveTime}
            </div>
        </div>
        {/* Decorative Circle */}
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-blue-500 rounded-full opacity-20 blur-xl"></div>
      </div>

      <div className="p-6 flex-1 flex flex-col">
        {/* Status Bar */}
        <div className={`mb-6 p-3 rounded-xl border text-sm font-semibold transition-colors duration-300 ${getStatusClass()}`}>
          {getStatusContent()}
        </div>

        {/* Action Buttons */}
        {!isAdmin ? (
            <div className="grid grid-cols-2 gap-4 mb-4">
              <button
                onClick={handleClockInStart}
                disabled={!canClockIn}
                className={`
                    group relative overflow-hidden p-4 rounded-2xl shadow-lg transition-all transform flex flex-col items-center justify-center gap-2
                    ${canClockIn 
                        ? 'bg-gradient-to-br from-green-500 to-green-600 text-white hover:shadow-green-200 cursor-pointer active:scale-95' 
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-70'}
                `}
              >
                <div className={`p-3 rounded-full ${canClockIn ? 'bg-green-400/30' : 'bg-gray-200'}`}>
                    {canClockIn ? <Camera className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                </div>
                <div className="flex flex-col items-center">
                    <span className="font-bold text-lg">CLOCK IN</span>
                    {todayIn && <span className="text-[10px] opacity-80">Done: {new Date(todayIn.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                </div>
              </button>

              <button
                onClick={handleClockOut}
                disabled={!canClockOut || isClockOutLoading}
                className={`
                    group relative overflow-hidden p-4 rounded-2xl shadow-lg transition-all transform flex flex-col items-center justify-center gap-2
                    ${canClockOut 
                        ? 'bg-gradient-to-br from-red-500 to-red-600 text-white hover:shadow-red-200 cursor-pointer active:scale-95' 
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-70'}
                `}
              >
                <div className={`p-3 rounded-full ${canClockOut ? 'bg-red-400/30' : 'bg-gray-200'}`}>
                    {isClockOutLoading ? <Loader2 className="w-6 h-6 animate-spin text-red-600" /> : <LogOut className="w-6 h-6" />}
                </div>
                <div className="flex flex-col items-center">
                    <span className="font-bold text-lg">
                        {isClockOutLoading ? 'LOCATING...' : 'CLOCK OUT'}
                    </span>
                    {todayOut && <span className="text-[10px] opacity-80">Done: {new Date(todayOut.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                </div>
              </button>
            </div>
        ) : (
             <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-2xl flex flex-col items-center text-center gap-2 shadow-sm">
                <div className="bg-blue-100 p-3 rounded-full">
                    <ShieldCheck className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-blue-900">Administrator Access</h3>
                    <p className="text-xs text-blue-600 mt-1">Attendance tracking is disabled for your role.<br/>You can still manage your requests and view personal history.</p>
                </div>
            </div>
        )}

        {/* Action Links */}
        <div className="space-y-3 mb-6">
            <div className="flex gap-2">
                 <button 
                    onClick={onViewMessages}
                    className="flex-1 py-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl text-sm font-semibold hover:bg-blue-100 transition flex items-center justify-center gap-2 shadow-sm relative"
                >
                    <Bell className="w-4 h-4" />
                    Status
                    {unreadCount > 0 && (
                        <div className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-md animate-pulse">
                            {unreadCount}
                        </div>
                    )}
                </button>
                 <button 
                    onClick={onViewHistory}
                    className="flex-1 py-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl text-sm font-semibold hover:bg-blue-100 transition flex items-center justify-center gap-2 shadow-sm relative"
                >
                    <History className="w-4 h-4" />
                    History
                </button>
            </div>

            <button 
                onClick={() => setShowRequest(true)}
                className="w-full py-3 bg-white border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition flex items-center justify-center gap-2 shadow-sm"
            >
                <FileQuestion className="w-4 h-4" />
                Submit Request (Leave/OT)
            </button>
        </div>

        {!isAdmin && isDayComplete && (
            <div className="mb-4 p-3 bg-green-50 text-green-700 text-center rounded-lg border border-green-100 text-sm font-medium flex items-center justify-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Shift Complete. See you tomorrow!
            </div>
        )}

        {/* Activity Log */}
        <div className="flex-1 bg-gray-50 rounded-2xl p-4 border border-gray-100 overflow-hidden flex flex-col">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                Today's Activity
            </h3>
            <div className="overflow-y-auto flex-1 pr-1 custom-scrollbar">
                {logs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm italic">
                        <span>No records found today.</span>
                    </div>
                ) : (
                    <ul className="space-y-3">
                        {logs.map((log, index) => (
                            <li key={index} className="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${log.type === 'IN' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                        {log.type === 'IN' ? <Clock className="w-5 h-5"/> : <LogOut className="w-5 h-5"/>}
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm text-gray-700">{log.type === 'IN' ? 'Clocked In' : 'Clocked Out'}</div>
                                        <div className="text-gray-400 text-xs font-mono">{new Date(log.timestamp).toLocaleTimeString()}</div>
                                        {log.locationName ? (
                                             <div className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5 font-semibold">
                                                <Building2 className="w-3 h-3" />
                                                {log.locationName}
                                            </div>
                                        ) : log.location ? (
                                            <div className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                                                <MapPin className="w-3 h-3" />
                                                {log.location.lat.toFixed(5)}, {log.location.lng.toFixed(5)}
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                                {log.photo && (
                                    <div className="w-10 h-10 rounded-lg overflow-hidden border border-gray-200">
                                        <img src={log.photo} alt="Verify" className="w-full h-full object-cover" />
                                    </div>
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