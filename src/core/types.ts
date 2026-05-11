// === Provider ===
export type ProviderId = string;

export interface ProviderMeta {
  id: ProviderId;
  name: string;
  logoUrl?: string;
  websiteUrl: string;
  requiredFields: UserFieldKey[];
}

// === Theme ===
export interface Theme {
  id: string;
  providerId: ProviderId;
  name: string;
  difficulty?: number;
  genre?: string;
  minPlayers: number;
  maxPlayers: number;
  duration: number;
  imageUrl?: string;
  branchName?: string;
}

// === TimeSlot ===
export interface TimeSlot {
  themeId: string;
  datetime: string; // ISO 8601
  available: boolean;
  remainingSlots?: number;
}

// === Booking ===
export interface BookingRequest {
  themeId: string;
  startDateTime: string; // ISO 8601
  endDateTime: string;   // ISO 8601
  userInfo: UserInfo;
  playerCount: number;
}

export type BookingResultStatus =
  | 'success'
  | 'failed'
  | 'already_booked'
  | 'sold_out';

export interface BookingResult {
  status: BookingResultStatus;
  confirmationId?: string;
  message?: string;
}

// === User ===
export type UserFieldKey = 'name' | 'phone' | 'email' | 'playerCount';

export interface UserInfo {
  name: string;
  phone: string;
  email?: string;
}

// === FoundSlot ===
export interface FoundSlot {
  id: string;           // dedup key: `${date}T${time}`
  date: string;         // "YYYY-MM-DD"
  time: string;         // "HH:MM"
  hasApi: boolean;      // API 직접 예약 가능 여부
  bookingUrl?: string;  // autofill 또는 수동 예약용 URL
}

// === BookingTask ===
export type BookingTaskStatus =
  | 'pending'
  | 'attempting'
  | 'success'
  | 'failed'
  | 'cancelled';

export interface BookingTask {
  id: string;
  providerId: ProviderId;
  themeId: string;
  themeName: string;
  imageUrl?: string;
  startDateTime: string; // ISO 8601 — 탐색 시작 날짜시간
  endDateTime: string;   // ISO 8601 — 탐색 종료 날짜시간
  playerCount: number;
  status: BookingTaskStatus;
  retryCount: number;
  maxRetries: number;
  startedAt: string; // ISO 8601 — 예약 세션 시작 시각
  lastAttemptAt?: string;
  result?: BookingResult;
  bookingUrl?: string; // 빈자리 발견 시 예약 페이지 URL
  foundSlots: FoundSlot[];
}
