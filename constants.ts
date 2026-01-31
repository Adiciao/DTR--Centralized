export const OFFICE_COORDS = {
  lat: 14.5995,
  lng: 120.9842
};

export interface CompanyLocation {
  name: string;
  lat: number;
  lng: number;
}

export const AFFILIATED_COMPANIES: CompanyLocation[] = [
  { name: 'Main Office', lat: 14.5995, lng: 120.9842 },
  { name: 'RCBC Plaza', lat: 14.5604, lng: 121.0169 },
  { name: 'Zuellig Building', lat: 14.5594, lng: 121.0253 },
  { name: 'City of Dreams', lat: 14.5235, lng: 120.9932 }
];

export const ALLOWED_RADIUS_METERS = 300;
export const DEFAULT_PASSWORD = 'admin123';

export const MOCK_USERS_KEY = 'users_db_v2'; // Bump version to force reset
export const ATTENDANCE_LOGS_KEY = 'attendance_logs';
export const SESSION_KEY = 'activeUser';