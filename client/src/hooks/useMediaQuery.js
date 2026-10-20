import { useSyncExternalStore } from 'react';

// CSS medya sorgusunun anlık sonucu; ekran döndürülünce ya da pencere
// boyutu değişince güncellenir.
export default function useMediaQuery(query) {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}
