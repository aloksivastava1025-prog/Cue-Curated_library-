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
const EFFECTIVE = 'Effective from public launch'

const CONTACT_EMAIL = 'hello@cuedesign.space'
const OPERATOR      = 'CUE (operated by an independent creator based in India)'

const PAGES = {
  privacy: {
    eyebrow: 'Legal',
    title: 'Privacy Policy',
    lead: 'What we collect, why, and how you control it.',
    updated: EFFECTIVE,
    body: [
      ['Who this covers',
        `This policy applies to everyone who visits cuedesign.space, signs into CUE, subscribes to Cue+, or submits feedback. ${OPERATOR}. There are no offices, staff, or subsidiaries elsewhere.`],
      ['Data you give us',
        `When you sign in through Clerk we receive your email address and, if you set one, a display name. When you upgrade to Cue+, our payment partner Dodo Payments collects your billing details directly — CUE only ever sees which plan you bought and the payment identifier, never your card number, CVV, or full billing address. If you submit feedback, we store the message, your email if you provided one, and the page you sent it from.`],
      ['Data collected automatically',
        `Standard product analytics: which items you open, which prompts you copy, which pages you view. Session recordings are captured to understand how the product is being used — masked for password fields and sensitive inputs. We do not run third-party advertising trackers, cross-site trackers, or device fingerprinting. IP addresses are handled transiently for spam / abuse prevention.`],
      ['How we use it',
        `Only to deliver the product: authenticating you, unlocking Cue+ content, remembering your saved items, responding to your messages, sending you drops you signed up for, and understanding aggregate usage to decide what to build next. We do not sell your data. We do not send marketing emails you did not ask for.`],
      ['Where it lives',
        `Application data is stored in Supabase (Postgres on AWS, US region). Auth is handled by Clerk. Payments are processed by Dodo Payments. Product analytics are handled by PostHog (US). Error monitoring is Sentry, with your email and Clerk user id scrubbed in the browser before any report is sent. Transactional email delivery is planned via Resend when it is wired up. On request we will share the current list of sub-processors under our contracts with them.`],
      ['Your rights — DPDP Act 2023 (India)',
        `You are a "Data Principal" under India's Digital Personal Data Protection Act, 2023. You have the right to (a) know what personal data we hold about you, (b) correct or complete it, (c) erase it, (d) withdraw consent, and (e) nominate someone to exercise these rights on your behalf. To exercise any of these, email ${CONTACT_EMAIL} from the address on your account. We aim to acknowledge within a few business days and complete within the statutory 30-day window.`],
      ['Your rights — GDPR (EU / UK / EEA)',
        `If you are in the EU, UK, or EEA, you have the equivalent rights under GDPR: access, rectification, erasure, restriction, portability, and objection. Contact ${CONTACT_EMAIL}. You may also complain to your local data protection authority.`],
      ['Retention',
        `Account data: kept until you delete your account. Feedback threads: kept while relevant to ongoing support, typically no longer than 24 months. Waitlist emails: kept until you unsubscribe. Payment records: kept for the period required by Indian tax law (currently up to 8 years). Aggregate analytics: kept indefinitely in anonymised form.`],
      ['Cookies and local storage',
        `Browser localStorage remembers which items you have viewed (so a view is not counted twice) and when you last checked your inbox. No advertising cookies. Clerk sets a session cookie for authentication. Analytics uses first-party cookies only.`],
      ['Children',
        `CUE is not intended for anyone under 18. We do not knowingly collect data from children. If we learn that we have, we delete it.`],
      ['Security',
        `Row-level security in Postgres restricts data to its owner or the site administrator. Secrets rotate on incident. No system is perfect. If we discover a breach affecting your personal data we will notify affected users without undue delay, and in any case within 72 hours of discovery where the breach is likely to result in risk to your rights.`],
      ['Changes',
        `We may update this policy. Material changes will be announced by email to active accounts at least 14 days before they take effect. The "effective from" date at the top is authoritative.`],
      ['Contact and grievance officer',
        `${CONTACT_EMAIL} for any privacy question. The same address serves as the grievance officer contact under the DPDP Act. Please put "Privacy" in the subject line.`],
    ],
  },

  terms: {
    eyebrow: 'Legal',
    title: 'Terms of Service',
    lead: 'The agreement between you and CUE. Short and specific.',
    updated: EFFECTIVE,
    body: [
      ['1. What CUE is',
        `CUE is a curated library of prompts and component references for building interfaces with AI tools such as Bolt, v0, Cursor, and Framer. Users copy prompts, paste them into their tool of choice, and use the result as a starting point they modify and ship. CUE does not host your projects, does not deploy your code, and does not run your application.`],
      ['2. Your account',
        `You must be at least 18 years old to create an account. You are responsible for keeping your Clerk login secure. One human, one account — do not share credentials. If you notice suspicious activity on your account, email ${CONTACT_EMAIL} promptly.`],
      ['3. Plans and payment',
        `The Free tier gives you preview access to selected items. Cue+ has two paid tiers: (a) Cue+ Founding Lifetime — a one-time purchase of USD $99 that unlocks the full library and every future drop for a single named user (founding pricing is capped at the first 50 members; standard lifetime is USD $249 after); (b) Cue+ Monthly — USD $49 per month, auto-renewing, cancel anytime. Prices displayed are inclusive of applicable taxes (Indian GST for buyers in India is already included in the shown INR price). Local currency is automatically selected at checkout by our payment partner based on your region. Payment is processed by Dodo Payments; CUE never sees or stores your card data.`],
      ['3a. Cancelling a subscription',
        `Cue+ Monthly is the only tier that can be cancelled — Cue+ Lifetime is a one-time purchase and has nothing to cancel. To cancel the monthly plan, open your signed-in Cue account, go to Billing, and use the "Manage subscription" link that opens the Dodo Payments customer portal (Dodo is our merchant of record; the cancel action happens there). Access continues until the end of the current billing period; no partial-month refunds. If the portal link is missing or misbehaves, email ${CONTACT_EMAIL} with the subject "Cancel Cue+ Monthly" and we will cancel manually within one business day and reply to confirm.`],
      ['4. What "lifetime" means',
        `"Lifetime" means for as long as CUE (the product) operates. It does not obligate us to run the product forever. If we ever decide to discontinue CUE, we will give at least 30 days notice by email and allow you to download every item you have unlocked before shutdown. Any refund at that point is at our discretion and will be a good-faith gesture, not a fixed formula.`],
      ['5. License grant — what you can do',
        `On payment, we grant you a non-exclusive, non-transferable, worldwide license to use CUE prompts and any shipped code in the following ways only: (a) unlimited personal projects (your own portfolio, side projects, learning), (b) freelance and agency client work where the deliverable is a specific website or product for that client, (c) internal tools inside your own company. You may modify prompts and code freely for these uses.`],
      ['5a. License grant — what you cannot do (strict)',
        `The Cue+ license is for BUILDING websites and products, not for BUILDING businesses on top of CUE's library. You may NOT: (a) resell, redistribute, or re-license CUE prompts, code, thumbnails, videos, or curated metadata — whole or in part, modified or unmodified — as a standalone product, template pack, component library, design system, or downloadable asset; (b) use CUE content as training data, fine-tuning data, retrieval corpus, or evaluation set for any machine-learning model, language model, image model, or AI system, whether internal or public; (c) build, launch, or operate a product, API, service, plugin, extension, MCP server, IDE integration, or platform that exposes CUE content (or content substantially derived from CUE content) to third parties or end-users other than yourself and your direct clients; (d) scrape, crawl, mass-download, or programmatically extract CUE content beyond what your own project needs (see section 8); (e) share, sublicense, or transfer your Cue+ login, API key, or access token to any other person or organisation; (f) remove or obscure CUE attribution, watermarks, or metadata from library assets you have accessed. Breach of this section 5a is a material breach that permits immediate termination without refund and may give rise to damages, injunction, and account-level ban.`],
      ['5b. Enterprise, platform, and AI-tool use — requires a separate license',
        `If you represent a company that operates an AI website builder, code generator, IDE, low-code platform, design tool, component marketplace, prompt marketplace, model training programme, or any product that would ingest, index, cache, redistribute, or route requests to CUE content on behalf of end-users — including but not limited to Lovable, v0, Bolt, Emergent, Cursor, Windsurf, Framer, Webflow, Wix, Squarespace, Figma, Anthropic, OpenAI, Google, Microsoft, Amazon, Meta, and any similar operator — the $99 Cue+ Founding Lifetime license does NOT grant you the right to use CUE for that purpose. This use requires a separate, negotiated commercial licence with terms, price, and scope agreed in writing between your company and CUE. Purchasing a personal Cue+ seat and then using it for any of the above operational purposes is a breach of section 5a and will be treated as such. Contact ${CONTACT_EMAIL} with the subject "Commercial licence enquiry" to discuss terms.`],
      ['6. Refunds',
        `Refunds are available for genuine payment errors and, within a narrow window from purchase, when no premium content has been copied or downloaded. Full eligibility rules are in the Refund Policy. Because CUE is a digital product where the value transfers the moment you copy a prompt, we do not offer "changed my mind" refunds once content has been unlocked.`],
      ['7. Your submissions',
        `If you send us feedback, ideas, or component requests, you grant CUE a perpetual, royalty-free license to use them to improve the product. We will not publish your submitted text with your name attached without your consent.`],
      ['8. Acceptable use',
        `Do not use CUE to build products that are illegal, defamatory, hateful, harassing, that infringe copyright, or that generate child sexual abuse material. Do not use feedback or contact channels for abuse, threats, or spam. We may suspend accounts that break these rules; egregious violations may be terminated without refund.`],
      ['8a. Scraping, automation, and bulk access',
        `You may copy the specific prompts and code you actually need for a specific project you are actively building. That is the normal, intended use. You may NOT: (a) run automated scripts, crawlers, headless browsers, or scraping tools against cuedesign.space or any CUE-hosted asset (Cloudflare R2, thumbnail CDN, video CDN, edge functions, or authenticated pages); (b) bulk-download the library, or any material subset of it, via any means — manual, automated, cached, or through a third-party proxy; (c) use API endpoints, RPCs, edge functions, or database queries that we did not publicly document, or exceed the rate limits we publish; (d) circumvent, disable, or interfere with authentication, entitlement checks, view counters, watermarks, or any technical measure we use to enforce this policy. We log copy, unlock, and download events per account and per IP. Signals of bulk extraction — repeated rapid-fire unlocks, sequential ID enumeration, header spoofing, automation user-agents, disposable-account patterns — will result in immediate suspension without warning and without refund. If your legitimate use case genuinely needs bulk access (e.g., a research project, an internal enterprise index), email ${CONTACT_EMAIL} with subject "Bulk access request" and describe the purpose — a case-by-case licence may be possible.`],
      ['9. No warranty',
        `CUE is provided "as is." We hand-test every item, but we do not guarantee that any prompt will produce the same output on every run of every AI tool, or that any code will fit your specific stack without modification. You are responsible for reviewing what you ship.`],
      ['10. Liability',
        `To the fullest extent allowed by law, CUE's total aggregate liability to you is capped at the amount you paid us in the 12 months before the claim (for one-time purchases, that means the amount you paid for your plan). We are not liable for lost profits, lost data, or indirect or consequential damages. This does not limit liability for fraud, gross negligence, or anything that cannot legally be limited.`],
      ['11. Indemnity',
        `You agree to indemnify CUE against third-party claims arising from your misuse of the product — for example, shipping unlicensed content, harassing someone, or breaching this agreement.`],
      ['12. Governing law and disputes',
        `These terms are governed by the laws of India. Any dispute will be subject to the exclusive jurisdiction of the courts of Delhi, India. If you are a consumer outside India, mandatory local consumer protections in your country still apply regardless of this clause.`],
      ['13. Changes',
        `We may update these terms. Material changes will be announced by email to active accounts at least 14 days before they take effect. Continuing to use CUE after the effective date means you accept the update.`],
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
        `CUE is a digital product — prompts and code you can copy the moment you unlock them. Once content is delivered we cannot un-deliver it. Refunds are therefore limited to (a) genuine payment errors and (b) purchases where you have not yet used the paid content. The Free tier exists so you can evaluate CUE before paying, so "changed my mind" refunds after unlocking are not available.`],
      ['We will refund fully when',
        `(a) You were charged more than once for the same purchase (duplicate transaction). (b) Your payment cleared but access was never provisioned within 24 hours and we cannot resolve it. (c) A material feature we advertised was not present at the time of purchase (a factual mismatch, not a style preference). (d) You are within 24 hours of purchase AND our logs show you have not copied or downloaded any Cue+ prompt or code. Do not claim this condition if it does not apply — our logs record the exact copy and download events.`],
      ['We will not refund when',
        `(a) You changed your mind after unlocking or copying prompts. The Free tier lets you preview enough to decide. (b) An AI tool (Bolt, v0, Cursor, Framer, etc.) did not produce the exact output you wanted. Those are third-party tools; we cannot control their behaviour. (c) Your project was cancelled or your client dropped out. (d) You realised after purchase that another library already covered the same ground. (e) More than 24 hours have passed since purchase and any premium content has been opened or copied.`],
      ['Payment errors we always fix',
        `Duplicate charges, currency mismatches, tax mistakes, and payments that failed at your bank but still showed as debited — email ${CONTACT_EMAIL} with your order id and a screenshot of the statement. Once we confirm with Dodo, we initiate the refund; the money then follows Dodo's and your bank's normal timelines, typically within a week for domestic cards and up to two weeks for international cards.`],
      ['How to request',
        `Email ${CONTACT_EMAIL} from the address on your account. Subject: "Refund — <order id>". Tell us which of the eligibility reasons above applies and attach a statement screenshot if it is a payment error. We aim to reply within 5 business days. Refunds are returned to the original payment rail — exact timing depends on your bank; we release the refund on our end promptly and the rail delivers it from there.`],
      ['Chargebacks',
        `If you skip this policy and file a chargeback with your bank instead, we will submit our records (purchase logs, copy events, unlock events) and defend legitimate charges. Fraudulent chargeback attempts result in the account being terminated and blocked from future purchase.`],
      ['Cancelling your account',
        `Cue+ Lifetime is a one-time purchase and has nothing to cancel. Cue+ Monthly is the auto-renewing tier — cancel any time from the "Manage subscription" link on your Cue Billing page (opens the Dodo Payments customer portal, our merchant of record; the cancel happens there). Access continues to the end of the current billing period, no partial-month refunds. If the portal link is missing or misbehaves, email ${CONTACT_EMAIL} with subject "Cancel Cue+ Monthly" and we cancel manually within one business day. If you want your account and personal data fully deleted, email us the same way — we delete within a reasonable time and confirm by reply. Deletion does not by itself trigger a refund; that is a separate request under the rules above.`],
      ['Statutory rights',
        `Nothing above waives your statutory rights under Indian consumer law (Consumer Protection Act, 2019) or, if applicable, local consumer protection law in your country. Where a mandatory local rule gives you a wider refund right, that rule applies. Digital goods purchased after your explicit consent to immediate delivery are treated per the applicable local rules.`],
      ['Contact',
        `${CONTACT_EMAIL}. Refunds are handled by the founder personally — please give us up to 5 business days to respond before escalating.`],
    ],
  },

  license: {
    eyebrow: 'Legal',
    title: 'License Agreement',
    lead: 'What Cue+ gets you — and what it does not.',
    updated: EFFECTIVE,
    body: [
      ['Grant',
        `On payment of Cue+ Founding Lifetime, you receive a non-exclusive, non-transferable, worldwide license to use CUE prompts, sample code, and included assets in your work, for as long as CUE (the product) operates (see "What lifetime means" in the Terms).`],
      ['You can',
        `Use CUE content in unlimited personal projects — your portfolio, side projects, learning, experiments. Use it in freelance and agency work where you are shipping a specific website or product for a paying client. Use it inside your own company's commercial products (websites, apps, marketing pages) that you own and ship. Modify prompts, remix code, keep changes private. Reference CUE items by name in blog posts, tutorials, talks, and case studies. Credit us if you like — it's appreciated but not required.`],
      ['You cannot (strict — read this)',
        `The Cue+ licence covers using CUE to build things. It does not cover using CUE to build a business on top of CUE. Specifically, you may NOT: (a) resell, redistribute, or re-license CUE prompts, code, thumbnails, videos, or metadata — whole or in part, modified or unmodified — as a standalone product, template pack, component library, design system, or any downloadable asset; (b) use CUE content as training data, fine-tuning data, retrieval corpus, embeddings source, or evaluation set for any AI model, whether internal, open-source, or commercial; (c) build, ship, or operate any product, API, service, plugin, extension, MCP server, IDE integration, or platform that exposes CUE content — or content derived from CUE content — to any third party or end-user other than yourself and your direct clients; (d) scrape, crawl, mass-download, or programmatically extract the library beyond the specific pieces you are using for a specific project; (e) share, sell, sublicense, or transfer your Cue+ login, API key, or access token to any other person or organisation; (f) remove or obscure attribution, watermarks, or hidden metadata; (g) publish CUE prompts to a public prompt marketplace under your own name.`],
      ['Enterprise, platform, and AI-tool use (separate licence required)',
        `If you represent an AI website builder, code generator, IDE, low-code tool, design platform, component marketplace, prompt marketplace, model training programme, or any product that would ingest, index, cache, redistribute, or route requests to CUE content on behalf of end-users — including but not limited to Lovable, v0, Bolt, Emergent, Cursor, Windsurf, Framer, Webflow, Figma, Anthropic, OpenAI, Google, Microsoft, Amazon, Meta, and any similar operator — the personal $99 Cue+ Lifetime licence does NOT grant you the right to use CUE for that purpose. That is a commercial platform use and requires a separately negotiated licence agreement in writing. Buying a personal seat and then using CUE for any of the above operational purposes will be treated as bad-faith breach and prosecuted accordingly. To discuss a commercial licence, email ${CONTACT_EMAIL} with the subject "Commercial licence enquiry" and tell us who you are, what your product does, and what scope you need.`],
      ['Enforcement',
        `We log every unlock, copy, and download event. If we discover breach — scraping, redistribution, AI training, competing library, unauthorised platform use — we will: (a) suspend the offending account and any linked accounts immediately, (b) issue a written cease-and-desist, (c) pursue damages, injunction, and account-level bans, and (d) publicly document confirmed offenders when appropriate. For company-scale breach by a well-funded operator (an AI platform, big tech, or a funded startup), we reserve the right to pursue damages proportionate to the value they extracted — this can be significant. Do not assume "small indie library" means "won't defend the licence." We will.`],
      ['Attribution',
        `Not required. If you do credit us, "Interactions curated by CUE — cuedesign.space" is enough. We appreciate but never require it.`],
      ['Ownership',
        `The prompts, code, curation, and library structure remain the intellectual property of CUE. This license does not transfer ownership. It gives you the right to use the material, not the right to claim authorship of CUE-original work.`],
      ['Termination',
        `If you materially breach this license — for example, reselling, publishing, sharing accounts, or training AI models on the library — we may terminate your license without refund. In practice, we will email first and give you a reasonable period (typically 14 days) to fix the issue before termination.`],
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
        <a href="/" style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 22, color: 'var(--text)', textDecoration: 'none', letterSpacing: '-0.01em' }}>Cue<span style={{ color: 'var(--electric)' }}>.</span></a>
        <span style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>{page.eyebrow}</span>
        <a href="/" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-dim)', textDecoration: 'none' }}>← Back to library</a>
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

        {/* Cross-links to sibling policies */}
        <nav style={{ marginTop: 32, marginBottom: 28, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
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
              <p style={{ margin: 0, fontSize: 14.5, color: 'var(--text)', lineHeight: 1.75, whiteSpace: 'pre-line' }}>{p}</p>
            </section>
          ))}
        </div>
      </article>

      <Footer />
    </div>
  )
}
