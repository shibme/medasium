import { useSyncExternalStore } from 'react';

export function useMediaQuery(q: string) {
  return useSyncExternalStore(
    (cb) => { const m = matchMedia(q); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb); },
    () => matchMedia(q).matches,
    () => false,
  );
}
export const useIsDesktop = () => useMediaQuery('(min-width: 768px)');
