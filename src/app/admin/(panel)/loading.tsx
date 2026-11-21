/**
 * Shown the moment a menu link is clicked, while the page is read on the
 * server, so the panel never looks stuck. The menu stays usable meanwhile.
 */
export default function AdminLoading() {
  return (
    <div className="space-y-5" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-brand/15">
        <div className="h-full w-1/3 animate-[admin-load_1s_ease-in-out_infinite] bg-brand" />
      </div>
      <div className="h-8 w-56 animate-pulse rounded-lg bg-white" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-white" />)}
      </div>
      <div className="space-y-2 rounded-2xl bg-white p-4">
        {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-soft" />)}
      </div>
      <style>{'@keyframes admin-load{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}'}</style>
    </div>
  );
}
