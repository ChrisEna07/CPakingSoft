import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { StoreProvider } from '@/lib/store';

export const metadata: Metadata = {
  title: 'CParkingSoft · Control Integral de Parqueaderos',
  description: 'Sistema integral de gestión de parqueaderos SaaS Multi-Tenant y Offline-First',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body><StoreProvider>{children}</StoreProvider></body>
    </html>
  );
}
