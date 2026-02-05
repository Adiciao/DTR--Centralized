
export type JobTitle = 'Programmer' | 'Technician' | 'Operator' | 'Administrator';

export interface User {
  id: string;
  name: string;
  password?: string;
  isDefaultPass: boolean;
  role?: 'EMPLOYEE' | 'ADMIN'; // System Role
  jobTitle?: JobTitle; // Job Position
  leaveBalances?: Record<LeaveType, number>;
}

export type ClockType = 'IN' | 'OUT';

export interface AttendanceLog {
  uid: string;
  name: string;
  type: ClockType;
  timestamp: string;
  photo?: string;
  location?: { lat: number; lng: number };
  locationName?: string; // Name of the company/building
}

export type RequestCategory = 'CORRECTION' | 'LEAVE' | 'OT';
export type LeaveType = 'SICK' | 'VACATION' | 'MATERNITY' | 'EMERGENCY' | 'OTHER';
export type RequestStatus = 'PENDING' | 'PROCESSING' | 'APPROVED' | 'REJECTED';

export interface UserRequest {
  id: string;
  uid: string;
  name: string;
  category: RequestCategory;
  
  // Correction Specifics
  correctionType?: 'MISSED_IN' | 'MISSED_OUT' | 'WRONG_TIME';
  
  // Leave Specifics
  leaveType?: LeaveType;
  startDate?: string;
  endDate?: string;

  // OT Specifics
  otDate?: string;
  otHours?: number;

  // Shared
  date: string; // Incident date or Start date
  reason: string;
  status: RequestStatus;
  timestamp: string; // Created At
  isRead: boolean; // True if unread by Employee (status changed by Admin), False otherwise
  jobTitle?: string; // Snapshot of job title at time of request
}

export interface Message {
  id: string;
  fromId: string;
  fromName: string;
  toId: string; // 'ALL' or specific User ID
  subject: string;
  content: string;
  timestamp: string;
  isRead: boolean;
}

export interface Geofence {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number; // in meters
}

export interface Shift {
  id: string;
  name: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  gracePeriod: number; // minutes
}

export interface Holiday {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  type: 'REGULAR' | 'SPECIAL';
}

export interface SystemSettings {
  geofences: Geofence[];
  shifts: Shift[];
  holidays: Holiday[];
  breakDuration: number; // in minutes
  allowRemoteClockIn: boolean;
  deviceRestrictionEnabled: boolean;
}

export enum ScreenState {
  LOGIN = 'LOGIN',
  CHANGE_PASSWORD = 'CHANGE_PASSWORD',
  DASHBOARD = 'DASHBOARD',
  HISTORY = 'HISTORY',
  MESSAGES = 'MESSAGES',
  ADMIN_DASHBOARD = 'ADMIN_DASHBOARD'
}

export interface GeoState {
  lat: number | null;
  lng: number | null;
  accuracy: number | null; // Accuracy in meters
  error: string | null;
  loading: boolean;
}
