import { User, AttendanceLog, UserRequest } from '../types';
import { MOCK_USERS_KEY, ATTENDANCE_LOGS_KEY, DEFAULT_PASSWORD } from '../constants';

const REQUESTS_KEY = 'correction_requests';

// Initialize mock data if not exists
export const initDB = () => {
  // For development/demo purposes, we want to ensure the new fields appear.
  // In a real app we'd migrate. Here we can check if the first user has a jobTitle.
  const stored = localStorage.getItem(MOCK_USERS_KEY);
  let shouldReset = false;
  if (!stored) {
    shouldReset = true;
  } else {
    const parsed = JSON.parse(stored);
    if (parsed.length > 0 && !parsed[0].jobTitle) {
      shouldReset = true; // Reset to get new fields
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
  }
};

export const getUsers = (): User[] => {
  const data = localStorage.getItem(MOCK_USERS_KEY);
  return data ? JSON.parse(data) : [];
};

export const updateUser = (updatedUser: User) => {
  const users = getUsers();
  const index = users.findIndex(u => u.id === updatedUser.id);
  if (index !== -1) {
    users[index] = updatedUser;
    localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users));
  }
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