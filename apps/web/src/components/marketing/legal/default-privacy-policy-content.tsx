import type { ReactElement } from 'react';
import { MarketingLegalProse } from '@/components/marketing/legal/marketing-legal-prose';
import { LEGAL_LAST_UPDATED } from '@/lib/marketing/legal-document-id';

/**
 * Built-in privacy policy copy when no CMS embed id is configured.
 */
export function DefaultPrivacyPolicyContent(): ReactElement {
  return (
    <MarketingLegalProse>
      <p className="text-xs text-muted-foreground/90">Last updated: {LEGAL_LAST_UPDATED}</p>
      <section className="space-y-3">
        <h2>Overview</h2>
        <p>
          TechMD (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) provides independent technology guidance for growing teams in the
          Philippines. This Privacy Policy explains how we collect, use, and protect information when you use our
          website, guided diagnostic, optional account features, and booking flows.
        </p>
      </section>
      <section className="space-y-3">
        <h2>Information we collect</h2>
        <ul>
          <li>
            <strong className="text-foreground">Account details</strong> — If you register, we store your email and a
            salted password hash. We never store plaintext passwords.
          </li>
          <li>
            <strong className="text-foreground">Diagnostic and session data</strong> — Responses, recommendations, and
            progress you enter in the guided diagnostic, including activity linked to a browser session before sign-in.
          </li>
          <li>
            <strong className="text-foreground">Booking information</strong> — Name, email, company, phone, selected
            session times, and payment status when you book a consultation.
          </li>
          <li>
            <strong className="text-foreground">Technical data</strong> — Standard server logs, cookies or local storage
            used to keep sessions working, and security-related metadata.
          </li>
        </ul>
      </section>
      <section className="space-y-3">
        <h2>How we use information</h2>
        <p>We use collected information to:</p>
        <ul>
          <li>Deliver and improve the diagnostic, booking, and account experiences;</li>
          <li>Authenticate optional accounts and merge guest progress when you request it;</li>
          <li>Send booking confirmations and service-related messages;</li>
          <li>Process payments through our payment partners;</li>
          <li>Protect the platform, prevent abuse, and comply with applicable law.</li>
        </ul>
      </section>
      <section className="space-y-3">
        <h2>Guest use and optional accounts</h2>
        <p>
          You may use the full guided diagnostic without registering. Guest activity may remain tied to your browser
          until you sign in and choose to merge progress onto your profile.
        </p>
      </section>
      <section className="space-y-3">
        <h2>AI-assisted guidance</h2>
        <p>
          Diagnostic outputs may be generated or summarized with AI tools. These outputs are for technology planning
          purposes only. They are not legal, medical, financial, or HR advice.
        </p>
      </section>
      <section className="space-y-3">
        <h2>Cookies and similar technologies</h2>
        <p>
          We use cookies and browser storage to operate TechMD. When you first visit, you can choose required cookies
          only or also allow analytics. You can change your choice anytime using <strong className="text-foreground">Cookie preferences</strong> in
          the site footer.
        </p>
        <ul>
          <li>
            <strong className="text-foreground">Required</strong> — HTTP-only cookies such as{' '}
            <code className="rounded bg-muted px-1 font-mono text-xs">it_visitor_id</code> (anonymous diagnostic
            progress) and <code className="rounded bg-muted px-1 font-mono text-xs">it_auth_session</code> (signed-in
            accounts), plus local storage for appearance preferences. These are needed for core functionality.
          </li>
          <li>
            <strong className="text-foreground">Analytics (optional)</strong> — If you opt in, Google Analytics (Google
            LLC) receives usage data such as pages viewed and general traffic patterns. We configure analytics with IP
            anonymization and without ad personalization signals from TechMD. Analytics cookies are not set until you
            accept them.
          </li>
          <li>
            <strong className="text-foreground">Payment pages</strong> — When you pay online, our payment partners may
            set their own cookies on their domains subject to their policies.
          </li>
        </ul>
      </section>
      <section className="space-y-3">
        <h2>Sharing and processors</h2>
        <p>
          We do not sell your personal information. We share data only with service providers that help us operate the
          site (for example hosting, email delivery, video meetings, AI meeting notes, or payment processing), under
          contracts that require appropriate safeguards, or when required by law.
        </p>
        <p>
          When you opt in at booking, consultation calls may be recorded and transcribed by our AI notetaker provider
          (Fathom) so we can deliver meeting notes and summaries. You can decline the opt-in at checkout; joining a call
          after opting in means you consent to that processing for service delivery.
        </p>
      </section>
      <section className="space-y-3">
        <h2>Retention and security</h2>
        <p>
          We retain information for as long as needed to provide services, resolve disputes, and meet legal obligations.
          We apply reasonable administrative and technical measures to protect data, but no online service can guarantee
          absolute security.
        </p>
      </section>
      <section className="space-y-3">
        <h2>Your choices</h2>
        <p>
          You may request access, correction, or deletion of account-related data by contacting us through the channels
          published on this site. You can continue as a guest, decline to merge guest progress, or stop using the service
          at any time.
        </p>
      </section>
      <section className="space-y-3">
        <h2>Children</h2>
        <p>Our services are intended for business users and are not directed to children under 18.</p>
      </section>
      <section className="space-y-3">
        <h2>Changes</h2>
        <p>
          We may update this policy from time to time. Material changes will be reflected on this page with an updated
          &quot;Last updated&quot; date.
        </p>
      </section>
      <section className="space-y-3">
        <h2>Contact</h2>
        <p>
          Questions about this Privacy Policy may be submitted through the contact options on the TechMD website. We
          respond to privacy requests in line with applicable Philippine data privacy principles.
        </p>
      </section>
    </MarketingLegalProse>
  );
}
