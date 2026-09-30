// QA scenario tests for S001 文獻整理 deliverable.
// Run: node tests/literature_review.test.js
//
// These tests treat LITERATURE_REVIEW.md / REFERENCES.md / DELIVERY_REPORT.md
// as the "system under test" and SPEC.md's acceptance criteria as the contract.
// They probe boundary/fabrication risks that a normal-path read-through would
// not catch: numeric fidelity against the source PDF text, citation integrity,
// and internal consistency between the delivery report and the actual deliverable.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const LIT_PATH = path.join(ROOT, 'LITERATURE_REVIEW.md');
const REF_PATH = path.join(ROOT, 'REFERENCES.md');
const DELIVERY_PATH = path.join(ROOT, 'DELIVERY_REPORT.md');

// Attachment lives outside the project directory (sibling workspace dir), same
// path the SPEC.md references as the ground-truth source document.
const ATTACHMENT_PATH =
  '/home/luxz/Agent_lab/agent_lab/projects/test/workspace/attachments/s001/pqc-financial.pdf.txt';

const lit = fs.readFileSync(LIT_PATH, 'utf8');
const ref = fs.readFileSync(REF_PATH, 'utf8');
const delivery = fs.readFileSync(DELIVERY_PATH, 'utf8');
const attachment = fs.readFileSync(ATTACHMENT_PATH, 'utf8');
const attachmentFlat = attachment.replace(/\s+/g, '');

test('single-source disclaimer banner appears before §1', () => {
  const bannerIdx = lit.indexOf('本整理僅基於單一來源');
  const sec1Idx = lit.indexOf('## 1. 既有做法');
  assert.ok(bannerIdx !== -1, 'missing single-source disclaimer');
  assert.ok(sec1Idx !== -1, 'missing §1 既有做法 heading');
  assert.ok(bannerIdx < sec1Idx, 'disclaimer must appear before §1 (SPEC §4 template)');
});

test('TLS termination layer definition is stated (SPEC §1 broad definition)', () => {
  assert.match(lit, /WAF.{0,20}反向代理.{0,20}API gateway.{0,20}load balancer.{0,20}web server/);
});

test('at least 2 "existing approaches" entries with citations (T2 acceptance)', () => {
  const approachHeadings = [...lit.matchAll(/^### 1\.\d+ .+$/gm)];
  assert.ok(approachHeadings.length >= 2, `expected >=2 approaches, got ${approachHeadings.length}`);
  const sec1 = lit.slice(lit.indexOf('## 1. 既有做法'), lit.indexOf('## 2. 已知風險'));
  const citeCount = (sec1.match(/出處:\*{0,2}\s*\[1\]/g) || []).length;
  assert.strictEqual(citeCount, approachHeadings.length, 'every approach must cite [1] with a section ref');
});

test('at least 4 "known risks" entries, each with a citation (T3 acceptance)', () => {
  const riskHeadings = [...lit.matchAll(/^### 2\.\d+ .+$/gm)];
  assert.ok(riskHeadings.length >= 4, `expected >=4 risks, got ${riskHeadings.length}`);
  const sec2 = lit.slice(lit.indexOf('## 2. 已知風險'), lit.indexOf('## 3. 結論'));
  const citeCount = (sec2.match(/出處:\*{0,2}\s*\[1\]/g) || []).length;
  assert.strictEqual(citeCount, riskHeadings.length, 'every risk must cite [1] with a section ref');
});

test('conclusion is <=300 characters and self-contained (T4 acceptance)', () => {
  const match = lit.match(/## 3\. 結論\n\n([\s\S]+?)\n\n## 4\./);
  assert.ok(match, 'could not isolate §3 結論 paragraph');
  const conclusion = match[1];
  const charCount = conclusion.replace(/\s/g, '').length;
  assert.ok(charCount <= 300, `結論 is ${charCount} chars, exceeds SPEC §4 300-char limit`);
  assert.match(conclusion, /僅基於 Balaji et al\./, '結論須含單一來源聲明 (T4 acceptance)');
});

test('no fabricated placeholders in REFERENCES.md (T5: 無 TBD/待補)', () => {
  assert.doesNotMatch(ref, /\bTBD\b/);
  assert.doesNotMatch(ref, /待補/);
});

test('every [N] citation marker used in LITERATURE_REVIEW.md resolves in REFERENCES.md', () => {
  // Exclude prose that merely *describes* the source paper's own internal
  // bibliography numbering (e.g. "參考文獻 [17]" while discussing a text-
  // extraction artifact near the end of the PDF) — that is not a citation
  // marker of *this* document, just a quoted detail about the source.
  const citationLines = lit
    .split('\n')
    .filter((l) => !/參考文獻\s*\[\d+\]/.test(l));
  const markersUsed = new Set(
    [...citationLines.join('\n').matchAll(/\[(\d+)\]/g)].map((m) => m[1])
  );
  assert.deepStrictEqual([...markersUsed].sort(), ['1'], 'only reference [1] should ever be cited (single-source rule)');
  assert.match(ref, /^\[1\]/m, 'REFERENCES.md must define entry [1]');
});

test('REFERENCES.md has exactly one entry (SPEC §9 #1: single source only)', () => {
  const entries = [...ref.matchAll(/^\[\d+\]/gm)];
  assert.strictEqual(entries.length, 1, `expected exactly 1 reference entry, found ${entries.length}`);
});

// --- Fabrication guard: every load-bearing number attributed to the paper --
// must actually be traceable to the source text, not invented / misremembered.
test('numeric claims in LITERATURE_REVIEW.md are traceable to the source PDF text', () => {
  const mustAppearInSource = [
    '8,443',
    '12,875',
    '5,982',
    '28.9',
    '21.8',
    '24.7',
    '30.4',
  ];
  for (const n of mustAppearInSource) {
    assert.ok(lit.includes(n), `LITERATURE_REVIEW.md missing expected figure ${n}`);
    assert.ok(attachmentFlat.includes(n.replace(',', '')) || attachmentFlat.includes(n),
      `figure ${n} cited in LITERATURE_REVIEW.md not found anywhere in source attachment text`);
  }
});

// --- arXiv ID correction claim is the single highest-risk factual assertion --
// in this deliverable (it overrides SPEC.md's own stated identifier). Verify
// the reversed-watermark reconstruction actually holds against source lines.
test('arXiv ID correction (2605.17955v1, 2026-05-18) is reconstructable from the source watermark', () => {
  const lines = attachment.split('\n');
  // The garbled vertical watermark sits on 5 consecutive raw lines near the
  // top of page 1 in the .pdf.txt extraction.
  const watermarkLines = lines.slice(62, 67); // 0-indexed: source lines 63-67
  const reversedJoined = watermarkLines.map((l) => [...l].reverse().join('')).join(' ');
  assert.match(reversedJoined, /arXiv:2605\.17955v1/i,
    `reversed watermark did not reconstruct expected arXiv ID; got: "${reversedJoined}"`);
  assert.match(reversedJoined, /18/);
  assert.match(reversedJoined, /May/i);
  assert.match(reversedJoined, /2026/);

  // The corrected ID must be what both deliverables actually declare.
  assert.match(lit, /arXiv:2605\.17955v1/);
  assert.match(ref, /arXiv:2605\.17955v1/);
  // And the original (allegedly erroneous) SPEC.md identifier must NOT be
  // presented as fact anywhere without the correction context.
  assert.doesNotMatch(attachmentFlat, /arXiv:?2505\.17955/i);
});

// --- Internal consistency: does the PM's delivery report accurately describe --
// what the QA-visible deliverable actually contains? This is a scenario the
// "read the deliverable once and trust the report" path would not catch.
test('DELIVERY_REPORT.md truncation claim matches LITERATURE_REVIEW.md §4 (internal consistency)', () => {
  const deliveryClaimsTruncation = /附件文字截斷:部分章節未能完整閱讀/.test(delivery);
  const litClaimsNoTruncation = /附件截斷:無/.test(lit);
  assert.ok(
    !(deliveryClaimsTruncation && litClaimsNoTruncation),
    'DELIVERY_REPORT.md 已知限制表宣稱「部分章節未能完整閱讀」，但 LITERATURE_REVIEW.md §4 明確聲明「附件截斷：無」— 兩份文件對同一事實的陳述互相矛盾'
  );
});
