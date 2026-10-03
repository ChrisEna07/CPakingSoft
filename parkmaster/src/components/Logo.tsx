'use client';

interface LogoProps {
  className?: string;
  variant?: 'full' | 'icon' | 'ticket';
  size?: number;
}

export function Logo({ className = '', variant = 'full', size = 44 }: LogoProps) {
  if (variant === 'icon') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <rect width="64" height="64" rx="16" fill="url(#gradLogoIcon)" />
        <rect x="1" y="1" width="62" height="62" rx="15" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
        {/* Isotipo: P de Parking estilizada con perno/nodo inteligente */}
        <path
          d="M22 46V18H36C42.6274 18 48 23.3726 48 30C48 36.6274 42.6274 42 36 42H30V46H22Z"
          fill="white"
        />
        <circle cx="35" cy="30" r="5" fill="#D97706" />
        <path d="M32 14H38" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" />
        <defs>
          <linearGradient id="gradLogoIcon" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1E3A8A" />
            <stop offset="1" stopColor="#0F172A" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  if (variant === 'ticket') {
    // Versión monocromática de alto contraste optimizada para impresoras térmicas
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <rect width="64" height="64" rx="12" fill="#000000" />
        <path
          d="M22 46V18H36C42.6274 18 48 23.3726 48 30C48 36.6274 42.6274 42 36 42H30V46H22Z"
          fill="#FFFFFF"
        />
        <circle cx="35" cy="30" r="5" fill="#000000" />
        <path d="M32 14H38" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  }

  // Variante 'full' (Logo completo con Isotipo + Tipografía Vectorial)
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
      >
        <rect width="64" height="64" rx="16" fill="url(#gradLogoFull)" />
        <rect x="1" y="1" width="62" height="62" rx="15" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
        <path
          d="M22 46V18H36C42.6274 18 48 23.3726 48 30C48 36.6274 42.6274 42 36 42H30V46H22Z"
          fill="white"
        />
        <circle cx="35" cy="30" r="5" fill="#D97706" />
        <path d="M32 14H38" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" />
        <defs>
          <linearGradient id="gradLogoFull" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1E3A8A" />
            <stop offset="1" stopColor="#0F172A" />
          </linearGradient>
        </defs>
      </svg>
      <div className="flex flex-col text-left leading-none">
        <span className="text-2xl font-black tracking-tight" style={{ color: '#1E3A8A' }}>
          CParking<span style={{ color: '#D97706' }}>Soft</span>
        </span>
        <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mt-1">
          Control &amp; Liquidación
        </span>
      </div>
    </div>
  );
}
