import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy | Cheat Sheets',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen px-6 py-12 max-w-3xl mx-auto" style={{ background: '#080c14', color: '#e5e7eb' }}>
      <Link href="/" className="text-[11px] text-gray-600 hover:text-gray-400 transition-colors">← Back</Link>

      <h1 className="text-2xl font-black text-white mt-6 mb-2 tracking-tight">Privacy Policy</h1>
      <p className="text-xs text-gray-500 mb-10">Last updated: 12 May 2025</p>

      <div className="space-y-8 text-sm leading-relaxed text-gray-400">

        <section>
          <h2 className="text-white font-bold text-base mb-3">1. Who We Are</h2>
          <p>
            Cheat Sheets (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) operates the website and service available at{' '}
            <span className="text-gray-300">cheatsheets.co.uk</span> (the &ldquo;Service&rdquo;).
            We are based in the United Kingdom. For any privacy-related queries, contact us at{' '}
            <a href="mailto:support@cheatsheets.co.uk" className="text-green-400 hover:underline">support@cheatsheets.co.uk</a>.
          </p>
          <p className="mt-2">
            This Privacy Policy explains what personal data we collect, why we collect it, how we use and protect it,
            and your rights under the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-base mb-3">2. Data We Collect</h2>
          <p className="mb-2">We collect the following categories of personal data:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-gray-300">Account information:</strong> Your name, email address, and encrypted password
              hash when you create an account. This is processed by Clerk (our authentication provider).
            </li>
            <li>
              <strong className="text-gray-300">Payment information:</strong> Billing details (card number, expiry, CVC) entered
              during checkout. We do not store this data ourselves. It is collected and stored exclusively by Stripe, our
              payment processor. We receive only a non-sensitive customer ID and subscription status.
            </li>
            <li>
              <strong className="text-gray-300">Usage data:</strong> Your subscription status, timestamps of account creation
              and activity, and which features you access, stored in our database (Supabase).
            </li>
            <li>
              <strong className="text-gray-300">Technical data:</strong> IP address, browser type and version, device type,
              operating system, and pages visited, collected automatically via server logs and Vercel infrastructure.
            </li>
            <li>
              <strong className="text-gray-300">Communications:</strong> Any messages you send us via email are retained for
              support and record-keeping purposes.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-white font-bold text-base mb-3">3. How We Collect Data</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-gray-300">Directly from you</strong> when you register, subscribe, or contact us.</li>
            <li><strong className="text-gray-300">Automatically</strong> through cookies, server logs, and your browser when you use the Service.</li>
            <li><strong className="text-gray-300">From third parties</strong> such as Clerk (authentication) and Stripe (payment confirmation webhooks).</li>
          </ul>
        </section>

        <section>
          <h2 className="text-white font-bold text-base mb-3">4. Why We Use Your Data (Legal Bases)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th className="text-left py-2 pr-4 text-gray-300 font-semibold">Purpose</th>
                  <th className="text-left py-2 pr-4 text-gray-300 font-semibold">Data Used</th>
                  <th className="text-left py-2 text-gray-300 font-semibold">Legal Basis (UK GDPR)</th>
                </tr>
              </thead>
              <tbody className="space-y-1">
                {[
                  ['Creating and managing your account', 'Name, email, password hash', 'Contract performance (Art. 6(1)(b))'],
                  ['Processing your subscription payment', 'Payment details (via Stripe), email', 'Contract performance (Art. 6(1)(b))'],
                  ['Providing access to the Service', 'User ID, subscription status', 'Contract performance (Art. 6(1)(b))'],
                  ['Sending account-related emails (receipts, password resets)', 'Email address', 'Contract performance (Art. 6(1)(b))'],
                  ['Fraud prevention and security', 'IP address, usage data', 'Legitimate interests (Art. 6(1)(f))'],
                  ['Improving the Service', 'Anonymised usage data', 'Legitimate interests (Art. 6(1)(f))'],
                  ['Complying with legal obligations', 'Billing records', 'Legal obligation (Art. 6(1)(c))'],
                ].map(([purpose, data, basis]) => (
                  <tr key={purpose} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td className="py-2 pr-4 align-top">{purpose}</td>
                    <td className="py-2 pr-4 align-top">{data}</td>
                    <td className="py-2 align-top">{basis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-white font-bold text-base mb-3">5. Third-Party Processors</h2>
          <p className="mb-2">We use the following third-party services that may process your personal data on our behalf:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-gray-300">Clerk (Clerk.com)</strong>: Authentication and user management.
              Processes your email and authentication credentials. Data stored in the EU/US under SCCs.
              Privacy policy: <span className="text-gray-300">clerk.com/privacy</span>
            </li>
            <li>
              <strong className="text-gray-300">Stripe (Stripe Inc.)</strong>: Payment processing and subscription management.
              Processes payment card data and billing information. PCI DSS Level 1 certified.
              Privacy policy: <span className="text-gray-300">stripe.com/privacy</span>
            </li>
            <li>
              <strong className="text-gray-300">Supabase</strong>: Cloud database storing subscription status and user metadata.
              Data stored in EU data centres.
              Privacy policy: <span className="text-gray-300">supabase.com/privacy</span>
            </li>
            <li>
              <strong className="text-gray-300">Vercel Inc.</strong>: Hosting and infrastructure. May process server logs
              including IP addresses and request data.
              Privacy policy: <span className="text-gray-300">vercel.com/legal/privacy-policy</span>
            </li>
          </ul>
          <p className="mt-3">
            We do not sell, rent, or share your personal data with any third party for marketing purposes.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-base mb-3">6. Cookies</h2>
          <p className="mb-2">We use the following types of cookies:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-gray-300">Strictly necessary cookies:</strong> Session and authentication cookies set by
              Clerk to keep you logged in. These cannot be disabled without breaking the Service.
            </li>
            <li>
              <strong className="text-gray-300">Functional cookies:</strong> Used to remember your preferences and maintain your
              logged-in state across pages.
            </li>
          </ul>
          <p className="mt-2">
            We do not use advertising or tracking cookies. No third-party analytics (e.g., Google Analytics) are currently used.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-base mb-3">7. Data Retention</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-gray-300">Account data:</strong> Retained for as long as your account is active.
              If you delete your account, we delete or anonymise your personal data within 30 days, except where
              we are required to retain it by law.
            </li>
            <li>
              <strong className="text-gray-300">Billing records:</strong> Retained for 7 years to comply with UK tax and
              accounting obligations.
            </li>
            <li>
              <strong className="text-gray-300">Server logs:</strong> Retained for up to 90 days for security and
              debugging purposes.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-white font-bold text-base mb-3">8. Data Security</h2>
          <p>
            We implement appropriate technical and organisational measures to protect your personal data against
            unauthorised access, alteration, disclosure, or destruction. These include:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>All data transmitted over HTTPS (TLS encryption)</li>
            <li>Passwords hashed and never stored in plain text (managed by Clerk)</li>
            <li>Payment data never touches our servers (handled entirely by Stripe)</li>
            <li>Database access restricted to server-side code only via service role keys</li>
            <li>Environment secrets stored encrypted in Vercel, never committed to source control</li>
          </ul>
          <p className="mt-2">
            Despite these measures, no method of transmission over the internet is 100% secure. In the unlikely event
            of a data breach that poses a risk to your rights, we will notify you and the ICO within 72 hours as required by UK GDPR.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-base mb-3">9. International Transfers</h2>
          <p>
            Some of our third-party processors (Clerk, Stripe, Vercel) are based in the United States. Transfers to the US are
            covered by Standard Contractual Clauses (SCCs) or equivalent adequacy mechanisms as required by UK GDPR Chapter V.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-base mb-3">10. Your Rights Under UK GDPR</h2>
          <p className="mb-2">You have the following rights regarding your personal data:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-gray-300">Right of access:</strong> Request a copy of all personal data we hold about you.</li>
            <li><strong className="text-gray-300">Right to rectification:</strong> Request correction of inaccurate or incomplete data.</li>
            <li><strong className="text-gray-300">Right to erasure:</strong> Request deletion of your data (&ldquo;right to be forgotten&rdquo;), subject to legal retention obligations.</li>
            <li><strong className="text-gray-300">Right to restriction:</strong> Request that we restrict processing of your data in certain circumstances.</li>
            <li><strong className="text-gray-300">Right to data portability:</strong> Receive your data in a structured, machine-readable format.</li>
            <li><strong className="text-gray-300">Right to object:</strong> Object to processing based on legitimate interests.</li>
            <li><strong className="text-gray-300">Right to withdraw consent:</strong> Where processing is based on consent, withdraw it at any time without affecting prior processing.</li>
          </ul>
          <p className="mt-3">
            To exercise any of these rights, email us at{' '}
            <a href="mailto:support@cheatsheets.co.uk" className="text-green-400 hover:underline">support@cheatsheets.co.uk</a>.
            We will respond within 30 days. If you are unsatisfied with our response, you have the right to lodge a complaint
            with the <strong className="text-gray-300">Information Commissioner&apos;s Office (ICO)</strong> at{' '}
            <span className="text-gray-300">ico.org.uk</span>.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-base mb-3">11. Children&apos;s Privacy</h2>
          <p>
            The Service is not directed at children under the age of 13. We do not knowingly collect personal data from
            anyone under 13. If you believe a child has provided us with personal data, please contact us immediately and
            we will delete it promptly.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-base mb-3">12. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. When we do, we will update the &ldquo;Last updated&rdquo; date at the top.
            Material changes will be communicated via email to registered users. Continued use of the Service after changes
            constitutes acceptance of the updated policy.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-base mb-3">13. Contact Us</h2>
          <p>
            For any questions, data requests, or complaints regarding this Privacy Policy, contact us at:{' '}
            <a href="mailto:support@cheatsheets.co.uk" className="text-green-400 hover:underline">support@cheatsheets.co.uk</a>
          </p>
        </section>

      </div>

      <div className="mt-12 pt-6 border-t text-xs text-center text-gray-700" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <Link href="/terms" className="hover:text-gray-500 transition-colors">Terms of Service</Link>
        <span className="mx-3">·</span>
        <Link href="/" className="hover:text-gray-500 transition-colors">Back to Home</Link>
      </div>
    </div>
  );
}
