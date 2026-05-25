import { SignIn } from '@clerk/nextjs';
import Link from 'next/link';

const clerkAppearance = {
  variables: {
    colorBackground:       '#111827',
    colorInputBackground:  '#1f2937',
    colorInputText:        '#ffffff',
    colorText:             '#ffffff',
    colorTextSecondary:    '#9ca3af',
    colorPrimary:          '#16a34a',
    colorDanger:           '#ef4444',
    borderRadius:          '0.75rem',
    fontFamily:            'inherit',
  },
  elements: {
    card:                  'shadow-none border-0 bg-transparent p-0',
    headerTitle:           'text-white font-black text-xl tracking-tight',
    headerSubtitle:        'text-gray-400 text-sm',
    socialButtonsBlockButton: 'border border-white/10 bg-white/5 hover:bg-white/10 text-white transition-colors',
    socialButtonsBlockButtonText: 'text-white font-medium',
    dividerLine:           'bg-white/10',
    dividerText:           'text-gray-600 text-xs',
    formFieldLabel:        'text-gray-400 text-xs font-medium uppercase tracking-wide',
    formFieldInput:        'bg-[#1f2937] border border-white/10 text-white rounded-xl focus:border-green-500/50 focus:ring-0',
    formButtonPrimary:     'bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition-colors',
    footerActionLink:      'text-green-400 hover:text-green-300',
    footerActionText:      'text-gray-500',
    // Fix: add top margin so "Secured by Clerk" footer doesn't crowd "Use another method"
    footer:                'mt-6',
    identityPreviewText:   'text-white',
    identityPreviewEditButton: 'text-green-400',
    formResendCodeLink:    'text-green-400',
    otpCodeFieldInput:     'bg-[#1f2937] border-white/10 text-white',
    alertText:             'text-gray-300',
    formFieldSuccessText:  'text-green-400',
    formFieldErrorText:    'text-red-400',
    // Fix: alternative method buttons (e.g. "Email code to...") had black text on dark bg
    alternativeMethodsBlockButton: 'border border-white/10 bg-white/5 hover:bg-white/10 rounded-xl transition-colors',
    alternativeMethodsBlockButtonText: 'text-gray-100',
    alternativeMethodsBlockButtonArrow: 'text-gray-400',
    // Fix: internal form action links ("Use another method", back links)
    formFieldAction:       'text-green-400 hover:text-green-300',
    // Hint/helper text inside forms
    formFieldHintText:     'text-gray-400',
    // User preview (email shown after entering email step)
    userPreviewMainIdentifier: 'text-white',
    userPreviewSecondaryIdentifier: 'text-gray-400',
  },
};

export default function SignInPage() {
  return (
    {/* overflow-y-auto so Clerk widget can scroll on small phones without being clipped */}
    <div className="min-h-screen overflow-y-auto flex" style={{ background: '#080c14' }}>

      {/* Left — live demo preview (desktop only) */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden">
        <iframe
          src="/preview"
          className="w-full h-full border-0 pointer-events-none"
          style={{ transform: 'scale(0.85)', transformOrigin: 'top left', width: '118%', height: '118%' }}
          title="Demo preview"
        />
        {/* Right-edge fade so it blends into the login panel */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(to right, transparent 50%, #080c14 100%)' }} />
        {/* Top + bottom fades */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, #080c14 0%, transparent 8%, transparent 92%, #080c14 100%)' }} />
      </div>

      {/* Right — login panel. On mobile: full-width, top-aligned with padding so it scrolls if needed */}
      <div className="w-full lg:w-[480px] shrink-0 flex flex-col justify-start lg:justify-center items-center lg:items-start px-6 pt-16 pb-12"
        style={{ borderLeft: '1px solid rgba(255,255,255,0.05)' }}>

        <div className="w-full max-w-[400px]">
          {/* Brand */}
          <div className="mb-8">
            <Link href="/" className="inline-block">
              <span className="text-xl font-black text-white tracking-tight">Cheat Sheets</span>
            </Link>
            <p className="text-xs text-gray-600 mt-1 uppercase tracking-widest">Football match analysis</p>
          </div>

          <SignIn
            appearance={clerkAppearance}
            signUpUrl="/sign-up"
            fallbackRedirectUrl="/home"
          />

          <p className="mt-8 text-xs text-gray-700 text-center leading-relaxed">
            By signing in you agree to our{' '}
            <Link href="/terms" className="text-gray-500 hover:text-gray-400">Terms of Service</Link>
            {' '}and{' '}
            <Link href="/privacy" className="text-gray-500 hover:text-gray-400">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
