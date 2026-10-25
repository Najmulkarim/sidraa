import type { Metadata } from 'next';
import { CheckoutForm } from '@/components/shop/CheckoutForm';
import { getSettings, getZones } from '@/lib/catalog';
import { paymentOptions, readPaymentSettings } from '@/lib/payments/settings';

export const metadata: Metadata = { title: 'Checkout', robots: { index: false } };

export default async function CheckoutPage() {
  const [settings, zones, pay] = await Promise.all([getSettings(), getZones(), readPaymentSettings()]);
  const payments = paymentOptions(pay);
  return (
    <div className="container-page py-10">
      <header className="mb-8">
        <p className="eyebrow">{payments.bkash.manual || payments.bkash.merchant || payments.nagad.manual || payments.nagad.merchant ? 'Secure checkout' : 'Cash on delivery'}</p>
        <h1 className="font-display text-4xl font-semibold">Checkout</h1>
      </header>
      {zones.length === 0 ? (
        <p className="card p-6 text-muted">Delivery areas are not set up yet. Please check back soon.</p>
      ) : (
        <CheckoutForm zones={zones} codTerms={settings.cod_terms} returnDays={settings.return_policy_days} couponsEnabled={settings.coupons_enabled} payments={payments} />
      )}
    </div>
  );
}
