export type JobTitle = 'Programmer' | 'Technician' | 'Operator' | 'Administrator';

export interface User {
  id: string;
  name: string;
  password?: string;
  isDefaultPass: boolean;
  role?: 'EMPLOYEE' | 'ADMIN'; // System Role
  jobTitle?: JobTitle; // Job Position
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

// Retain alias for backward compatibility if needed, though we will update usages
export type CorrectionRequest = UserRequest; 

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