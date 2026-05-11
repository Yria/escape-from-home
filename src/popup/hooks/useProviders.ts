import { useState, useEffect, useCallback } from 'react';
import type { Theme, TimeSlot } from '../../core/types';
import type { ProviderAdapter } from '../../providers/types';
import { getAllProviders } from '../../providers/registry';

export const useProviders = () => {
  const [providers] = useState<ProviderAdapter[]>(() => getAllProviders());
  const [themes, setThemes] = useState<Theme[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loadingThemes, setLoadingThemes] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // 전체 업체의 테마 목록 로드
  const fetchAllThemes = useCallback(async () => {
    setLoadingThemes(true);
    try {
      const results = await Promise.allSettled(
        providers.map((p) => p.fetchThemes()),
      );
      const allThemes = results
        .filter(
          (r): r is PromiseFulfilledResult<Theme[]> => r.status === 'fulfilled',
        )
        .flatMap((r) => r.value);
      setThemes(allThemes);
    } finally {
      setLoadingThemes(false);
    }
  }, [providers]);

  // 특정 테마의 시간 슬롯 조회
  const fetchSlots = useCallback(
    async (themeId: string, date: string) => {
      const providerId = themeId.split(':')[0];
      const provider = providers.find((p) => p.meta.id === providerId);
      if (!provider) return;

      setLoadingSlots(true);
      try {
        const slots = await provider.fetchTimeSlots(themeId, date);
        setTimeSlots((prev) => [
          ...prev.filter((s) => s.themeId !== themeId),
          ...slots,
        ]);
      } finally {
        setLoadingSlots(false);
      }
    },
    [providers],
  );

  useEffect(() => {
    fetchAllThemes();
  }, [fetchAllThemes]);

  return {
    providers,
    themes,
    timeSlots,
    loadingThemes,
    loadingSlots,
    fetchAllThemes,
    fetchSlots,
  };
};
