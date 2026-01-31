import { User, AttendanceLog, UserRequest } from '../types';
import { MOCK_USERS_KEY, ATTENDANCE_LOGS_KEY, DEFAULT_PASSWORD } from '../constants';

const REQUESTS_KEY = 'correction_requests';

// Initialize mock data if not exists
export const initDB = () => {
  const stored = localStorage.getItem(MOCK_USERS_KEY);
  let shouldReset = false;

  if (!stored) {
    shouldReset = true;
  } else {
    try {
      const parsed: User[] = JSON.parse(stored);
      // Reset if:
      // 1. Data is not an array
      // 2. Data is empty
      // 3. Old data schema (missing jobTitle)
      // 4. Critical ADMIN user is missing
      if (
        !Array.isArray(parsed) || 
        parsed.length === 0 || 
        (parsed.length > 0 && !parsed[0].jobTitle) ||
        !parsed.find(u => u.role === 'ADMIN')
      ) {
        shouldReset = true;
      }
    } catch (e) {
      // If JSON parse fails, reset
      shouldReset = true;
    }
  }

  if (shouldReset) {
    const mockUsers: User[] = [
      { id: '1001', name: 'Juan Cruz', password: DEFAULT_PASSWORD, isDefaultPass: true, role: 'EMPLOYEE', jobTitle: 'Programmer' },
      { id: '1002', name: 'Maria Santos', password: DEFAULT_PASSWORD, isDefaultPass: true, role: 'EMPLOYEE', jobTitle: 'Operator' },
      { id: '1003', name: 'Ben Tulfo', password: DEFAULT_PASSWORD, isDefaultPass: true, role: 'EMPLOYEE', jobTitle: 'Technician' },
      { id: 'ADMIN', name: 'Administrator', password: DEFAULT_PASSWORD, isDefaultPass: false, role: 'ADMIN', jobTitle: 'Administrator' }
    ];
    localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(mockUsers));
    console.log("Database initialized/reset with default users.");
  }
};

export const getUsers = (): User[] => {
  const data = localStorage.getItem(MOCK_USERS_KEY);
  return data ? JSON.parse(data) : [];
};

export const addUser = (user: User): boolean => {
  const users = getUsers();
  if (users.find(u => u.id === user.id)) {
    return false; // ID collision
  }
  users.push(user);
  localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users));
  return true;
};

export const updateUser = (updatedUser: User) => {
  const users = getUsers();
  const index = users.findIndex(u => u.id === updatedUser.id);
  if (index !== -1) {
    users[index] = updatedUser;
    localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users));
  }
};

export const deleteUser = (userId: string) => {
  const users = getUsers();
  const filtered = users.filter(u => u.id !== userId);
  localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(filtered));
};

export const getLogs = (): AttendanceLog[] => {
  const data = localStorage.getItem(ATTENDANCE_LOGS_KEY);
  return data ? JSON.parse(data) : [];
};

export const addLog = (log: AttendanceLog) => {
  const logs = getLogs();
  logs.unshift(log); // Add to beginning
  localStorage.setItem(ATTENDANCE_LOGS_KEY, JSON.stringify(logs));
};

export const getRequests = (): UserRequest[] => {
  const data = localStorage.getItem(REQUESTS_KEY);
  return data ? JSON.parse(data) : [];
};

export const addRequest = (req: UserRequest) => {
  const requests = getRequests();
  requests.unshift(req);
  localStorage.setItem(REQUESTS_KEY, JSON.stringify(requests));
};

export const updateRequest = (updatedReq: UserRequest) => {
  const requests = getRequests();
  const index = requests.findIndex(r => r.id === updatedReq.id);
  if (index !== -1) {
    requests[index] = updatedReq;
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(requests));
  }
};

export const markRequestsAsRead = (uid: string) => {
  const requests = getRequests();
  let changed = false;
  
  const updatedRequests = requests.map(req => {
    if (req.uid === uid && !req.isRead) {
      changed = true;
      return { ...req, isRead: true };
    }
    return req;
  });

  if (changed) {
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(updatedRequests));
  }
};

// --- BACKUP & RESTORE UTILS ---

export const exportDatabase = () => {
  const users = getUsers();
  const logs = getLogs();
  const requests = getRequests();
  
  const data = {
    users,
    logs,
    requests,
    version: 1,
    exportedAt: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `geoportal_backup_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const importDatabase = (file: File): Promise<{success: boolean, message: string}> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = e.target?.result as string;
        const data = JSON.parse(result);
        
        // Basic validation
        if (!data.users || !Array.isArray(data.users)) {
          resolve({ success: false, message: "Invalid backup file: Missing users data." });
          return;
        }

        // Restore
        localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(data.users));
        
        if (data.logs && Array.isArray(data.logs)) {
          localStorage.setItem(ATTENDANCE_LOGS_KEY, JSON.stringify(data.logs));
        }
        
        if (data.requests && Array.isArray(data.requests)) {
          localStorage.setItem(REQUESTS_KEY, JSON.stringify(data.requests));
        }

        resolve({ success: true, message: "Database restored successfully! Page will reload." });
      } catch (err) {
        resolve({ success: false, message: "Error parsing backup file." });
      }
    };
    reader.onerror = () => resolve({ success: false, message: "Error reading file." });
    reader.readAsText(file);
  });
};