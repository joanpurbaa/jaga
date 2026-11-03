import test from "node:test";
import assert from "node:assert/strict";
import { crc16CcittFalse, validateCrc } from "../src/lib/qris/crc.ts";
import { parseQris } from "../src/lib/qris/parser.ts";
import { compareMerchant } from "../src/lib/qris/compare.ts";

function payload(poi = "11", fields = "") {
	const body = `0002010102${poi}5204541153033605802ID5911TOKO CONTOH6007JAKARTA${fields}`;
	const beforeCrc = `${body}6304`;
	return `${beforeCrc}${crc16CcittFalse(beforeCrc)}`;
}

test("parses static and dynamic QRIS initiation indicators", () => {
	assert.equal(parseQris(payload("11")).getTagValue("01"), "11");
	assert.equal(parseQris(payload("12")).getTagValue("01"), "12");
});

test("checks valid and invalid CRC values", () => {
	const valid = payload();
	assert.equal(validateCrc(valid).valid, true);
	assert.equal(validateCrc(`${valid.slice(0, -1)}0`).valid, false);
});

test("rejects truncated or malformed TLV fields", () => {
	assert.throws(() => parseQris("000201010"), /terpotong/);
	assert.throws(() => parseQris("0005999"), /melebihi/);
});

test("parses transaction amount when present and leaves it absent otherwise", () => {
	assert.equal(parseQris(payload("12", "5405100.0")).getTagValue("54"), "100.0");
	assert.equal(parseQris(payload()).getTagValue("54"), undefined);
});

test("preserves merchant names for expected-name comparisons", () => {
	assert.equal(parseQris(payload()).getTagValue("59"), "TOKO CONTOH");
	assert.notEqual(parseQris(payload()).getTagValue("59"), "TOKO LAIN");
	assert.equal(compareMerchant("Toko Contoh", "TOKO CONTOH"), "match");
	assert.equal(compareMerchant("Toko Lain", "TOKO CONTOH"), "different");
	assert.equal(compareMerchant("", "TOKO CONTOH"), "unknown");
});
