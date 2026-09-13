"use client";

import { useState } from "react";
import Link from "next/link";

export default function DeleteAccountPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    const subject = "CoreTech Digital — Account Deletion Request";
    const body =
      `Name: ${name.trim()}\n` +
      `Account email: ${email.trim()}\n` +
      (reason.trim() ? `Reason: ${reason.trim()}\n` : "") +
      `\nPlease delete my CoreTech Digital account and associated personal data.`;
    const mailto = `mailto:info@coretechsolar.pk?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;

    setSent(true);
    window.location.href = mailto;
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 py-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#0077B6] to-[#00B4D8] flex items-center justify-center text-white font-extrabold text-sm shadow">
              CT
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-800">
              Core<span className="text-[#00B4D8]">TECH</span> Digital
            </span>
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            Account &amp; Data Deletion
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 sm:px-8 py-10 lg:py-14">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-3">
          Delete Your Account &amp; Data
        </h1>
        <p className="text-lg text-slate-600 leading-relaxed mb-10 pb-8 border-b border-slate-100 max-w-[62ch]">
          If you have a CoreTech Digital account and want it — and the personal information tied
          to it — removed, you can request that here. This works whether or not you still have
          the app installed.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-8 lg:gap-10">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm h-fit">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#0077B6] mb-2">
              Email us directly
            </p>
            <p className="text-sm text-slate-600 mb-5">
              Send the request from the email address on your account. We&apos;ll pre-fill the
              message for you.
            </p>

            {sent ? (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg px-4 py-3 text-sm leading-relaxed">
                Opening your email app with a message addressed to{" "}
                <span className="font-semibold">info@coretechsolar.pk</span> — review it and
                hit send from there.
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="fullname" className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Your name
                  </label>
                  <input
                    id="fullname"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="As it appears on your account"
                    required
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-md text-sm text-slate-800 focus:outline-none focus:border-[#00B4D8]"
                  />
                </div>
                <div>
                  <label htmlFor="acctemail" className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Account email
                  </label>
                  <input
                    id="acctemail"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-md text-sm text-slate-800 focus:outline-none focus:border-[#00B4D8]"
                  />
                </div>
                <div>
                  <label htmlFor="reason" className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Reason <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <textarea
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Not required, but helps us process your request faster"
                    rows={3}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-sm text-slate-800 focus:outline-none focus:border-[#00B4D8] resize-y"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full h-10 bg-[#0077B6] hover:bg-[#00B4D8] text-white font-medium text-sm rounded-md transition-colors"
                >
                  Prepare Deletion Request Email
                </button>
              </form>
            )}
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-4">
              What happens after you send it
            </h2>
            <ol className="space-y-3.5">
              {[
                {
                  t: "We verify it's really you",
                  d: "by confirming the request came from your account's own registered email address.",
                },
                {
                  t: "Your account is deactivated",
                  d: "and your personal profile information (name, contact details) is deleted from our systems.",
                },
                {
                  t: "Business records tied to your account",
                  d: "(inventory, sales, and order history you were part of) may be kept as part of CoreTech Solar's own accounting and audit records, as described in the Privacy Policy — this is standard for any business tool, not personal data being retained.",
                },
                {
                  t: "You'll get a confirmation email",
                  d: "once the request has been processed.",
                },
              ].map((step, i) => (
                <li key={i} className="flex gap-3.5">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#F0FAFE] text-[#0077B6] text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="text-[15px] text-slate-600 leading-relaxed">
                    <strong className="text-slate-800 font-semibold">{step.t}</strong> {step.d}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-100">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 py-6 flex flex-wrap justify-between gap-3 text-xs text-slate-400">
          <span>CoreTech Solar</span>
          <span>
            See also{" "}
            <Link href="/privacy" className="text-[#0077B6]">
              Privacy Policy
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
