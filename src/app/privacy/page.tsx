import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';

export const metadata: Metadata = { title: 'Privacy Policy' };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="24 November 2026"
      intro={
        <>
          <p>
            This policy explains how VersalyLabs (&quot;we&quot;, &quot;us&quot;) collects and uses personal data when you
            visit our website or use VersalyLabs CRM. We handle personal data in line with Kenya&apos;s Data Protection
            Act, 2019 and its regulations.
          </p>
          <p>
            There are two roles. For your account details we decide how the data is used, so we are the{' '}
            <strong>data controller</strong>. For the customer and lead records your business stores in its workspace,
            your business is the controller and we act as its <strong>data processor</strong>: we process that data only
            to provide the service to you and on your instructions.
          </p>
        </>
      }
      sections={[
        {
          heading: 'What we collect',
          body: (
            <ul>
              <li><strong>Account details:</strong> your name, work email, workspace name and password. Passwords are stored only as a one-way hash.</li>
              <li><strong>Workspace content:</strong> the leads, contacts, deals, tasks, notes, messages and files your team adds to the CRM or receives through connected channels.</li>
              <li><strong>Connected accounts:</strong> email addresses, app passwords and access tokens you provide to connect email or WhatsApp. These credentials are encrypted.</li>
              <li><strong>Billing details:</strong> your plan and payment status. Card details are entered on our payment provider&apos;s page and are never stored by us.</li>
              <li><strong>Technical data:</strong> IP address, browser type and logs of requests and errors, which we use to keep the service secure and working.</li>
              <li><strong>Contact form messages:</strong> the details you send when you contact us through the website.</li>
            </ul>
          ),
        },
        {
          heading: 'How we use it',
          body: (
            <ul>
              <li>To create and run your account and workspace, and to provide the features you use.</li>
              <li>To send service emails, such as invitations, security notices and billing messages.</li>
              <li>To provide support and answer your enquiries.</li>
              <li>To protect the service, prevent abuse and fix problems.</li>
              <li>To meet our legal obligations, for example tax and accounting records.</li>
            </ul>
          ),
        },
        {
          heading: 'Our legal basis',
          body: (
            <p>
              We process personal data to perform our contract with you, to meet legal obligations, and for our legitimate
              interests in running a secure and reliable service. Where the law requires consent, for example for marketing
              messages, we ask for it, and you can withdraw it at any time.
            </p>
          ),
        },
        {
          heading: 'Who we share it with',
          body: (
            <>
              <p>We do not sell personal data. We share it only with service providers that help us run VersalyLabs, under agreements that protect it:</p>
              <ul>
                <li>Hosting and database providers that store and run the service.</li>
                <li>Email delivery providers, and Meta when you connect WhatsApp.</li>
                <li>Our payment provider, to process subscription payments.</li>
              </ul>
              <p>We may also disclose data when the law requires it, or to protect our rights or the safety of others.</p>
            </>
          ),
        },
        {
          heading: 'Transfers outside Kenya',
          body: (
            <p>
              Some of our providers store or process data on servers outside Kenya, including in the United States. When
              this happens we rely on appropriate safeguards, as required by the Data Protection Act, so that your data
              stays protected.
            </p>
          ),
        },
        {
          heading: 'How long we keep it',
          body: (
            <p>
              We keep workspace data for as long as your account is active. After an account is closed, we delete
              workspace data within 90 days, unless the law requires us to keep some records for longer, such as billing
              records.
            </p>
          ),
        },
        {
          heading: 'Security',
          body: (
            <p>
              We use encrypted connections, hashed passwords, encrypted channel credentials and access controls that keep
              each workspace&apos;s data separate. No system is perfectly secure. If a breach affects your personal data,
              we will notify the Office of the Data Protection Commissioner and affected customers as the law requires.
            </p>
          ),
        },
        {
          heading: 'Your rights',
          body: (
            <>
              <p>Under the Data Protection Act you have the right to:</p>
              <ul>
                <li>be told how your data is used;</li>
                <li>access the personal data we hold about you;</li>
                <li>object to processing of your data;</li>
                <li>have inaccurate data corrected, and have false or misleading data deleted.</li>
              </ul>
              <p>
                To use these rights, email versalylabs@gmail.com. If your data is stored in a business&apos;s workspace, we
                will pass your request to that business, because it controls that data. You can also complain to the
                Office of the Data Protection Commissioner (odpc.go.ke).
              </p>
            </>
          ),
        },
        {
          heading: 'Cookies',
          body: (
            <p>
              We use only the cookies needed to keep you signed in and to keep the service secure. We do not use
              advertising cookies.
            </p>
          ),
        },
        {
          heading: 'Changes to this policy',
          body: (
            <p>
              We may update this policy. If we make significant changes, we will tell you by email or in the app before
              they take effect.
            </p>
          ),
        },
      ]}
    />
  );
}
