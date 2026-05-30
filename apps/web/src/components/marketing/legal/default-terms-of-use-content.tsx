import type { ReactElement } from 'react';
import { MarketingLegalProse } from '@/components/marketing/legal/marketing-legal-prose';
import { LEGAL_LAST_UPDATED } from '@/lib/marketing/legal-document-id';

/**
 * Built-in terms of use copy when no CMS embed id is configured.
 */
export function DefaultTermsOfUseContent(): ReactElement {
  return (
    <MarketingLegalProse>
      <p className="text-xs text-muted-foreground/90">Last updated: {LEGAL_LAST_UPDATED}</p>
      <section className="space-y-3">
        <h2>Agreement</h2>
        <p>
          By accessing or using the TeqMD website, guided diagnostic, optional account features, or booking services,
          you agree to these Terms of Use. If you do not agree, do not use the services.
        </p>
      </section>
      <section className="space-y-3">
        <h2>Service description</h2>
        <p>
          TeqMD offers vendor-neutral technology guidance for teams in the Philippines, including an online diagnostic,
          recommendations, and optional paid consultations. Features may change as we improve the product.
        </p>
      </section>
      <section className="space-y-3">
        <h2>Not professional advice</h2>
        <p>
          Content on this site — including AI-assisted diagnostic summaries — is for general technology planning only. It
          does not constitute legal, medical, financial, tax, or human-resources advice. You are responsible for decisions
          you make based on the information provided.
        </p>
      </section>
      <section className="space-y-3">
        <h2>Accounts and acceptable use</h2>
        <ul>
          <li>Accounts are optional; you must provide accurate registration information when you create one.</li>
          <li>You are responsible for safeguarding your password and for activity under your account.</li>
          <li>
            You may not misuse the site, attempt unauthorized access, interfere with other users, scrape or overload our
            systems, or use the service for unlawful purposes.
          </li>
        </ul>
      </section>
      <section className="space-y-3">
        <h2>Bookings and payments</h2>
        <p>
          Session availability, pricing, and cancellation rules are shown at the time of booking. Payments are processed
          by third-party payment providers subject to their terms. Rescheduling or refunds, where offered, follow the
          policies stated during checkout or in booking confirmations.
        </p>
      </section>
      <section className="space-y-3">
        <h2>Intellectual property</h2>
        <p>
          The site, branding, templates, and original content are owned by TeqMD or its licensors. You receive a limited,
          non-exclusive license to use the services for your internal business purposes. You may not copy, resell, or
          redistribute our materials without written permission.
        </p>
      </section>
      <section className="space-y-3">
        <h2>Your content</h2>
        <p>
          You retain ownership of information you submit. You grant us a license to use that information to operate the
          diagnostic, provide recommendations, fulfill bookings, and improve our services, consistent with our Privacy
          Policy.
        </p>
      </section>
      <section className="space-y-3">
        <h2>Disclaimers</h2>
        <p>
          The services are provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, whether express or
          implied, including merchantability, fitness for a particular purpose, or non-infringement, to the fullest extent
          permitted by law.
        </p>
      </section>
      <section className="space-y-3">
        <h2>Limitation of liability</h2>
        <p>
          To the maximum extent permitted by applicable law, TeqMD and its affiliates will not be liable for indirect,
          incidental, special, consequential, or punitive damages, or for lost profits or data, arising from your use of the
          services. Our aggregate liability for direct damages is limited to the amount you paid us for the specific
          booking or service giving rise to the claim in the twelve months before the event, or one hundred US dollars if
          no fee was paid, whichever is greater.
        </p>
      </section>
      <section className="space-y-3">
        <h2>Indemnity</h2>
        <p>
          You agree to indemnify and hold TeqMD harmless from claims arising out of your misuse of the services or
          violation of these terms.
        </p>
      </section>
      <section className="space-y-3">
        <h2>Governing law</h2>
        <p>
          These terms are governed by the laws of the Republic of the Philippines, without regard to conflict-of-law rules.
          Disputes will be brought in courts located in the Philippines, unless otherwise required by mandatory law.
        </p>
      </section>
      <section className="space-y-3">
        <h2>Changes and termination</h2>
        <p>
          We may modify these terms by posting an updated version on this site. Continued use after changes constitutes
          acceptance. We may suspend or terminate access for violations or to protect the platform.
        </p>
      </section>
      <section className="space-y-3">
        <h2>Contact</h2>
        <p>Questions about these Terms of Use may be submitted through the contact options published on the TeqMD website.</p>
      </section>
    </MarketingLegalProse>
  );
}
