import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service | Cheat Sheets',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen px-6 py-12 max-w-3xl mx-auto" style={{ background: '#080c14', color: '#e5e7eb' }}>
      <Link href="/" className="text-[11px] text-gray-600 hover:text-gray-400 transition-colors">← Back</Link>

      <h1 className="text-2xl font-black text-white mt-6 mb-2 tracking-tight">Terms of Service</h1>
      <p className="text-xs text-gray-500 mb-10">Last updated: 12 May 2025</p>

      <div className="space-y-8 text-sm leading-relaxed text-gray-400">

        <section>
          <h2 className="text-white font-bold text-base mb-3">1. Agreement to Terms</h2>
          <p>
            By accessing or using the Cheat Sheets service available at{' '}
            <span className="text-gray-300">football-cheatsheet.vercel.app</span> (the &ldquo;Service&rdquo;), you agree to be bound
            by these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree to these Terms, do not use the Service.
          </p>
          <p className="mt-2">
            These Terms constitute a legally binding agreement between you (&ldquo;User&rdquo;, &ldquo;you&rdquo;) and Cheat Sheets
            (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;), a trading name operated in the United Kingdom.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-base mb-3">2. Description of Service</h2>
          <p>
            Cheat Sheets is a subscription-based web application that provides football analysts, enthusiasts, and hobbyists
            with real-time match data including confirmed team lineups, player statistics, historical performance data, and
            statistical probability models for various match events across major European football competitions.
          </p>
          <p className="mt-2">
            The Service is intended solely as an informational and analytical tool. It does not constitute financial advice,
            betting advice, or a recommendation to place any wager or bet of any kind.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-base mb-3">3. Eligibility</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>You must be at least <strong className="text-gray-300">18 years of age</strong> to use the Service.</li>
            <li>You must have the legal capacity to enter into a binding contract in your jurisdiction.</li>
            <li>By using the Service you represent and warrant that you meet these requirements.</li>
            <li>
              If you are using the Service in connection with gambling or sports betting, you are solely responsible for
              ensuring that such activity is legal in your jurisdiction and that you are of legal gambling age.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-white font-bold text-base mb-3">4. Accounts and Registration</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>You must register for an account to access the Service. You agree to provide accurate, current, and complete information.</li>
            <li>You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account.</li>
            <li>You must notify us immediately at <a href="mailto:support@cheatsheets.co.uk" className="text-green-400 hover:underline">support@cheatsheets.co.uk</a> if you suspect any unauthorised use of your account.</li>
            <li>We reserve the right to terminate or suspend accounts that provide false information or violate these Terms.</li>
            <li>You may not create multiple accounts for the purpose of accessing the Service without paying the applicable subscription fee.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-white font-bold text-base mb-3">5. Subscription and Billing</h2>
          <h3 className="text-gray-300 font-semibold mb-2">5.1 Subscription Plans</h3>
          <p>
            Access to the Service requires a paid subscription. Current pricing is displayed on our pricing page and
            is subject to change with advance notice.
          </p>

          <h3 className="text-gray-300 font-semibold mt-4 mb-2">5.2 Billing and Auto-Renewal</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>Subscriptions are billed monthly in advance on a recurring basis.</li>
            <li>Your subscription will automatically renew at the end of each billing period unless you cancel before the renewal date.</li>
            <li>Payment is processed by Stripe. By subscribing, you authorise Stripe to charge your payment method on a recurring basis.</li>
            <li>All prices are inclusive of applicable VAT where required by law.</li>
          </ul>

          <h3 className="text-gray-300 font-semibold mt-4 mb-2">5.3 Cancellation</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>You may cancel your subscription at any time from your account settings.</li>
            <li>Cancellation takes effect at the end of your current billing period. You retain access to the Service until that date.</li>
            <li>We do not offer partial-month refunds upon cancellation.</li>
          </ul>

          <h3 className="text-gray-300 font-semibold mt-4 mb-2">5.4 Refunds</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Under UK consumer law, you have a 14-day &ldquo;cooling-off&rdquo; right for digital services purchased online.
              However, by accessing the Service immediately after subscribing, you expressly consent to the Service
              beginning before the 14-day period expires and acknowledge that you lose your right to cancel under
              the cooling-off period once the Service has been fully performed or you have accessed it.
            </li>
            <li>Outside of statutory rights, all subscription fees are non-refundable.</li>
            <li>If you believe you have been charged in error, contact us within 7 days at <a href="mailto:support@cheatsheets.co.uk" className="text-green-400 hover:underline">support@cheatsheets.co.uk</a>.</li>
          </ul>

          <h3 className="text-gray-300 font-semibold mt-4 mb-2">5.5 Price Changes</h3>
          <p>
            We reserve the right to change subscription prices. We will give you at least 30 days&apos; notice of any price
            increase via email. Continued use of the Service after the notice period constitutes acceptance of the new price.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-base mb-3">6. Acceptable Use</h2>
          <p className="mb-2">You agree not to:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Scrape, crawl, or systematically extract data from the Service using automated tools.</li>
            <li>Reproduce, distribute, or resell any data or content obtained through the Service.</li>
            <li>Share your account credentials with any third party or allow others to use your account.</li>
            <li>Attempt to circumvent any subscription restrictions or access controls.</li>
            <li>Use the Service for any unlawful purpose or in violation of any applicable laws.</li>
            <li>Reverse engineer, decompile, or attempt to extract the source code of the Service.</li>
            <li>Interfere with or disrupt the integrity or performance of the Service or its infrastructure.</li>
            <li>Post or transmit any content that is defamatory, abusive, or otherwise objectionable.</li>
          </ul>
          <p className="mt-2">
            Violation of these restrictions may result in immediate termination of your account without refund and, where
            appropriate, legal action.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-base mb-3">7. Intellectual Property</h2>
          <p>
            All content, design, code, data compilations, statistical models, and visual elements within the Service are
            owned by or licensed to Cheat Sheets and are protected by copyright, database rights, and other intellectual
            property laws.
          </p>
          <p className="mt-2">
            You are granted a limited, non-exclusive, non-transferable, revocable licence to access and use the Service
            for your own personal, non-commercial purposes during your subscription period. This licence does not include
            the right to copy, distribute, modify, create derivative works from, or commercially exploit any part of the Service.
          </p>
          <p className="mt-2">
            Football club names, crests, competition names, and player names referenced within the Service are the property
            of their respective owners. Their inclusion does not imply endorsement or affiliation.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-base mb-3">8. Data Accuracy and Disclaimers</h2>
          <p className="mb-2">
            The Service aggregates and processes data from third-party sources including football data APIs. While we make
            reasonable efforts to ensure accuracy:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>We do not guarantee the accuracy, completeness, timeliness, or reliability of any data, statistics, lineups, or probabilities presented.</li>
            <li>Data may be delayed, incomplete, or contain errors due to third-party data provider issues.</li>
            <li>Statistical models and probability calculations are algorithmic estimates only and do not predict actual outcomes.</li>
            <li><strong className="text-gray-300">The Service is not a gambling product and must not be relied upon as the sole basis for any betting or wagering decision.</strong></li>
            <li>We are not responsible for any losses, financial or otherwise, resulting from reliance on information provided by the Service.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-white font-bold text-base mb-3">9. Availability and Service Changes</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>We do not guarantee that the Service will be available 100% of the time. It may be unavailable due to maintenance, technical issues, or circumstances outside our control.</li>
            <li>We reserve the right to modify, suspend, or discontinue any feature of the Service at any time with reasonable notice.</li>
            <li>In the event of extended outages affecting your ability to use the Service, we may at our discretion offer a pro-rated credit or refund.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-white font-bold text-base mb-3">10. Limitation of Liability</h2>
          <p>
            To the fullest extent permitted by applicable law, Cheat Sheets and its operators shall not be liable for:
          </p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li>Any indirect, incidental, special, consequential, or punitive damages.</li>
            <li>Loss of profits, revenue, data, or business opportunities.</li>
            <li>Any financial losses resulting from reliance on data, statistics, or probabilities provided by the Service.</li>
            <li>Any damages arising from unauthorised access to or alteration of your account or data.</li>
          </ul>
          <p className="mt-2">
            Our total aggregate liability to you for any claim arising under or in connection with these Terms shall not
            exceed the total amount you paid to us in the 3 months immediately preceding the claim.
          </p>
          <p className="mt-2 text-xs text-gray-500">
            Nothing in these Terms excludes or limits liability for death or personal injury caused by negligence, fraud or
            fraudulent misrepresentation, or any other liability that cannot be excluded by English law.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-base mb-3">11. Indemnification</h2>
          <p>
            You agree to indemnify and hold harmless Cheat Sheets and its operators from and against any claims, damages,
            losses, liabilities, costs, and expenses (including reasonable legal fees) arising out of your use of the
            Service in violation of these Terms or applicable law.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-base mb-3">12. Termination</h2>
          <p>
            We reserve the right to suspend or terminate your account and access to the Service at any time, with or without
            notice, if you violate these Terms. Upon termination, your right to use the Service ceases immediately.
          </p>
          <p className="mt-2">
            You may terminate your account at any time by cancelling your subscription and contacting us to request account deletion.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-base mb-3">13. Governing Law and Disputes</h2>
          <p>
            These Terms are governed by and construed in accordance with the laws of <strong className="text-gray-300">England and Wales</strong>.
            Any dispute arising out of or in connection with these Terms shall be subject to the exclusive jurisdiction of
            the courts of England and Wales.
          </p>
          <p className="mt-2">
            Before initiating formal proceedings, we encourage you to contact us at{' '}
            <a href="mailto:support@cheatsheets.co.uk" className="text-green-400 hover:underline">support@cheatsheets.co.uk</a>{' '}
            to attempt informal resolution.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-base mb-3">14. Changes to These Terms</h2>
          <p>
            We may update these Terms at any time. When we do, we will update the &ldquo;Last updated&rdquo; date above and, for
            material changes, notify you via email with at least 14 days&apos; notice. Continued use of the Service after
            the effective date of changes constitutes your acceptance of the updated Terms.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-base mb-3">15. Severability</h2>
          <p>
            If any provision of these Terms is found to be unenforceable or invalid under applicable law, that provision
            will be modified to the minimum extent necessary to make it enforceable, or severed if modification is not
            possible. The remaining provisions shall continue in full force and effect.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-base mb-3">16. Entire Agreement</h2>
          <p>
            These Terms, together with our <Link href="/privacy" className="text-green-400 hover:underline">Privacy Policy</Link>,
            constitute the entire agreement between you and Cheat Sheets regarding use of the Service and supersede all
            prior agreements and understandings.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-base mb-3">17. Contact</h2>
          <p>
            Questions about these Terms? Contact us at:{' '}
            <a href="mailto:support@cheatsheets.co.uk" className="text-green-400 hover:underline">support@cheatsheets.co.uk</a>
          </p>
        </section>

      </div>

      <div className="mt-12 pt-6 border-t text-xs text-center text-gray-700" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <Link href="/privacy" className="hover:text-gray-500 transition-colors">Privacy Policy</Link>
        <span className="mx-3">·</span>
        <Link href="/" className="hover:text-gray-500 transition-colors">Back to Home</Link>
      </div>
    </div>
  );
}
