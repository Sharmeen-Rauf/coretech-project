import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — CoreTech Installer",
  description: "How CoreTech Installer collects, uses, and protects your information.",
};

const SECTIONS = [
  { id: "collect", label: "Information we collect" },
  { id: "use", label: "How we use it" },
  { id: "share", label: "Who can see it" },
  { id: "camera", label: "Camera, photos & video" },
  { id: "payment", label: "Payment information" },
  { id: "security", label: "Storage & security" },
  { id: "retention", label: "Retention" },
  { id: "rights", label: "Your rights & deletion" },
  { id: "children", label: "Children's privacy" },
  { id: "changes", label: "Changes to this policy" },
  { id: "contact", label: "Contact" },
];

export default function InstallerPrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#0077B6] to-[#00B4D8] flex items-center justify-center text-white font-extrabold text-sm shadow">
              CT
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-800">
              Core<span className="text-[#00B4D8]">TECH</span> Installer
            </span>
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            Privacy Policy
          </span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-10 lg:py-14 grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-10 lg:gap-14">
        <nav className="hidden lg:block sticky top-10 self-start">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-3">
            On this page
          </p>
          <ol className="space-y-0.5">
            {SECTIONS.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="flex gap-2.5 py-1.5 px-2 rounded-md text-[13px] text-slate-600 hover:bg-[#F0FAFE] hover:text-[#0077B6] transition-colors"
                >
                  <span className="text-slate-400 tabular-nums text-xs w-4">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {s.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <main className="max-w-[68ch] min-w-0">
          <details className="lg:hidden mb-6 border border-slate-200 rounded-lg overflow-hidden">
            <summary className="cursor-pointer px-4 py-2.5 text-sm font-semibold text-[#0077B6] bg-white">
              Jump to a section
            </summary>
            <ol className="px-4 pb-3 space-y-1 bg-white border-t border-slate-100 pt-2">
              {SECTIONS.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="text-[13px] text-slate-600">
                    {String(i + 1).padStart(2, "0")} · {s.label}
                  </a>
                </li>
              ))}
            </ol>
          </details>

          <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">
            CoreTech Installer Privacy Policy
          </h1>

          <p className="text-lg text-slate-600 leading-relaxed mb-10 pb-8 border-b border-slate-100">
            CoreTech Installer is a workplace app for CoreTech Solar&apos;s installer partners and
            staff, used to manage assigned installation jobs, document completed work, and handle
            gate passes and related field tasks. This policy explains what information the app
            collects, why, and how it&apos;s protected.
          </p>

          <section id="collect" className="mb-10 scroll-mt-6">
            <h2 className="text-xl font-bold text-slate-900 mb-3.5">
              <span className="text-[#00B4D8] mr-2">01</span>Information we collect
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              Because this app manages field installation work and installer payments, it
              collects more than a typical internal tool — including your CNIC (national ID)
              number, home address, and payment account details.
            </p>
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-300">
                    <th className="text-left py-2.5 pr-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      What
                    </th>
                    <th className="text-left py-2.5 pr-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Includes
                    </th>
                    <th className="text-left py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Why
                    </th>
                  </tr>
                </thead>
                <tbody className="text-slate-600">
                  <tr className="border-b border-slate-100">
                    <td className="py-3 pr-4 font-semibold text-slate-800 whitespace-nowrap align-top">
                      Personal identification
                    </td>
                    <td className="py-3 pr-4 align-top">
                      First and last name, CNIC (national ID) number, contact/phone number, and
                      home address (street, city, state/province)
                    </td>
                    <td className="py-3 align-top">
                      Verifying your identity as a registered installer
                    </td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-3 pr-4 font-semibold text-slate-800 whitespace-nowrap align-top">
                      Payment information
                    </td>
                    <td className="py-3 pr-4 align-top">
                      Your EasyPaisa or JazzCash payment provider and account number
                    </td>
                    <td className="py-3 align-top">Processing your installer payments</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-3 pr-4 font-semibold text-slate-800 whitespace-nowrap align-top">
                      Job photos &amp; videos
                    </td>
                    <td className="py-3 pr-4 align-top">
                      Photos or video you capture or upload as proof of completed installation
                      work
                    </td>
                    <td className="py-3 align-top">
                      Documenting and verifying completed jobs
                    </td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-3 pr-4 font-semibold text-slate-800 whitespace-nowrap align-top">
                      Account &amp; profile
                    </td>
                    <td className="py-3 pr-4 align-top">
                      Login credentials, marital status, and account/role data (installer status,
                      assigned jobs, gate passes)
                    </td>
                    <td className="py-3 align-top">
                      Identifies who&apos;s using the app and what they&apos;re assigned
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-semibold text-slate-800 whitespace-nowrap align-top">
                      Device &amp; usage
                    </td>
                    <td className="py-3 pr-4 align-top">
                      Basic technical data such as app version and crash/error logs
                    </td>
                    <td className="py-3 align-top">
                      Keeping the app working correctly and diagnosing problems
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-slate-600 leading-relaxed">
              We do <strong className="text-slate-800 font-semibold">not</strong> collect
              location/GPS data, contacts, or files from your device, and we do not use
              advertising identifiers.
            </p>
          </section>

          <section id="use" className="mb-10 scroll-mt-6">
            <h2 className="text-xl font-bold text-slate-900 mb-3.5">
              <span className="text-[#00B4D8] mr-2">02</span>How we use it
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-slate-600 leading-relaxed mb-4 marker:text-[#00B4D8]">
              <li>To create and manage your installer account and verify your identity.</li>
              <li>To assign and track installation jobs, gate passes, and related field work.</li>
              <li>To process your installer payments via the payment details you provide.</li>
              <li>
                To maintain a photographic record of completed installations for quality and
                audit purposes.
              </li>
              <li>
                To keep the app reliable — fixing bugs, understanding crash reports, and
                maintaining performance.
              </li>
            </ul>
            <p className="text-slate-600 leading-relaxed">
              We do not use your information for advertising, and we do not sell it to anyone.
            </p>
          </section>

          <section id="share" className="mb-10 scroll-mt-6">
            <h2 className="text-xl font-bold text-slate-900 mb-3.5">
              <span className="text-[#00B4D8] mr-2">03</span>Who can see it
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              Information in CoreTech Installer — including your personal details and job
              photos/videos — is shared only with{" "}
              <strong className="text-slate-800 font-semibold">
                CoreTech Solar&apos;s own employees and administrators
              </strong>{" "}
              who need it to manage jobs and payments.
            </p>
            <p className="text-slate-600 leading-relaxed">
              We do{" "}
              <strong className="text-slate-800 font-semibold">not</strong> share your
              information with distributors, sub-dealers, customers, or any outside company or
              third party for their own use, and we never sell it. The app&apos;s data is stored
              with our database provider, Supabase, solely to operate the service on our
              behalf — they do not use it for any purpose of their own.
            </p>
          </section>

          <section id="camera" className="mb-10 scroll-mt-6">
            <h2 className="text-xl font-bold text-slate-900 mb-3.5">
              <span className="text-[#00B4D8] mr-2">04</span>Camera, photos &amp; video
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              CoreTech Installer requests camera and media access for two specific purposes:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-slate-600 leading-relaxed mb-4 marker:text-[#00B4D8]">
              <li>
                <strong className="text-slate-800 font-semibold">Barcode scanning</strong> — the
                camera feed is read live to detect a product serial-number barcode; the app does
                not take, save, or upload a photo or video of anything the camera sees for this
                purpose.
              </li>
              <li>
                <strong className="text-slate-800 font-semibold">Job documentation</strong> —
                photos and video you capture or select as proof of completed installation work{" "}
                <strong className="text-slate-800 font-semibold">are</strong> saved and uploaded
                to secure cloud storage linked to that job record.
              </li>
            </ul>
            <p className="text-slate-600 leading-relaxed">
              Please don&apos;t submit images containing another person&apos;s personal
              information unless you&apos;re authorized to do so.
            </p>
          </section>

          <section id="payment" className="mb-10 scroll-mt-6">
            <h2 className="text-xl font-bold text-slate-900 mb-3.5">
              <span className="text-[#00B4D8] mr-2">05</span>Payment information
            </h2>
            <p className="text-slate-600 leading-relaxed">
              The app collects your EasyPaisa or JazzCash payment account details solely to
              process your installer payments. We will{" "}
              <strong className="text-slate-800 font-semibold">never</strong> ask for your
              password, PIN, OTP, or any other secret authentication credential for your payment
              account.
            </p>
          </section>

          <section id="security" className="mb-10 scroll-mt-6">
            <h2 className="text-xl font-bold text-slate-900 mb-3.5">
              <span className="text-[#00B4D8] mr-2">06</span>Storage &amp; security
            </h2>
            <p className="text-slate-600 leading-relaxed">
              Your data is stored on Supabase&apos;s infrastructure and encrypted in transit
              between the app and our servers. Passwords are stored in hashed form and are never
              visible to administrators. Access to the underlying database is restricted to
              CoreTech Solar&apos;s own backend systems.
            </p>
          </section>

          <section id="retention" className="mb-10 scroll-mt-6">
            <h2 className="text-xl font-bold text-slate-900 mb-3.5">
              <span className="text-[#00B4D8] mr-2">07</span>Retention
            </h2>
            <p className="text-slate-600 leading-relaxed">
              We keep account, job, and payment record data for as long as your installer account
              is active, and for a reasonable period afterward to preserve CoreTech
              Solar&apos;s own accounting and audit records. If you&apos;d like your personal
              account information removed sooner, see the next section.
            </p>
          </section>

          <section id="rights" className="mb-10 scroll-mt-6">
            <h2 className="text-xl font-bold text-slate-900 mb-3.5">
              <span className="text-[#00B4D8] mr-2">08</span>Your rights &amp; deletion
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              You can request access to, correction of, or deletion of your personal information
              at any time:
            </p>
            <div className="bg-[#F0FAFE] border border-[#00B4D8]/30 border-l-[3px] border-l-[#00B4D8] rounded-lg p-4 sm:p-5">
              <p className="font-semibold text-slate-800 mb-1.5">
                Request account or data deletion
              </p>
              <p className="text-[15px] text-slate-600 leading-relaxed">
                Email{" "}
                <a href="mailto:info@coretechsolar.pk" className="text-[#0077B6] font-medium">
                  info@coretechsolar.pk
                </a>{" "}
                from the address associated with your account, or visit{" "}
                <Link href="/privacy/installer/delete-account" className="text-[#0077B6] font-medium">
                  coretechsolar.com/privacy/installer/delete-account
                </Link>
                , and we&apos;ll process your request within a reasonable time. Some
                business-record data (e.g. completed job/payment records) may be retained as
                required for legitimate accounting or audit purposes even after an account is
                deleted.
              </p>
            </div>
          </section>

          <section id="children" className="mb-10 scroll-mt-6">
            <h2 className="text-xl font-bold text-slate-900 mb-3.5">
              <span className="text-[#00B4D8] mr-2">09</span>Children&apos;s privacy
            </h2>
            <p className="text-slate-600 leading-relaxed">
              CoreTech Installer is a workplace tool for CoreTech Solar&apos;s adult installer
              partners and staff. It is not directed at children, and we don&apos;t knowingly
              collect information from anyone under 18.
            </p>
          </section>

          <section id="changes" className="mb-10 scroll-mt-6">
            <h2 className="text-xl font-bold text-slate-900 mb-3.5">
              <span className="text-[#00B4D8] mr-2">10</span>Changes to this policy
            </h2>
            <p className="text-slate-600 leading-relaxed">
              If this policy changes in a meaningful way, we&apos;ll update the effective date
              above and, where appropriate, let installers know before the change takes effect.
            </p>
          </section>

          <section id="contact" className="scroll-mt-6">
            <h2 className="text-xl font-bold text-slate-900 mb-3.5">
              <span className="text-[#00B4D8] mr-2">11</span>Contact
            </h2>
            <p className="text-slate-600 leading-relaxed">
              Questions about this policy or how your information is handled can be sent to{" "}
              <a href="mailto:info@coretechsolar.pk" className="text-[#0077B6] font-medium">
                info@coretechsolar.pk
              </a>
              .
            </p>
          </section>
        </main>
      </div>

      <footer className="border-t border-slate-100">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-6 flex flex-wrap justify-between gap-3 text-xs text-slate-400">
          <span>CoreTech Solar</span>
          <span>
            See also{" "}
            <Link href="/privacy/installer/delete-account" className="text-[#0077B6]">
              Account &amp; Data Deletion
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
