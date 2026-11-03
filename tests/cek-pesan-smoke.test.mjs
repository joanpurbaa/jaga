import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const page = readFileSync(new URL('../src/app/cek-pesan/page.tsx', import.meta.url), 'utf8');
const home = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8');

test('route Cek Pesan merender alur input, privasi, contoh, hasil, dan reset', () => {
  assert.match(page, /"use client"/);
  assert.match(page, /Coba dengan contoh/);
  assert.match(page, /Teks yang kamu tempel hanya diproses di browser ini dan tidak dikirim ke mana pun/);
  assert.match(page, /Teks dengan sorotan/);
  assert.match(page, /Langkah verifikasi/);
  assert.match(page, /Cek pesan lain/);
  assert.doesNotMatch(page, /\bfetch\s*\(/);
  assert.doesNotMatch(page, /localStorage|sessionStorage/);
  assert.equal(existsSync(new URL('../src/app/api/cek-pesan', import.meta.url)), false);
});

test('kartu keempat mengarah ke route yang tersedia dan punya placeholder', () => {
  assert.match(home, /href: "\/cek-pesan"/);
  assert.match(home, /image: "\/card4\.webp"/);
  assert.match(home, /title: "Cek pesan"/);
  assert.equal(existsSync(new URL('../src/app/cek-pesan/page.tsx', import.meta.url)), true);
  assert.equal(existsSync(new URL('../public/card4.webp', import.meta.url)), true);
});
