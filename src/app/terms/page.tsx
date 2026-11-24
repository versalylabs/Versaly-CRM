import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';

export const metadata: Metadata = { title: 'Terms of Service' };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="24 November 2026"
      intro={
        <p>
          These terms govern your use of VersalyLabs CRM (the &quot;service&quot;), provided by VersalyLabs (&quot;we&quot;,
          &quot;us&quot;). By creating an account or using the service, you agree to these terms on behalf of yourself and
          the business you represent (&quot;you&quot;).
        </p>
      }
      sections={[
        {
          heading: 'Your account',
          body: (
            <ul>
              <li>You must give accurate information and keep your password secure.</li>
              <li>You are responsible for everything done through your workspace, including by the team members you invite.</li>
              <li>Tell us straight away if you think your account has been accessed without permission.</li>
            </ul>
          ),
        },
        {
          heading: 'Free trial',
          body: (
            <p>
              New workspaces get a 14-day free trial, and no payment card is needed. When the trial ends, the workspace
              becomes read-only until you choose a paid plan.
            </p>
          ),
        },
        {
          heading: 'Plans and payment',
          body: (
            <ul>
              <li>Prices are shown in Kenyan shillings on our pricing page. Subscriptions are paid in advance for each monthly or annual period.</li>
              <li>Each plan has limits, for example on leads, team members and automation runs, as shown on the pricing page.</li>
              <li>We may change prices. We will give you at least 30 days&apos; notice, and the change applies from your next billing period.</li>
              <li>Fees already paid are not refundable for partly used periods, except where the law requires a refund.</li>
              <li>If a payment fails, we may limit your workspace to read-only access until it is paid.</li>
            </ul>
          ),
        },
        {
          heading: 'Your data',
          body: (
            <>
              <p>
                You own the data you put into the service. You give us permission to store and process it only to provide
                the service to you. Our Privacy Policy explains how we handle personal data.
              </p>
              <p>
                You are responsible for having a lawful basis to store and contact the people in your CRM. This includes
                getting any consent needed under the Data Protection Act before sending them marketing messages.
              </p>
            </>
          ),
        },
        {
          heading: 'Acceptable use',
          body: (
            <>
              <p>You must not use the service to:</p>
              <ul>
                <li>send spam or unsolicited bulk messages, or break WhatsApp&apos;s or Meta&apos;s business messaging policies;</li>
                <li>store or send unlawful, fraudulent or harmful content;</li>
                <li>try to access other workspaces, test our security without our written permission, or disrupt the service;</li>
                <li>resell the service without our written agreement.</li>
              </ul>
              <p>We may suspend workspaces that break these rules.</p>
            </>
          ),
        },
        {
          heading: 'Third-party services',
          body: (
            <p>
              Some features connect to services we do not control, such as your email provider, WhatsApp (Meta) and payment
              providers. Their own terms and fees apply. For example, Meta charges for some WhatsApp messages. We are not
              responsible for those services.
            </p>
          ),
        },
        {
          heading: 'Availability and changes',
          body: (
            <p>
              We work to keep the service available and secure, but we do not guarantee that it will be uninterrupted or
              error-free. We may improve or change features over time. If we remove a major feature you pay for, we will
              tell you in advance.
            </p>
          ),
        },
        {
          heading: 'Cancelling and closing your account',
          body: (
            <p>
              You can cancel at any time, and your plan stays active until the end of the period you have paid for. You can
              ask us for an export of your data before you close your account. We may close accounts that break these terms
              or are not paid.
            </p>
          ),
        },
        {
          heading: 'Liability',
          body: (
            <p>
              As far as the law allows, we are not liable for indirect or consequential losses, such as lost profits or lost
              data. Our total liability to you in any 12-month period is limited to the fees you paid us in that period.
              Nothing in these terms limits liability that cannot be limited under Kenyan law.
            </p>
          ),
        },
        {
          heading: 'Governing law',
          body: (
            <p>
              These terms are governed by the laws of Kenya, and the courts of Kenya have jurisdiction over any dispute.
            </p>
          ),
        },
        {
          heading: 'Changes to these terms',
          body: (
            <p>
              We may update these terms. If we make significant changes, we will tell you at least 14 days before they take
              effect. If you keep using the service after that, you accept the new terms.
            </p>
          ),
        },
      ]}
    />
  );
}
