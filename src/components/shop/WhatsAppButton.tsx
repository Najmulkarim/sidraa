import { Icon } from '../icons';

/** Floating "chat on WhatsApp" button (Settings → Storefront). */
export function WhatsAppButton({ phone, raised }: { phone: string; raised: boolean }) {
  const digits = phone.replace(/\D/g, '');
  const intl = digits.startsWith('880') ? digits : digits.startsWith('0') ? `88${digits}` : digits;
  return (
    <a
      href={`https://wa.me/${intl}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className={`fixed left-4 z-20 grid h-12 w-12 place-items-center rounded-full bg-[#25d366] text-white shadow-lg transition hover:scale-105 ${raised ? 'bottom-[calc(5.25rem+env(safe-area-inset-bottom))] md:bottom-6' : 'bottom-6'}`}
    >
      <Icon name="whatsapp" size={24} />
    </a>
  );
}
