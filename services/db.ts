
import { User, AttendanceLog, UserRequest, SystemSettings, Geofence, Shift, Holiday, Message } from '../types';
import { DEFAULT_PASSWORD } from '../constants';

const firebaseConfig = {
  apiKey: "AIzaSyALEBOS1EMF94W-AUhdansAr3ld2k0aDzw",
  authDomain: "dtr--centralized.firebaseapp.com",
  projectId: "dtr--centralized",
  storageBucket: "dtr--centralized.firebasestorage.app",
  messagingSenderId: "434405363638",
  appId: "1:434405363638:web:b8594b41a1975d2da1fb17",
  measurementId: "G-LV0HWJF0DT"
};

const LS_KEYS = {
  USERS: 'geoportal_users_v11',
  LOGS: 'geoportal_logs_v11',
  REQS: 'geoportal_requests_v11',
  MESSAGES: 'geoportal_messages_v11',
  SETTINGS: 'geoportal_settings_v11',
  MODE: 'geoportal_db_mode_v11'
};

export const DEFAULT_USERS: User[] = [
  { id: '1001', name: 'Juan Cruz', password: DEFAULT_PASSWORD, isDefaultPass: true, role: 'EMPLOYEE', jobTitle: 'Programmer', leaveBalances: { SICK: 10, VACATION: 12, MATERNITY: 0, EMERGENCY: 5, OTHER: 0 } },
  { id: '1002', name: 'Maria Santos', password: DEFAULT_PASSWORD, isDefaultPass: true, role: 'EMPLOYEE', jobTitle: 'Operator', leaveBalances: { SICK: 10, VACATION: 12, MATERNITY: 105, EMERGENCY: 5, OTHER: 0 } },
  { id: '1003', name: 'Ben Tulfo', password: DEFAULT_PASSWORD, isDefaultPass: true, role: 'EMPLOYEE', jobTitle: 'Technician', leaveBalances: { SICK: 10, VACATION: 12, MATERNITY: 0, EMERGENCY: 5, OTHER: 0 } },
  { id: 'ADMIN', name: 'Administrator', password: DEFAULT_PASSWORD, isDefaultPass: false, role: 'ADMIN', jobTitle: 'Administrator' }
];

export const DEFAULT_SETTINGS: SystemSettings = {
  geofences: [{ id: '1', name: 'Main HQ', lat: 14.5995, lng: 120.9842, radius: 300 }],
  shifts: [{ id: '1', name: 'Day Shift', startTime: '08:00', endTime: '17:00', gracePeriod: 15 }],
  holidays: [],
  breakDuration: 60,
  allowRemoteClockIn: true,
  deviceRestrictionEnabled: false
};

declare var firebase: any;
let db: any = null;
let useFallback = true; 

const localStore = {
  get: (key: string) => {
    try {
      const val = localStorage.getItem(key);
      if (!val) return null;
      return JSON.parse(val);
    } catch (e) { return null; }
  },
  set: (key: string, val: any) => {
    localStorage.setItem(key, JSON.stringify(val));
  }
};

export const initDB = async () => {
  if (!localStore.get(LS_KEYS.USERS)) localStore.set(LS_KEYS.USERS, DEFAULT_USERS);
  if (!localStore.get(LS_KEYS.LOGS)) localStore.set(LS_KEYS.LOGS, []);
  if (!localStore.get(LS_KEYS.REQS)) localStore.set(LS_KEYS.REQS, []);
  if (!localStore.get(LS_KEYS.MESSAGES)) localStore.set(LS_KEYS.MESSAGES, []);
  if (!localStore.get(LS_KEYS.SETTINGS)) localStore.set(LS_KEYS.SETTINGS, DEFAULT_SETTINGS);

  try {
    const firebasePromise = new Promise((resolve, reject) => {
        if (typeof firebase !== 'undefined' && firebase.firestore) {
            try {
                if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
                const instance = firebase.firestore();
                resolve(instance);
            } catch (e) { reject(e); }
        } else {
            reject("SDK not found");
        }
    });

    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject("Connection Timeout"), 2000)
    );

    db = await Promise.race([firebasePromise, timeoutPromise]);
    useFallback = false;
    localStorage.setItem(LS_KEYS.MODE, 'cloud');
  } catch (e) {
    useFallback = true;
    localStorage.setItem(LS_KEYS.MODE, 'local');
  }
};

export const getUsers = async (): Promise<User[]> => {
  let cloudUsers: User[] = [];
  
  if (!useFallback && db) {
    try {
      const snap = await db.collection('users').get();
      if (!snap.empty) {
          cloudUsers = snap.docs.map((doc: any) => doc.data() as User);
      }
    } catch (e) { useFallback = true; }
  }
  
  const localUsers: User[] = localStore.get(LS_KEYS.USERS) || DEFAULT_USERS;

  const mergedMap = new Map<string, User>();
  localUsers.forEach(u => mergedMap.set(u.id.toUpperCase(), u));
  cloudUsers.forEach(u => mergedMap.set(u.id.toUpperCase(), u));
  
  DEFAULT_USERS.forEach(u => {
      if (!mergedMap.has(u.id.toUpperCase())) mergedMap.set(u.id.toUpperCase(), u);
  });

  const finalUsers = Array.from(mergedMap.values());
  localStore.set(LS_KEYS.USERS, finalUsers);
  return finalUsers;
};

export const forceResetUserPassword = async (userId: string) => {
    const defaultUser = DEFAULT_USERS.find(u => u.id.toUpperCase() === userId.toUpperCase());
    if (!defaultUser) return false;
    
    if (!useFallback && db) {
        try { await db.collection('users').doc(defaultUser.id).set(defaultUser); } catch(e){}
    }
    
    const users = await getUsers();
    const updated = users.map((u: User) => u.id.toUpperCase() === userId.toUpperCase() ? defaultUser : u);
    localStore.set(LS_KEYS.USERS, updated);
    return true;
};

export const addUser = async (user: User): Promise<boolean> => {
  const users = await getUsers();
  if (users.find(u => u.id.toUpperCase() === user.id.toUpperCase())) return false;
  
  if (!useFallback && db) {
      try { await db.collection('users').doc(user.id).set(user); } catch(e){}
  }
  
  const updatedUsers = [...users, user];
  localStore.set(LS_KEYS.USERS, updatedUsers);
  return true;
};

export const updateUser = async (updatedUser: User) => {
  if (!useFallback && db) {
      try { await db.collection('users').doc(updatedUser.id).set(updatedUser, { merge: true }); } catch(e){}
  }
  const users = await getUsers();
  const updated = users.map((u: User) => u.id.toUpperCase() === updatedUser.id.toUpperCase() ? updatedUser : u);
  localStore.set(LS_KEYS.USERS, updated);
};

export const deleteUser = async (userId: string) => {
  if (!useFallback && db) {
      try { await db.collection('users').doc(userId).delete(); } catch(e){}
  }
  const users = await getUsers();
  const updated = users.filter((u: User) => u.id.toUpperCase() !== userId.toUpperCase());
  localStore.set(LS_KEYS.USERS, updated);
};

export const getLogs = async (): Promise<AttendanceLog[]> => {
  if (!useFallback && db) {
    try {
      const snap = await db.collection('logs').orderBy('timestamp', 'desc').limit(500).get();
      const logs = snap.docs.map((doc: any) => doc.data() as AttendanceLog);
      localStore.set(LS_KEYS.LOGS, logs);
      return logs;
    } catch (e) { useFallback = true; }
  }
  return localStore.get(LS_KEYS.LOGS) || [];
};

export const addLog = async (log: AttendanceLog) => {
  if (!useFallback && db) {
      try { await db.collection('logs').add(log); } catch(e){}
  }
  const logs = localStore.get(LS_KEYS.LOGS) || [];
  localStore.set(LS_KEYS.LOGS, [log, ...logs]);
};

export const getRequests = async (): Promise<UserRequest[]> => {
  if (!useFallback && db) {
    try {
      const snap = await db.collection('requests').orderBy('timestamp', 'desc').get();
      const reqs = snap.docs.map((doc: any) => doc.data() as UserRequest);
      localStore.set(LS_KEYS.REQS, reqs);
      return reqs;
    } catch (e) { useFallback = true; }
  }
  return localStore.get(LS_KEYS.REQS) || [];
};

export const addRequest = async (req: UserRequest) => {
  if (!useFallback && db) {
      try { await db.collection('requests').doc(req.id).set(req); } catch(e){}
  }
  const reqs = localStore.get(LS_KEYS.REQS) || [];
  localStore.set(LS_KEYS.REQS, [req, ...reqs]);
};

export const updateRequest = async (updatedReq: UserRequest) => {
  if (!useFallback && db) {
      try { await db.collection('requests').doc(updatedReq.id).update(updatedReq); } catch(e){}
  }
  const reqs = localStore.get(LS_KEYS.REQS) || [];
  const updated = reqs.map((r: any) => r.id === updatedReq.id ? updatedReq : r);
  localStore.set(LS_KEYS.REQS, updated);
};

export const getMessages = async (): Promise<Message[]> => {
  if (!useFallback && db) {
    try {
      const snap = await db.collection('messages').orderBy('timestamp', 'desc').get();
      const msgs = snap.docs.map((doc: any) => doc.data() as Message);
      localStore.set(LS_KEYS.MESSAGES, msgs);
      return msgs;
    } catch (e) { useFallback = true; }
  }
  return localStore.get(LS_KEYS.MESSAGES) || [];
};

export const addMessage = async (msg: Message) => {
  if (!useFallback && db) {
    try { await db.collection('messages').doc(msg.id).set(msg); } catch (e) {}
  }
  const msgs = localStore.get(LS_KEYS.MESSAGES) || [];
  localStore.set(LS_KEYS.MESSAGES, [msg, ...msgs]);
};

export const markMessagesAsRead = async (userId: string) => {
  const msgs = await getMessages();
  const updated = msgs.map(m => (m.toId === userId || m.toId === 'ALL') ? { ...m, isRead: true } : m);
  localStore.set(LS_KEYS.MESSAGES, updated);
};

export const getSettings = async (): Promise<SystemSettings> => {
  if (!useFallback && db) {
    try {
      const doc = await db.collection('settings').doc('global').get();
      if (doc.exists) {
          const s = doc.data() as SystemSettings;
          localStore.set(LS_KEYS.SETTINGS, s);
          return s;
      }
    } catch (e) { useFallback = true; }
  }
  return localStore.get(LS_KEYS.SETTINGS) || DEFAULT_SETTINGS;
};

export const updateSettings = async (settings: SystemSettings) => {
  if (!useFallback && db) {
      try { await db.collection('settings').doc('global').set(settings); } catch(e){}
  }
  localStore.set(LS_KEYS.SETTINGS, settings);
};

export const exportDatabase = async () => {
  const users = await getUsers();
  const logs = await getLogs();
  const requests = await getRequests();
  const settings = await getSettings();
  const messages = await getMessages();
  const data = { users, logs, requests, settings, messages, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `geoportal_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
};

export const importDatabase = async (file: File): Promise<{success: boolean, message: string}> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        localStore.set(LS_KEYS.USERS, data.users || DEFAULT_USERS);
        localStore.set(LS_KEYS.LOGS, data.logs || []);
        localStore.set(LS_KEYS.REQS, data.requests || []);
        localStore.set(LS_KEYS.MESSAGES, data.messages || []);
        localStore.set(LS_KEYS.SETTINGS, data.settings || DEFAULT_SETTINGS);
        resolve({ success: true, message: "Import complete." });
      } catch (err) { resolve({ success: false, message: "Error parsing JSON." }); }
    };
    reader.readAsText(file);
  });
};

export const clearLocalStorage = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
};

export const markRequestsAsRead = async (uid: string) => {
  const all = localStore.get(LS_KEYS.REQS) || [];
  localStore.set(LS_KEYS.REQS, all.map((r: any) => r.uid === uid ? { ...r, isRead: true } : r));
};
