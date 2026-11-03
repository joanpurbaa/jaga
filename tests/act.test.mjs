import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  INCIDENTS,
  ACTION_STEPS,
  OFFICIAL_SOURCES,
  buildActionPlan,
  buildIncidentSummary,
  buildGuardianWarning,
  urgencyLabel,
} from '../src/lib/act/plan.ts';
import {
  ACT_STORAGE_KEY,
  emptyActPlan,
  readActPlan,
  writeActPlan,
  clearActPlan,
} from '../src/lib/act/storage.ts';

// 1. Logika penggabungan langkah
test('pilihan multi kejadian menghasilkan daftar langkah tanpa duplikat dan terurut urgensi', () => {
  const plan = buildActionPlan(['transferred', 'shared-code', 'installed-app']);
  const ids = plan.map((s) => s.id);
  assert.equal(ids.length, new Set(ids).size, 'Daftar langkah memiliki duplikat');

  const urgencyOrder = { now: 0, hour: 1, today: 2, week: 3 };
  for (let i = 1; i < plan.length; i++) {
    assert.ok(
      urgencyOrder[plan[i].urgency] >= urgencyOrder[plan[i - 1].urgency],
      `Urutan urgensi salah pada langkah ${plan[i].id}`
    );
  }
});

test('setiap pilihan kejadian memunculkan minimal satu langkah di Sekarang atau Dalam 1 jam', () => {
  for (const incident of INCIDENTS) {
    const plan = buildActionPlan([incident.id]);
    const urgent = plan.filter((s) => s.urgency === 'now' || s.urgency === 'hour');
    assert.ok(
      urgent.length >= 1,
      `Kejadian "${incident.id}" tidak memiliki langkah dalam kelompok Sekarang atau Dalam 1 jam`
    );
  }
});

// 2. Data konten
test('setiap langkah punya judul, penjelasan, alasan, dan urgensi valid', () => {
  for (const step of ACTION_STEPS) {
    assert.ok(step.title && step.title.trim().length > 0, `Langkah ${step.id} tidak memiliki title`);
    assert.ok(step.description && step.description.trim().length > 0, `Langkah ${step.id} tidak memiliki description`);
    assert.ok(step.why && step.why.trim().length > 0, `Langkah ${step.id} tidak memiliki alasan (why)`);
    assert.ok(['now', 'hour', 'today', 'week'].includes(step.urgency), `Langkah ${step.id} memiliki urgensi tidak valid: ${step.urgency}`);
  }
});

test('setiap kanal sumber punya nama, url valid, tanggal verifikasi, dan tidak ada nomor telepon tanpa sumber', () => {
  for (const [key, source] of Object.entries(OFFICIAL_SOURCES)) {
    assert.ok(source.name && source.name.trim().length > 0, `Sumber ${key} tidak punya nama`);
    assert.ok(source.url && /^https?:\/\//.test(source.url), `Sumber ${key} tidak punya url http/https valid`);
    assert.ok(source.verifiedAt && /^\d{4}-\d{2}-\d{2}$/.test(source.verifiedAt), `Sumber ${key} tidak punya format tanggal YYYY-MM-DD valid`);
  }

  // Pastikan tidak ada nomor telepon karangan di seluruh deskripsi atau instruksi kanal
  // Pola nomor telepon Indonesia (misal 08xx, 1500xxx, +62)
  const phonePattern = /(?:\+62|08\d{2}|\b1500\d{3}\b|\b140\d{2}\b)/;
  for (const step of ACTION_STEPS) {
    assert.ok(
      !phonePattern.test(step.description),
      `Langkah ${step.id} mencantumkan nomor telepon tanpa verifikasi di description`
    );
    if (step.channelInstruction) {
      assert.ok(
        !phonePattern.test(step.channelInstruction),
        `Langkah ${step.id} mencantumkan nomor telepon tanpa verifikasi di channelInstruction`
      );
    }
  }
});

// 3. Penyimpanan (storage)
test('progres tersimpan dan terpulihkan dengan benar', () => {
  const store = new Map();
  const storage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  };

  const initial = {
    incidentIds: ['transferred', 'shared-code'],
    when: 'today',
    completedStepIds: ['stop-payment'],
  };

  const saved = writeActPlan(storage, initial);
  assert.equal(saved, true);

  const restored = readActPlan(storage);
  assert.equal(restored.available, true);
  assert.equal(restored.hadSavedPlan, true);
  assert.deepEqual(restored.state.incidentIds.sort(), ['shared-code', 'transferred']);
  assert.equal(restored.state.when, 'today');
  assert.deepEqual(restored.state.completedStepIds, ['stop-payment']);
});

test('"Hapus data saya" benar-benar mengosongkan penyimpanan', () => {
  const store = new Map();
  const storage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  };

  writeActPlan(storage, {
    incidentIds: ['transferred'],
    when: 'recent',
    completedStepIds: ['stop-payment'],
  });

  const cleared = clearActPlan(storage);
  assert.equal(cleared, true);

  const readAfter = readActPlan(storage);
  assert.equal(readAfter.hadSavedPlan, false);
  assert.deepEqual(readAfter.state.incidentIds, []);
  assert.deepEqual(readAfter.state.completedStepIds, []);
});

test('aplikasi tetap berjalan normal bila localStorage tidak tersedia atau berisi data rusak', () => {
  // null storage
  const nullRead = readActPlan(null);
  assert.equal(nullRead.available, false);
  assert.equal(nullRead.hadSavedPlan, false);
  assert.deepEqual(nullRead.state, emptyActPlan());

  const nullWrite = writeActPlan(null, emptyActPlan());
  assert.equal(nullWrite, false);

  const nullClear = clearActPlan(null);
  assert.equal(nullClear, false);

  // corrupt storage data
  const store = new Map([[ACT_STORAGE_KEY, '{ invalid json: broken data...']]);
  const storage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  };

  const corruptRead = readActPlan(storage);
  assert.equal(corruptRead.available, true);
  assert.equal(corruptRead.hadSavedPlan, false);
  assert.deepEqual(corruptRead.state, emptyActPlan());
});

// 4. Utility summary & warning & labels
test('buildIncidentSummary menyusun kerangka draf laporan dengan placeholder [isi sendiri]', () => {
  const summary = buildIncidentSummary(['transferred', 'shared-code'], 'recent', ['stop-payment']);
  assert.ok(summary.includes('[isi sendiri]'), 'Ringkasan harus berisi penanda [isi sendiri]');
  assert.ok(summary.includes('Sudah transfer uang atau membayar'));
  assert.ok(summary.includes('Baru saja (dalam 1 jam)'));
  assert.ok(summary.includes('Hubungi bank atau penyedia pembayaran'));
});

test('buildGuardianWarning menghasilkan pesan pencegahan yang sesuai', () => {
  const taken = buildGuardianWarning(['account-taken']);
  assert.ok(taken.includes('Akun saya sedang bermasalah'));
  assert.ok(taken.includes('jangan dituruti'));

  const general = buildGuardianWarning(['transferred']);
  assert.ok(general.includes('transaksi mencurigakan'));
  assert.notEqual(taken, general);
});

test('urgencyLabel mengembalikan label bahasa Indonesia yang benar', () => {
  assert.equal(urgencyLabel('now'), 'Sekarang');
  assert.equal(urgencyLabel('hour'), 'Dalam 1 jam');
  assert.equal(urgencyLabel('today'), 'Hari ini');
  assert.equal(urgencyLabel('week'), 'Minggu ini');
});

// 5. Smoke test end-to-end / UI Contract
test('kartu ke-5 di beranda memiliki spesifikasi tepat dan mengarah ke /terlanjur', () => {
  const homeCode = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8');
  assert.match(homeCode, /step:\s*"05"/);
  assert.match(homeCode, /eyebrow:\s*"Bertindak"/);
  assert.match(homeCode, /title:\s*"Sudah terlanjur\?"/);
  assert.match(homeCode, /duration:\s*"± 2 menit"/);
  assert.match(homeCode, /note:\s*"Tanpa data pribadi"/);
  assert.match(homeCode, /cta:\s*"Lihat langkahnya"/);
  assert.match(homeCode, /href:\s*"\/terlanjur"/);
  assert.match(homeCode, /image:\s*"\/card5\.webp"/);
  assert.equal(existsSync(new URL('../public/card5.webp', import.meta.url)), true);
});

test('halaman /terlanjur memiliki alur lengkap tanpa error dan tanpa API/fetch', () => {
  const pageCode = readFileSync(new URL('../src/app/terlanjur/page.tsx', import.meta.url), 'utf8');
  assert.match(pageCode, /"use client"/);
  assert.match(pageCode, /Sudah terlanjur\?/);
  assert.match(pageCode, /Tenang, mulai dari sini/);
  assert.match(pageCode, /Pilih apa yang sudah terjadi/);
  assert.match(pageCode, /Kapan kejadiannya\?/);
  assert.match(pageCode, /Tampilkan langkahnya/);
  assert.match(pageCode, /Siapkan bukti/);
  assert.match(pageCode, /Salin ringkasan kejadian/);
  assert.match(pageCode, /Beri tahu orang lain/);
  assert.match(pageCode, /Hapus data saya/);
  assert.match(pageCode, /iasc\.ojk\.go\.id/);
  assert.match(pageCode, /href="\/simulasi"/);
  assert.match(pageCode, /href="\/batasan"/);

  // Aturan keras: Tanpa server, tanpa AI, tanpa network fetch
  assert.doesNotMatch(pageCode, /\bfetch\s*\(/);
  assert.equal(existsSync(new URL('../src/app/api/terlanjur', import.meta.url)), false);
});

test('semua titik masuk ke /terlanjur tersedia di fitur lain dan batasan diperbarui', () => {
  const lowonganCode = readFileSync(new URL('../src/app/cek-lowongan/page.tsx', import.meta.url), 'utf8');
  const qrisCode = readFileSync(new URL('../src/app/cek-qris/page.tsx', import.meta.url), 'utf8');
  const pesanCode = readFileSync(new URL('../src/app/cek-pesan/page.tsx', import.meta.url), 'utf8');
  const simulasiCode = readFileSync(new URL('../src/app/simulasi/page.tsx', import.meta.url), 'utf8');
  const batasanCode = readFileSync(new URL('../src/app/batasan/page.tsx', import.meta.url), 'utf8');

  assert.match(lowonganCode, /href="\/terlanjur"/);
  assert.match(qrisCode, /href="\/terlanjur"/);
  assert.match(pesanCode, /href="\/terlanjur"/);
  assert.match(simulasiCode, /href="\/terlanjur"/);

  assert.match(batasanCode, /Sudah terlanjur\?/);
  assert.match(batasanCode, /localStorage/);
  assert.match(batasanCode, /bukan nasihat hukum/i);
});
