import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
         style={{ background: '#080c14' }}>
      <p className="text-[10px] uppercase tracking-widest font-bold mb-4"
         style={{ color: 'rgba(255,255,255,0.2)' }}>404</p>
      <h1 className="text-2xl font-black text-white mb-3 tracking-tight">Page not found</h1>
      <p className="text-sm text-gray-500 mb-8 max-w-xs">
        This page doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/"
        className="px-6 py-2.5 rounded-xl font-bold text-sm transition-all hover:brightness-110"
        style={{ background: '#16a34a', color: '#fff' }}
      >
        Go home
      </Link>
    </div>
  );
}
