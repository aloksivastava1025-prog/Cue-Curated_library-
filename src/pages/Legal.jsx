import React from 'react'
import Footer from '../components/Footer.jsx'
import { usePageMeta } from '../hooks/usePageMeta.js'

const slugify = (s) => String(s)
  .toLowerCase()
  .replace(/^\d+\.\s*/, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '')

// Effective date. Bump whenever legal text changes materially — users
// with active plans should be notified by email when this moves.
const EFFECTIVE = 'Draft · Effective from public launch'

const CONTACT_EMAIL = 'hello@usecue.com'

const PAGES = {
  privacy: {
    eyebrow: 'Legal',
    title: 'Privacy Policy',
    lead: 'What we collect, why, and how you control it.',
    updated: EFFECTIVE,
    body: [
      ['Who this covers',
        `This policy applies to everyone who visits usecue.com, signs into CUE, subscribes to Cue+, or submits feedback. CUE is operated by an independent creator based in India. We do not have offices, staff, or subsidiaries elsewhere.`],
      ['Data we collect — you gave it to us',
        `Account details you provide when signing in: your email address (via Clerk) and, if you choose, a display name. If you upgrade to Cue+, our payment partner (Dodo Payments) receives your billing details directly; CUE only ever sees the plan you bought, not your card number. If you submit feedback, we store the message, your email if you left one, and the page you came from.`],
      ['Data we collect — automatic',
        `Standard product telemetry: which items you open, which prompts you copy, and which pages you view. This is stored aggregated (counts on items, not per-user history). We use privacy-friendly analytics with no third-party ad trackers, no cross-site tracking, no fingerprinting. IP addresses are used briefly for spam prevention and are not stored beyond 30 days.`],
      ['How we use it',
        `Only to deliver the product: authenticating you, showing your saved items, unlocking Cue+ content, responding to your messages, and sending you the drops you signed up for. We use aggregated view counts to decide which items to feature. We never sell your data. We never send marketing emails you did not ask for.`],
      ['Where it lives',
        `Application data is stored in Supabase (Postgres) on AWS in the US region. Auth is handled by Clerk. Payments by Dodo Payments. Emails sent via Resend. Error monitoring via Sentry, with your email and Clerk user id redacted before any error report leaves the browser. If you ask, we can share the full list of processors under our contract with them.`],
      ['Your rights — DPDP Act 2023 (India)',
        `You are a "Data Principal" under India's Digital Personal Data Protection Act, 2023. You have the right to (a) know what personal data we hold about you, (b) correct or complete it, (c) erase it, (d) withdraw consent, and (e) nominate someone to exercise these rights on your behalf. To exercise any of these, email ${CONTACT_EMAIL} from the address on your account. We respond within 30 days.`],
      ['Your rights — GDPR (EU / UK / EEA)',
        `If you are in the EU, UK, or EEA, you have the equivalent rights under GDPR: access, rectification, erasure, restriction, portability, and objection. Contact ${CONTACT_EMAIL}. You may also complain to your local data protection authority.`],
      ['Retention',
        `Account data: kept until you delete your account. Feedback threads: kept for 24 months after last activity, then archived. Waitlist emails: kept until you unsubscribe. Payment records: kept for 8 years to comply with Indian tax law. Aggregated analytics: kept indefinitely (anonymous).`],
      ['Cookies + local storage',
        `We use browser localStorage to remember which items you have already viewed (so the same view is not counted twice) and when you last checked your inbox. No advertising cookies. Clerk sets a session cookie for authentication. Analytics uses first-party cookies only.`],
      ['Children',
        `CUE is not intended for anyone under 18. We do not knowingly collect data from children. If we learn that we have, we delete it.`],
      ['Security',
        `Row-level security in Postgres restricts data to its owner or the site administrator. Access secrets are rotated regularly. We log administrative reads for audit. That said: no system is perfect. If there is a breach affecting your data, we will tell you within 72 hours of discovery.`],
      ['Changes',
        `We may update this policy. Material changes are announced by email to active accounts at least 14 days before they take effect. The "effective date" at the top is authoritative.`],
      ['Contact',
        `${CONTACT_EMAIL} for any privacy question. Grievance officer (DPDP): the same address. Please put "Privacy" in the subject.`],
    ],
  },

  terms: {
    eyebrow: 'Legal',
    title: 'Terms of Service',
    lead: 'The agreement between you and CUE. Short and specific.',
    updated: EFFECTIVE,
    body: [
      ['1. What CUE is',
        `CUE is a curated library of prompts and component references for building interfaces with AI tools (Bolt, v0, Cursor, Framer, and similar). Users copy prompts, paste them into their tool of choice, and generate a starting point they can modify and ship. CUE does not host your projects, does not deploy your code, and does not run your app.`],
      ['2. Your account',
        `You must be at least 18 years old. You are responsible for keeping your Clerk login secure. One human = one account; do not share credentials. If you notice suspicious activity, email ${CONTACT_EMAIL} immediately.`],
      ['3. Plans and payment',
        `Free tier: preview access to selected items. Cue+ Individual: full library, all future drops, single named user (you), USD $79 one-time. Cue+ Team: same, up to 5 named users under one team owner, USD $249 one-time. Prices are in USD. All applicable taxes (GST for India) are added at checkout. Payment is processed by Dodo Payments; CUE never sees or stores card data.`],
      ['4. Lifetime, explained',
        `"Lifetime" means for as long as CUE (the product) operates. It does not obligate us to run the product forever. If we ever shut CUE down, we will (a) give at least 60 days notice, (b) let you download every item you unlocked, and (c) refund pro-rata for anything under 12 months old.`],
      ['5. License grant',
        `On payment, we grant you a non-exclusive, non-transferable, worldwide license to use CUE prompts and shipped code in unlimited personal projects, freelance work, client sites, and internal tools. You may modify freely. You may NOT: (a) resell or redistribute CUE prompts or code as a standalone product or template, (b) train an AI model on the CUE library, (c) create a competing prompt library primarily using CUE content, (d) share your Cue+ login. Team seats are per named person, not concurrent.`],
      ['6. Refunds',
        `Refunds are available for payment errors (duplicate charges, failed provisioning) and, within 24 hours of purchase, when no premium content has been copied or downloaded. See the Refund Policy for the specific eligibility rules.`],
      ['7. Your content',
        `If you submit feedback, ideas, or component requests, you grant CUE a perpetual, royalty-free license to use them to improve the product. We will never publish your submitted text with your name attached without your consent.`],
      ['8. Acceptable use',
        `Do not use CUE to build products that are illegal, defamatory, hateful, harass individuals, infringe copyright, or generate CSAM. Do not attempt to bypass our RLS or scrape at industrial scale (a sensible amount for building your own project is fine). Do not use the feedback channel to send abuse, threats, or spam. We may suspend accounts that break these rules; egregious violations are terminated without refund.`],
      ['9. No warranty',
        `CUE is provided "as is." We hand-test every item, but we do not guarantee that any prompt will produce the same output on every run of every AI tool, or that any code will fit your specific stack without modification. You are responsible for reviewing what you ship.`],
      ['10. Liability',
        `To the fullest extent allowed by law, CUE's total liability to you is capped at what you paid us in the 12 months before the claim. We are not liable for lost profits, lost data, or indirect damages. This does not limit liability for fraud, gross negligence, or anything that cannot legally be limited.`],
      ['11. Indemnity',
        `You agree to indemnify CUE for third-party claims arising from your misuse of the product — e.g. shipping unlicensed content, harassing someone, or breaching this agreement.`],
      ['12. Governing law + disputes',
        `These terms are governed by the laws of India. Any dispute goes to the courts of Delhi, India, first. If you are a consumer outside India, mandatory local consumer protections in your country still apply to you regardless of this clause.`],
      ['13. Changes',
        `We may update these terms. Material changes are announced by email at least 14 days before they take effect. Continuing to use CUE after the effective date means you accept the update.`],
      ['14. Contact',
        `${CONTACT_EMAIL}. Put "Terms" in the subject for the fastest reply.`],
    ],
  },

  refund: {
    eyebrow: 'Legal',
    title: 'Refund Policy',
    lead: 'Honest and specific: what qualifies, what does not.',
    updated: EFFECTIVE,
    body: [
      ['The short version',
        `CUE is a digital product — prompts and code you can copy the moment you unlock them. Once content is delivered we cannot un-deliver it. So refunds are limited to cases where something actually went wrong: a technical charge you did not authorize, a payment we could not honour with access, or a genuine mismatch with what we advertised. We do not offer "changed my mind" refunds after download, because the free tier exists so you can evaluate CUE before paying.`],
      ['We refund fully when',
        `(a) You were charged twice for the same purchase (duplicate transaction). We refund the duplicate within 3 business days of confirming with Dodo. (b) Your payment cleared but access was never provisioned within 24 hours and we cannot fix it. (c) A material feature we advertised was not present at time of purchase (not "I did not like the style" — a factual mismatch you can point at). (d) You are within 24 hours of purchase and can confirm you have NOT copied or downloaded any Cue+ prompt or code. Our logs will show this — do not claim it if you did.`],
      ['We do not refund when',
        `(a) You changed your mind after unlocking / copying prompts. The free tier lets you preview enough to decide before paying. (b) You could not get an AI tool (Bolt, v0, Cursor, Framer, etc.) to produce the exact output you wanted. Those tools are third parties; we cannot control their behaviour. (c) Your project got cancelled or your client dropped out. (d) You realised after the fact that you already had another library that covered the same ground. (e) It has been more than 24 hours since purchase AND you have opened / copied any premium content.`],
      ['Payment errors we always fix',
        `Duplicate charges, currency mismatches (charged in the wrong currency), tax mistakes, and payments that failed at your bank but still showed as debited — email ${CONTACT_EMAIL} with your order id and a screenshot of the statement. We refund the difference (or the whole thing if it was a duplicate) within 3 business days.`],
      ['Team plans',
        `If you bought a 5-seat Team plan and only two seats were ever activated, we can refund the unused seats pro-rata within 14 days of purchase. After 14 days seats are non-refundable — but you can reassign them freely to new team members instead.`],
      ['How to request',
        `Email ${CONTACT_EMAIL} from the address on your account. Subject: "Refund — <order id>". Tell us which of the eligibility reasons above applies and include a screenshot of your statement if it is a payment error. We reply within 2 business days. If your case qualifies, the refund goes back on the original payment rail — card refunds land in 5–10 business days, UPI within 3, international cards up to 14.`],
      ['Chargebacks',
        `If you skip this policy and file a chargeback with your bank instead, we will submit our records (purchase logs, copy events, unlock events) and defend legitimate charges. Fraudulent chargeback attempts get the account terminated and blocked from future purchase.`],
      ['Cancelling your account',
        `Since Cue+ is lifetime, there is no subscription to cancel. If you simply want your account and personal data fully deleted, email ${CONTACT_EMAIL} — we delete within 7 days and confirm by reply. Deletion does not trigger a refund on its own; it is a separate request.`],
      ['Statutory rights',
        `Nothing above waives your statutory rights under Indian consumer law (Consumer Protection Act, 2019) or, if applicable, local consumer protection law in your country. If a mandatory rule in your jurisdiction gives you a wider refund right, that rule applies. Digital goods bought after explicit consent to immediate delivery are treated per the applicable local rules.`],
      ['Contact',
        `${CONTACT_EMAIL}. Refunds are handled by the founder — not a support bot. Please give us 2 business days to respond before escalating.`],
    ],
  },

  license: {
    eyebrow: 'Legal',
    title: 'License Agreement',
    lead: 'What Cue+ gets you — and what it does not.',
    updated: EFFECTIVE,
    body: [
      ['Grant',
        `On payment of Cue+ (Individual or Team), you receive a non-exclusive, non-transferable, worldwide, perpetual (see "lifetime" in Terms) license to use CUE prompts, sample code, and included assets in your work.`],
      ['You can',
        `Use CUE content in unlimited personal projects. Use it in freelance / agency work for paying clients. Use it in commercial products your team ships. Modify prompts, remix code, keep changes private. Reference CUE items by name in blog posts, tutorials, and case studies.`],
      ['You cannot',
        `Resell CUE prompts or code as a standalone product. Redistribute the CUE library (whole or in part) as a template pack, ZIP dump, or competing library. Train an AI model on CUE content. Publish CUE prompts to a public prompt marketplace under your name. Share your Cue+ login with anyone outside your team plan.`],
      ['Attribution',
        `Not required. If you do credit us, "Interactions curated by CUE — usecue.com" is enough. We appreciate but never require it.`],
      ['Team plan specifics',
        `The Team plan covers up to 5 named individuals in a single company or freelance collective. Each seat is a named person — you cannot use one seat as a shared login. The team owner (the person who paid) manages seats. When a team member leaves, you can transfer their seat to a replacement.`],
      ['Ownership',
        `The prompts, code, and library structure remain the intellectual property of CUE. This license does not transfer ownership. It gives you the right to use, not the right to claim authorship of CUE-original material.`],
      ['Termination',
        `If you materially breach this license (mostly: reselling, sharing accounts, or training AI models on the library), we may terminate your license without refund. In practice we email first and give you 14 days to fix the issue.`],
      ['Contact',
        `${CONTACT_EMAIL}. Put "License" in the subject if you have a specific question about a use case.`],
    ],
  },
}

export default function Legal({ slug }) {
  const page = PAGES[slug] || {
    eyebrow: 'Legal',
    title: 'Not found',
    lead: 'This page does not exist.',
    updated: '',
    body: [['', 'Head back to the homepage.']],
  }
  usePageMeta({ title: page.title, description: page.lead })

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
      <nav style={{
        position: 'sticky', top: 0, zIndex: 10, background: '#060606',
        padding: '16px 24px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <a href="#/" style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 22, color: 'var(--text)', textDecoration: 'none' }}>CUE</a>
        <span style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>{page.eyebrow}</span>
        <a href="#/" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-dim)', textDecoration: 'none' }}>← Back to library</a>
      </nav>

      <article style={{ maxWidth: 760, margin: '0 auto', padding: '80px 24px 100px' }}>
        <div style={{ fontSize: 10.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--electric)', fontWeight: 700, marginBottom: 12 }}>
          {page.eyebrow}
        </div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 300, fontSize: 'clamp(48px, 8vw, 88px)', fontStyle: 'italic', letterSpacing: '-0.03em', lineHeight: 1, margin: 0 }}>
          {page.title}
        </h1>
        <p style={{ margin: '24px 0 6px', fontSize: 16, color: 'var(--text-dim)', lineHeight: 1.55, maxWidth: 620 }}>{page.lead}</p>
        {page.updated && <div style={{ fontSize: 11.5, color: 'var(--text-dim)', letterSpacing: '0.06em' }}>{page.updated}</div>}

        <div style={{
          marginTop: 28, marginBottom: 40, padding: '12px 14px',
          background: 'rgba(204,255,0,0.06)', border: '1px solid rgba(204,255,0,0.28)',
          borderRadius: 8, fontSize: 12.5, color: '#e8ff70', lineHeight: 1.5,
        }}>
          <strong style={{ color: '#ccff00' }}>Draft.</strong> This copy captures our real policy positions and is ready to publish.
          A qualified lawyer's review is pending before public launch — small language changes may follow.
        </div>

        {/* Cross-links to sibling policies */}
        <nav style={{ marginBottom: 28, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { slug: 'privacy', label: 'Privacy' },
            { slug: 'terms',   label: 'Terms' },
            { slug: 'refund',  label: 'Refund' },
            { slug: 'license', label: 'License' },
          ].map((l) => {
            const on = l.slug === slug
            return (
              <a key={l.slug} href={`#/legal/${l.slug}`} style={{
                padding: '6px 12px', borderRadius: 999,
                background: on ? 'rgba(0,0,255,0.12)' : 'transparent',
                border: `1px solid ${on ? 'var(--electric)' : 'var(--border)'}`,
                color: on ? '#fff' : 'var(--text-dim)',
                fontSize: 12, textDecoration: 'none', letterSpacing: '0.02em',
              }}>{l.label}</a>
            )
          })}
        </nav>

        {/* Table of contents — only for pages with 5+ sections */}
        {page.body.length >= 5 && (
          <details style={{
            marginBottom: 36, padding: '10px 14px',
            background: '#0e0e10', border: '1px solid var(--border)', borderRadius: 8,
          }}>
            <summary style={{ cursor: 'pointer', fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 600 }}>
              Contents
            </summary>
            <ol style={{ margin: '12px 0 4px 20px', padding: 0, color: 'var(--text-dim)' }}>
              {page.body.filter(([h]) => h).map(([h], i) => (
                <li key={i} style={{ marginBottom: 4 }}>
                  <a href={`#${slugify(h)}`} style={{ color: 'var(--text)', textDecoration: 'none', fontSize: 13 }}>{h}</a>
                </li>
              ))}
            </ol>
          </details>
        )}

        <div style={{ display: 'grid', gap: 28 }}>
          {page.body.map(([h, p], i) => (
            <section key={i} id={h ? slugify(h) : undefined} style={{ scrollMarginTop: 90 }}>
              {h && <h2 style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 24, fontWeight: 400, letterSpacing: '-0.01em', margin: '0 0 10px' }}>{h}</h2>}
              <p style={{ margin: 0, fontSize: 14.5, color: 'var(--text)', lineHeight: 1.75 }}>{p}</p>
            </section>
          ))}
        </div>
      </article>

      <Footer />
    </div>
  )
}
