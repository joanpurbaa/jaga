import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RULES,
  RULE_TEST_CASES,
  EXAMPLES,
  analyzeMessage,
  inspectLinks,
} from '../src/lib/red-flags/engine.ts';

test('setiap aturan punya pemicu dan contoh tanpa pemicu', () => {
  assert.equal(RULES.length, Object.keys(RULE_TEST_CASES).length);
  for (const rule of RULES) {
    const samples = RULE_TEST_CASES[rule.id];
    assert.ok(samples, `Kasus tes belum tersedia untuk ${rule.id}`);
    assert.ok(analyzeMessage(samples.positive).some((finding) => finding.id === rule.id), `${rule.id} tidak mengenali contoh positif`);
    assert.ok(!analyzeMessage(samples.negative).some((finding) => finding.id === rule.id), `${rule.id} salah menandai contoh negatif`);
  }
});

test('wawancara wajar tidak ditandai sebagai indikasi', () => {
  const findings = analyzeMessage('Wawancara hari Senin jam 10 di kantor kami, bawa CV.', 'job');
  assert.deepEqual(findings, []);
});

test('normalisasi tetap menunjuk kutipan asli dengan huruf berulang dan zero-width', () => {
  const text = 'Kirim 0\u200BTP hari ini.';
  const finding = analyzeMessage(text).find((item) => item.id === 'secret-code');
  assert.ok(finding);
  assert.equal(text.slice(finding.start, finding.end), '0\u200BTP');
  const repeated = 'Buruaaan, lakukan hari ini juga.';
  const urgency = analyzeMessage(repeated).find((item) => item.id === 'urgent-pressure');
  assert.ok(urgency);
  assert.equal(repeated.slice(urgency.start, urgency.end), 'Buruaaan');
});

test('contoh fiktif per konteks memicu sejumlah aturan yang relevan', () => {
  const expectations = {
    auto: ['commerce-no-protection', 'urgent-pressure'],
    official: ['secret-code', 'authority-threat-reward'],
    commerce: ['commerce-price', 'commerce-no-protection'],
    investment: ['investment-guarantee', 'urgent-pressure'],
    job: ['job-upfront', 'job-high-pay'],
  };
  for (const [context, ids] of Object.entries(expectations)) {
    const findings = analyzeMessage(EXAMPLES[context], context);
    for (const id of ids) assert.ok(findings.some((finding) => finding.id === id), `${context}: ${id}`);
  }
});

test('bedah URL menangani domain .co.id, subdomain, IP, punycode, APK, pemendek, dan tanpa protokol', () => {
  const links = inspectLinks('https://bank.login.example.co.id/cek https://203.0.113.10/a.apk https://xn--bcher-kva.example/kurir bit.ly/abc portal.invalid/login https://user@support--login.example.invalid/bank/cek');
  assert.equal(links.length, 6);
  assert.equal(links[0].parts.find((part) => part.label === 'Domain utama sebenarnya').value, 'example.co.id');
  assert.ok(links[0].observations.some((item) => item.includes('bukan di domain utama')));
  assert.ok(links[1].observations.some((item) => item.includes('angka IP')));
  assert.ok(links[1].observations.some((item) => item.includes('.apk')));
  assert.ok(links[2].observations.some((item) => item.includes('punycode')));
  assert.ok(links[2].observations.some((item) => item.includes('bukan di domain utama')));
  assert.ok(links[3].observations.some((item) => item.includes('pemendek')));
  assert.equal(links[4].url, 'portal.invalid/login');
  assert.equal(links[4].parts[0].value, 'Tidak dicantumkan');
  assert.ok(links[5].observations.some((item) => item.includes('karakter @')));
  assert.ok(links[5].observations.some((item) => item.includes('beberapa tanda hubung')));
  assert.ok(links[5].observations.some((item) => item.includes('bukan di domain utama')));
});
