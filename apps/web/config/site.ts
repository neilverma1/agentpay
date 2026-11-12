import { ShieldCheck, SquarePen } from 'lucide-react';
import { Metadata } from 'next';
import { BASE_URL, DOMAIN, SITE_DESCRIPTION, SITE_KEYWORDS, SITE_NAME } from './site-shared';

export const siteConfig: Metadata = {
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  icons: {
    icon: [{ url: '/favicon.ico' }, { url: '/icon.png', type: 'image/png' }],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
  metadataBase: new URL(BASE_URL),
  keywords: SITE_KEYWORDS,
  openGraph: {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: BASE_URL,
    siteName: SITE_NAME,
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
};

export type SidebarCollapsibleMode = 'offcanvas' | 'icon' | 'none';

export type LayoutConfig = {
  showHeader: boolean;
  sidebarCollapsible: SidebarCollapsibleMode;
};

export const config = {
  name: SITE_NAME,
  description: SITE_DESCRIPTION,
  baseUrl: BASE_URL,
  domain: DOMAIN,
  layout: {
    showHeader: true, // set --header-height in globals.css (custom or default: 3.5rem) when true, 0rem when false)
    sidebarCollapsible: 'icon',
  } as LayoutConfig,
  providers: [
    {
      id: 'google',
      name: 'Google',
    },
  ],
  nav: [
    {
      title: 'New Chat',
      href: '/chat',
      icon: SquarePen,
    },
    {
      title: 'Audit Logs',
      href: '/audit',
      icon: ShieldCheck,
    },
  ],
};
