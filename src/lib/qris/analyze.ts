import type { ParsedQris, QrisFinding } from "@/types/qris";
import type { DecodedQris } from "@/types/qris";
import { validateCrc } from "./crc";

export function analyzeQris(payload: string, parsed: ParsedQris, decoded: Omit<DecodedQris, "crc" | "raw">): QrisFinding[] {
	const findings: QrisFinding[] = [];
	const add = (status: QrisFinding["status"], title: string, explanation: string, basis: string, limitation: string) => findings.push({ status, title, explanation, basis, limitation });
	const required = ["00", "01", "52", "53", "58", "59", "60"];
	const missing = required.filter((tag) => !parsed.getTag(tag));
	const account = parsed.root.some((node) => Number(node.tag) >= 26 && Number(node.tag) <= 51);
	if (!account) missing.push("26–51");
	if (missing.length) add("invalid", "Field wajib tidak lengkap", `Field berikut tidak ditemukan: ${missing.join(", ")}.`, "Field wajib dasar EMV QR Merchant-Presented Mode.", "Payload yang tidak lengkap tidak dapat dinilai secara penuh.");
	else add("valid", "Field wajib tersedia", "Field wajib dasar ditemukan.", "Tag 00, 01, 52, 53, 58, 59, 60 dan satu tag akun merchant 26–51.", "Kelengkapan field tidak membuktikan identitas penerima.");
	try {
		const crc = validateCrc(payload);
		add(crc.valid ? "valid" : "invalid", "Integritas CRC16", crc.valid ? "CRC cocok dengan payload yang dianalisis." : "CRC yang diberikan tidak cocok dengan hasil hitung.", `Diberikan ${crc.provided}; dihitung ${crc.calculated}.`, "CRC hanya memeriksa konsistensi payload, bukan keaslian atau keamanan merchant.");
	} catch {
		add("invalid", "Integritas CRC16", "Field CRC tidak tersedia atau formatnya tidak valid.", "Tag 63 dengan nilai empat digit heksadesimal harus menjadi field terakhir.", "Tanpa CRC yang valid, integritas payload tidak dapat diperiksa.");
	}
	if (parsed.root.some((node) => Number(node.tag) >= 26 && Number(node.tag) <= 51 && !node.children?.length)) add("warning", "Format akun merchant", "Ada template akun merchant yang tidak dapat dibaca sebagai TLV bersarang.", "Tag akun merchant 26–51.", "Spesifikasi/profil QRIS tertentu dapat menentukan struktur yang lebih khusus.");
	if (decoded.country && decoded.country !== "Indonesia") add("warning", "Kode negara", "Payload menyatakan negara selain Indonesia.", `Tag 58: ${decoded.country}.`, "Periksa konteks transaksi dan QR yang diberikan merchant.");
	if (decoded.currencyCode && !/^\d{3}$/.test(decoded.currencyCode)) add("invalid", "Kode mata uang", "Kode mata uang tidak mengikuti format tiga digit.", `Tag 53: ${decoded.currencyCode}.`, "Parser tidak memverifikasi pemrosesan transaksi oleh PJP.");
	if (parsed.getTag("58") && !/^[A-Z]{2}$/.test(parsed.getTagValue("58") ?? "")) add("invalid", "Kode negara", "Kode negara tidak mengikuti format ISO alpha-2.", `Tag 58: ${parsed.getTagValue("58")}.`, "Format yang benar bukan verifikasi negara merchant.");
	if (parsed.getTag("54") && !/^\d+(\.\d{1,2})?$/.test(parsed.getTagValue("54") ?? "")) add("invalid", "Nominal transaksi", "Nominal tidak mengikuti format numerik yang diharapkan.", `Tag 54: ${parsed.getTagValue("54")}.`, "Nominal yang tertulis tidak mengonfirmasi jumlah pada layar pembayaran.");
	if (parsed.getTag("01") && !["11", "12"].includes(parsed.getTagValue("01") ?? "")) add("warning", "Jenis QRIS", "Point of Initiation Method tidak dikenali.", `Tag 01: ${parsed.getTagValue("01")}.`, "Profil pembayaran tertentu mungkin memiliki aturan tambahan.");
	if (parsed.getTagValue("01") === "12" && !parsed.getTag("54")) add("warning", "Nominal transaksi", "QR dinamis tidak menyertakan nominal pada payload.", "Tag 01 menyatakan dynamic QR; tag 54 tidak ditemukan.", "Konfirmasi jumlah pada aplikasi pembayaran sebelum transaksi.");
	if (decoded.mcc && !/^\d{4}$/.test(decoded.mcc)) add("invalid", "Kategori usaha", "MCC tidak memiliki format empat digit.", `Tag 52: ${decoded.mcc}.`, "Kode dengan format benar belum memverifikasi kegiatan merchant.");
	else if (decoded.mcc && !decoded.mccDescription) add("unknown", "Kategori usaha", "MCC berformat benar, tetapi tidak ada dalam mapping kategori terbatas aplikasi.", `Tag 52: ${decoded.mcc}.`, "Tidak ada kesimpulan yang dibuat tentang usaha merchant.");
	if (decoded.acquirerGui) add("unknown", "Identitas PJP", "GUI PJP ditemukan tetapi belum diverifikasi terhadap direktori resmi.", `GUI: ${decoded.acquirerGui}.`, "Tidak tersedia koneksi ke direktori PJP resmi.");
	else add("unknown", "Identitas PJP", "Identitas PJP tidak tersedia dalam field yang dikenali.", "Informasi akun merchant yang berhasil diparse.", "Tidak tersedia koneksi ke direktori PJP resmi.");
	add("unknown", "Reputasi merchant", "Tidak tersedia sumber reputasi atau laporan komunitas yang terhubung.", "Tidak ada database laporan komunitas pada project.", "Tidak dapat menilai riwayat, keaslian, atau keamanan merchant.");
	return findings;
}

export { compareMerchant } from "./compare";
