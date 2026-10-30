/**
 * The "Send to Sidraa" bookmark. Runs on the product page in the person's own
 * browser, re-reads that page's source (a loaded page no longer holds all its data
 * blocks) and sends it to the Import page, for sites that refuse our server.
 * The Import page must open during the click, or the browser blocks it as a popup.
 */
export function bookmarkletHref(origin: string): string {
  const target = `${origin}/admin/products/import`;
  const code = `(function(){var w=window.open(${JSON.stringify(target)});if(!w){alert('Allow popups for this site, then try again.');return}var u=location.href;function send(s){var n=0;var t=setInterval(function(){if(++n>60){clearInterval(t);return}w.postMessage({sidraaImport:1,url:u,source:s},${JSON.stringify(origin)})},500);window.addEventListener('message',function(e){if(e.origin===${JSON.stringify(origin)}&&e.data==='sidraa-received')clearInterval(t)})}fetch(u,{credentials:'include'}).then(function(r){return r.text()}).then(send).catch(function(){send(document.documentElement.outerHTML)})})()`;
  return `javascript:${encodeURIComponent(code)}`;
}
