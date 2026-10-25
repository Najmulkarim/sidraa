import { HomeView } from '@/components/shop/home/HomeView';
import { getSettings } from '@/lib/catalog';
import { SITE_URL } from '@/lib/env';
import { isTheme } from '@/lib/home-sections';

// Statically cached; admin saves call revalidatePath('/', 'layout').
export const revalidate = 300;

/** The live home page: the theme chosen in Admin › Homepage. */
export default async function HomePage() {
  const settings = await getSettings();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'OnlineStore',
    name: settings.store_name,
    url: SITE_URL,
    ...(settings.tagline ? { description: settings.tagline } : {}),
    ...(settings.phone ? { telephone: settings.phone } : {}),
    ...(settings.email ? { email: settings.email } : {}),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <HomeView theme={isTheme(settings.home_theme) ? settings.home_theme : 'luxora'} />
    </>
  );
}
