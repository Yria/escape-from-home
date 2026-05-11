import type { Theme, TimeSlot } from '../../core/types';
import type { KeyescapeWorksTheme, KeyescapeRawTimeSlot } from './api';

const PROVIDER_ID = 'keyescape';

export const toTheme = (raw: KeyescapeWorksTheme): Theme => ({
  id: `${PROVIDER_ID}:${raw.zizumNum}:${raw.themeNum}:${raw.infoNum}`,
  providerId: PROVIDER_ID,
  name: raw.name,
  minPlayers: 2,
  maxPlayers: 6,
  duration: 60,
  imageUrl: raw.imageUrl,
  branchName: raw.branchName,
});

export const toTimeSlot = (
  themeId: string,
  date: string,
  raw: KeyescapeRawTimeSlot,
): TimeSlot => ({
  themeId,
  datetime: `${date}T${raw.hh.padStart(2, '0')}:${raw.mm.padStart(2, '0')}:00`,
  available: raw.enable === 'Y',
});

export { PROVIDER_ID };
