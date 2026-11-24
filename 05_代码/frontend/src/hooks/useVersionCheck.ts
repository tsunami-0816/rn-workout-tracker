import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/endpoints';
import type { VersionData } from '../api/types';
import { localBuildNo } from '../config';
import { queryKeys } from '../queryClient';

/**
 * 启动版本检查（D-12 / T-702）：
 * - 远端 buildNo > 本地 versionCode 才弹更新
 * - 版本接口不可达时静默跳过，不阻塞主界面
 */
export function useVersionCheck(): { update: VersionData | null; dismiss: () => void } {
  const [update, setUpdate] = useState<VersionData | null>(null);
  const versionQuery = useQuery({
    queryKey: queryKeys.version,
    queryFn: api.appVersion,
    staleTime: 0,
    retry: false
  });

  useEffect(() => {
    if (!versionQuery.data) return;
    if (versionQuery.data.buildNo > localBuildNo()) {
      setUpdate(versionQuery.data);
    }
  }, [versionQuery.data]);

  return {
    update,
    dismiss: () => setUpdate(null)
  };
}
