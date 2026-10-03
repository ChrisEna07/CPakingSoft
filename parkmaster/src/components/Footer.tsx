'use client';

export function Footer({ className = '' }: { className?: string }) {
  return (
    <footer className={`py-4 text-center text-xs text-slate-500 ${className}`}>
      <span>© 2026 CParkingSoft · Desarrollado por </span>
      <a
        href="https://christian-romero.vercel.app/"
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-slate-700 hover:text-amber-500 transition-colors underline-offset-2 hover:underline"
      >
        Christian Romero
      </a>
    </footer>
  );
}
