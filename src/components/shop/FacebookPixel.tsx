'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * Meta (Facebook) Pixel. Rendered only when a Pixel ID is saved in
 * Settings → Facebook & tracking. PageView on first load and on every
 * client-side navigation. Purchase is also sent from the server
 * (Conversions API) with the same event id, so Meta counts it once.
 */
export function FacebookPixel({ pixelId }: { pixelId: string }) {
  const path = usePathname();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return; // the init snippet already sent the first PageView
    }
    (window as unknown as { fbq?: (...a: unknown[]) => void }).fbq?.('track', 'PageView');
  }, [path]);

  if (!/^\d{6,20}$/.test(pixelId)) return null;
  // The standard snippet, except that Facebook's ~200 KB script is fetched once the
  // page has loaded and the browser is idle (at most 2.5 s later), so it never holds
  // up the first paint. fbq() queues every event until then — none are lost.
  return (
    <>
      <Script id="fb-pixel" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];var go=function(){t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)};var idle=function(){(f.requestIdleCallback||function(c){setTimeout(c,1)})(go,{timeout:2500})};b.readyState==='complete'?idle():f.addEventListener('load',idle,{once:!0})}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId}');fbq('track','PageView');`}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img height="1" width="1" style={{ display: 'none' }} alt="" src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`} />
      </noscript>
    </>
  );
}
