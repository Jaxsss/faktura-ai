# Faktura

A Czech-first, browser-only invoice app for freelancers and small businesses. React, TypeScript and Vite; IndexedDB through Dexie; Zod backup validation; Decimal.js calculations; locally generated, text-based A4 PDFs with React PDF and an exact PDF.js preview.

## Run locally

Use Node.js 22.12+ (or a supported newer LTS) and pnpm 11:

```sh
pnpm install
pnpm dev
```

Open the local URL printed by Vite. No environment variables, API keys, accounts, or backend are needed.

```sh
pnpm test       # focused calculation, storage, backup, numbering and QR tests
pnpm build     # TypeScript check and static production build
pnpm preview   # serve the production build locally
pnpm format    # format source files
```

## Deploy

Deploy the contents of `dist/` to any static host, including Netlify, Vercel or Cloudflare Pages. Build command: `pnpm build`; output directory: `dist`. The app uses in-memory screen navigation, so no server route rewrites are necessary. Host the entire build, including `assets/` and `fonts/`, at the site root. For subdirectory hosting, configure Vite's `base` before building.

PDF code, the local PDF worker and bundled fonts are prepared during startup. After the workspace is ready, normal editing, saving, backups and PDFs do not require a network connection. Reloading or opening a new tab while offline is not guaranteed; there is intentionally no service worker or PWA infrastructure. No business data is sent to external services. All fonts, icons, QR generation and PDF assets are bundled locally.

## Workflow

1. Open **Nastavení** and enter company details, optional logo, bank details and defaults. Changes save automatically; save failures are shown explicitly.
2. Choose **Nová faktura**. Select a customer or create one inline (with an option to keep it off the directory).
3. Add descriptions, quantities, units, prices and any applicable tax rates. Commas and decimal points are accepted. Use due-date presets or choose a custom date.
4. Review the exact PDF preview, save the draft, or issue the invoice. Issuing finalizes the number and snapshots the supplier/customer details, then downloads the PDF. The saved document remains available if the download fails.
5. Search history, duplicate an invoice, mark it paid/unpaid, or explicitly edit an issued document. Paid dates are recorded. Overdue status is derived from the current local date.

Drafts are debounced into IndexedDB and flushed on navigation. Drafts do not consume numbering; several drafts may share a suggested number. Issuing checks duplicate finalized numbers and advances the configured sequence atomically. Manual invoice numbers do not realign the sequence automatically; update the next sequence in Settings when necessary. A new calendar year starts the suggestion at 1. Historical customer and supplier snapshots survive directory changes and deletions.

## Storage and backups

The `faktura-ai` IndexedDB database stores company settings, logo Blobs, customers, invoices and preferences. Data belongs to the current browser profile **and origin** (protocol, domain and port). It is not synced, encrypted by this application, or a permanent archive. Clearing site data, private browsing, storage eviction, moving domains or losing the device can lose it. Optional persistent-storage permission is a browser best effort, not a backup.

In **Nastavení → Data a zálohy**, export `faktury-zaloha-YYYY-MM-DD.json`. It includes schema version, timestamp, preferences, numbering, all customers, issued/paid invoices and incomplete drafts. Identical logos are deduplicated into portable base64 assets, including historical supplier logos.

Import validates the complete backup before presenting a summary. It offers a fresh export before replacing all existing data, preserves IDs and references, and restores all stores in a single IndexedDB transaction. It rejects malformed data, unsupported versions, duplicate issued numbers and dangling logo references. Schema version 1 also accepts inline logos. Backup files are limited to 50 MB; exports that exceed the limit fail clearly instead of producing a file that cannot be restored. Keep downloaded copies somewhere independent of browser storage.

## Supported invoice scenarios

- Czech non-VAT invoices in CZK, EUR and USD.
- Ordinary domestic VAT in CZK: separate 21%, 12% and 0% rates; inclusive or exclusive unit prices; mixed-rate breakdowns.
- Explicit domestic reverse charge between Czech VAT payers. Supplier VAT is not charged and the document states **Daň odvede zákazník**. Selection does not determine whether the supply legally qualifies.
- Explicit VAT exemption with a user-provided reason. Exemption is distinct from the ordinary 0% rate.
- Percentage discounts applied to each line before tax; fractional quantities and prices; zero-price items.
- Bank transfer, cash, card and other payment methods. Optional Czech QR payment for positive CZK bank transfers with a validated IBAN or Czech account. No third-party QR API.
- Logos, configurable invoice accent, customer and supplier contact details, registry text, delivery dates, references and long multi-page item descriptions.

This is an invoicing tool, not an accounting or tax-advice service. It does not cover every Czech tax scenario or assert blanket legal compliance. Foreign-currency VAT conversion, cross-border VAT supplies, corrective tax documents, advance invoices, negative adjustments, automatic exchange rates, banking reconciliation and accounting exports are outside its scope. Unsupported ordinary foreign-currency VAT and foreign VAT supplies are blocked with an explanation. For reverse charge or exemption, verify the legal treatment for the particular supply with your accountant.

The supported tax distinctions were checked against the [Czech VAT Act](https://e-sbirka.gov.cz/sb/2004/235) and [Financial Administration guidance on domestic reverse charge](https://financnisprava.gov.cz/cs/dane/dane/dan-z-pridane-hodnoty/informace-stanoviska-a-sdeleni/rezim-preneseni-danove-povinnosti). The app does not automatically track legislative changes.

## Calculation and PDF rules

One pure calculator supplies both the UI and PDF. Decimal arithmetic is used for multiplication, discounts, tax and aggregation. Each line rounds monetary amounts to two decimal places using HALF_UP. For inclusive prices, net is backed out of discounted gross and VAT is the gross/net difference. The invoice sums rounded lines; tax groups sum those same bases and taxes. All supported currencies use two decimal places. No hidden currency conversion or cash rounding is applied.

PDFs contain selectable text and vector rules, embedded Noto Sans fonts with Czech glyphs, A4 pagination and local QR images. The preview renders the resulting PDF itself. Draft exports are marked **KONCEPT**. A short footer repeats on each page; longer registry/footer text flows with the document. Noto Sans uses the SIL Open Font License, included in `public/fonts/OFL.txt`; Inter is bundled through `@fontsource/inter`.

## Verification

Automated tests cover decimal rounding, mixed VAT, inclusive prices, discounts, Czech decimal input, reverse charge, validation, numbering, stale draft races, preserved customer snapshots, atomic restore, malformed backups, portable logos and QR eligibility. Browser QA covered company setup, customer creation inline, draft reload, issuing/download, paid status, duplication, JSON export/import, logo upload, two-line discount totals, due-date presets/custom dates, and the 390 px editor layout. PDF QA includes rendered Czech documents, ordinary one-page invoices and long content across multiple A4 pages.

The primary target is current desktop browsers, with usable tablet/mobile layouts. Browser local storage must be enabled. Store PDF and JSON copies for documents you need to retain.
