import Link from 'next/link';

export default function SiteFooter() {
  return (
    <footer
      className="w-full text-center py-6 px-4 text-[11px] space-x-4 border-t"
      style={{
        color: 'rgba(255,255,255,0.25)',
        borderColor: 'rgba(255,255,255,0.06)',
        background: '#080c14',
      }}
    >
      <span>© {new Date().getFullYear()} Cheat Sheets</span>
      <Link href="/privacy" className="hover:text-gray-400 transition-colors">Privacy Policy</Link>
      <Link href="/terms" className="hover:text-gray-400 transition-colors">Terms of Service</Link>
      <a href="mailto:support@cheatsheets.co.uk" className="hover:text-gray-400 transition-colors">Contact</a>
    </footer>
  );
}
