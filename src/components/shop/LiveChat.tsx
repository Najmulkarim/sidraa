import Script from 'next/script';

/**
 * tawk.to chat, when an ID is saved in Settings → Storefront. Its script loads after
 * the page and when the browser is idle, so it never holds up the first paint. On
 * phones the bubble sits above the bottom tab bar.
 */
export function LiveChat({ id }: { id: string }) {
  if (!/^[a-f0-9]{24}\/[a-z0-9]{1,40}$/i.test(id)) return null;
  return (
    <Script id="live-chat" strategy="afterInteractive">
      {`window.Tawk_API=window.Tawk_API||{};Tawk_API.customStyle={visibility:{mobile:{position:'br',xOffset:12,yOffset:76}}};window.Tawk_LoadStart=new Date();(function(){var go=function(){var s=document.createElement('script');s.async=true;s.src='https://embed.tawk.to/${id}';s.charset='UTF-8';s.setAttribute('crossorigin','*');document.head.appendChild(s)};var idle=function(){(window.requestIdleCallback||function(c){setTimeout(c,1)})(go,{timeout:3000})};document.readyState==='complete'?idle():window.addEventListener('load',idle,{once:true})})();`}
    </Script>
  );
}
