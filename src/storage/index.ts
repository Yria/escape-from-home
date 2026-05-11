import type { UserInfo, BookingTask } from '../core/types';
import type { PageAction, PageActionStep } from '../core/autofill';

const KEYS = {
  USER_INFO: 'efh_user_info',
  SELECTED_PROVIDERS: 'efh_selected_providers',
  BOOKING_TASKS: 'efh_booking_tasks',
  PENDING_NOTIF: 'efh_pending_notif',
} as const;

// === Pending Notification Data ===
export interface PendingNotifData {
  steps?: PageActionStep[];
  actions?: PageAction[];
  url?: string;
}

export const savePendingNotif = async (
  taskId: string,
  data: PendingNotifData,
): Promise<void> => {
  const result = await chrome.storage.local.get(KEYS.PENDING_NOTIF);
  const map = (result[KEYS.PENDING_NOTIF] as Record<string, PendingNotifData> | undefined) ?? {};
  map[taskId] = data;
  await chrome.storage.local.set({ [KEYS.PENDING_NOTIF]: map });
};

export const loadPendingNotif = async (
  taskId: string,
): Promise<PendingNotifData | null> => {
  const result = await chrome.storage.local.get(KEYS.PENDING_NOTIF);
  const map = (result[KEYS.PENDING_NOTIF] as Record<string, PendingNotifData> | undefined) ?? {};
  return map[taskId] ?? null;
};

export const removePendingNotif = async (taskId: string): Promise<void> => {
  const result = await chrome.storage.local.get(KEYS.PENDING_NOTIF);
  const map = (result[KEYS.PENDING_NOTIF] as Record<string, PendingNotifData> | undefined) ?? {};
  delete map[taskId];
  await chrome.storage.local.set({ [KEYS.PENDING_NOTIF]: map });
};

// === User Info ===
export const saveUserInfo = async (info: UserInfo): Promise<void> => {
  await chrome.storage.local.set({ [KEYS.USER_INFO]: info });
};

export const loadUserInfo = async (): Promise<UserInfo | null> => {
  const result = await chrome.storage.local.get(KEYS.USER_INFO);
  return (result[KEYS.USER_INFO] as UserInfo | undefined) ?? null;
};

// === Selected Providers ===
export const saveSelectedProviders = async (
  ids: string[],
): Promise<void> => {
  await chrome.storage.local.set({ [KEYS.SELECTED_PROVIDERS]: ids });
};

export const loadSelectedProviders = async (): Promise<string[]> => {
  const result = await chrome.storage.local.get(KEYS.SELECTED_PROVIDERS);
  return (result[KEYS.SELECTED_PROVIDERS] as string[] | undefined) ?? [];
};

// === Booking Tasks ===
export const saveBookingTasks = async (tasks: BookingTask[]): Promise<void> => {
  await chrome.storage.local.set({ [KEYS.BOOKING_TASKS]: tasks });
};

export const loadBookingTasks = async (): Promise<BookingTask[]> => {
  const result = await chrome.storage.local.get(KEYS.BOOKING_TASKS);
  return (result[KEYS.BOOKING_TASKS] as BookingTask[] | undefined) ?? [];
};

export const clearBookingTasks = async (): Promise<void> => {
  await chrome.storage.local.remove(KEYS.BOOKING_TASKS);
};
