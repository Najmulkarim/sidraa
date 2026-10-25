import { CUSTOMER_LABEL, progressSteps, STATUS_HINT, type OrderStatus } from '@/lib/order-status';

export function StatusSteps({ status }: { status: OrderStatus }) {
  if (status === 'cancelled' || status === 'returned' || status === 'fake' || status === 'lost') {
    return (
      <div className="rounded-2xl bg-bad/5 p-4">
        <p className="font-semibold text-bad">{CUSTOMER_LABEL[status]}</p>
        <p className="text-sm text-muted">{STATUS_HINT[status]}</p>
      </div>
    );
  }
  const steps = progressSteps(status);
  return (
    <div className="space-y-3">
      <ol className="grid grid-cols-5 gap-1" aria-label="Order progress">
        {steps.map((s) => (
          <li key={s.key} className="space-y-2" aria-current={s.current ? 'step' : undefined}>
            <span className={`block h-1.5 rounded-full ${s.done ? 'bg-brand' : 'bg-line'}`} />
            <span className={`block text-xs ${s.current ? 'font-semibold text-ink' : 'text-muted'}`}>{s.label}</span>
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted">{STATUS_HINT[status]}</p>
    </div>
  );
}
