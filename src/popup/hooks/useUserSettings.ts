import { useState, useEffect, useCallback } from 'react';
import type { UserInfo } from '../../core/types';
import { loadUserInfo, saveUserInfo } from '../../storage';

export const useUserSettings = () => {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserInfo().then((info) => {
      setUserInfo(info);
      setLoading(false);
    });
  }, []);

  const save = useCallback(async (info: UserInfo) => {
    await saveUserInfo(info);
    setUserInfo(info);
  }, []);

  return { userInfo, loading, save };
};
