import { useEffect, useState } from 'react';
import { signProductPhotoUrl } from '@/lib/queries';

const fallback =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" rx="10" fill="#e3f3e9"/><g fill="none" stroke="#1f8a4c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 16l6 8 8-10 8 10 6-8" transform="translate(1,3)"/></g></svg>`,
  );

export function ProductPhoto({
  src,
  alt,
  className = '',
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!src) {
      setUrl(null);
      return;
    }
    if (src.startsWith('http')) {
      setUrl(src);
      return;
    }
    signProductPhotoUrl(src).then((signed) => {
      if (alive) setUrl(signed);
    });
    return () => {
      alive = false;
    };
  }, [src]);

  if (!url) {
    return <img src={fallback} alt={alt} className={`${className} object-cover`} />;
  }
  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      className={`${className} object-cover`}
      onError={(e) => {
        (e.target as HTMLImageElement).src = fallback;
      }}
    />
  );
}
