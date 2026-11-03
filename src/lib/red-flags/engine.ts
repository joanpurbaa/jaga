export type MessageContext =
	| "auto"
	| "official"
	| "commerce"
	| "investment"
	| "job";
export type FindingLevel = "perhatian utama" | "janggal";
export type Rule = {
	id: string;
	category: string;
	contexts: MessageContext[];
	level: FindingLevel;
	patterns: RegExp[];
	explanation: string;
	action: string;
};
export type Finding = {
	id: string;
	category: string;
	level: FindingLevel;
	quote: string;
	start: number;
	end: number;
	explanation: string;
	action: string;
};

type NormalizedText = { value: string; starts: number[]; ends: number[] };

// Each normalized UTF-16 code unit retains the span it came from, so highlights
// always point to the user's original text even after zero-width/repeat cleanup.
export function normalizeWithMap(input: string): NormalizedText {
	let value = "";
	const starts: number[] = [];
	const ends: number[] = [];
	let lastSpace = false;
	let prior = "";
	let repeatCount = 0;

	for (let i = 0; i < input.length;) {
		const codePoint = input.codePointAt(i)!;
		const char = String.fromCodePoint(codePoint);
		const width = char.length;
		const originalEnd = i + width;
		i = originalEnd;
		if (/[\u200B-\u200F\uFEFF\u2060]/u.test(char)) continue;

		let folded = char.toLowerCase();
		const previous = input.slice(0, i - width).replace(/[\u200B-\u200F\uFEFF\u2060]+$/u, "").slice(-1);
		const next = input.slice(originalEnd).replace(/^[\u200B-\u200F\uFEFF\u2060]+/u, "").slice(0, 1);
		if (folded === "0" && (/[a-z]/iu.test(previous) || /[a-z]/iu.test(next))) folded = "o";
		else if (folded === "1" && /[a-z]/iu.test(next) && !/[0-9]/u.test(previous)) folded = "i";

		for (const unit of folded) {
			if (/\s/u.test(unit)) {
				if (lastSpace || value.length === 0) {
					if (lastSpace && starts.length) ends[ends.length - 1] = originalEnd;
					continue;
				}
				value += " ";
				starts.push(i - width);
				ends.push(originalEnd);
				lastSpace = true;
				prior = " ";
				repeatCount = 1;
				continue;
			}
			lastSpace = false;
			if (unit === prior) repeatCount++;
			else {
				prior = unit;
				repeatCount = 1;
			}
			if (repeatCount > 2) {
				ends[ends.length - 1] = originalEnd;
				continue;
			}
			value += unit;
			for (let j = 0; j < unit.length; j++) {
				starts.push(i - width);
				ends.push(originalEnd);
			}
		}
	}
	return { value: value.trimEnd(), starts, ends };
}


const general: MessageContext[] = ["auto", "official", "commerce", "investment", "job"];
const rules: Rule[] = [
	{
		id: "urgent-pressure", category: "Tekanan waktu", contexts: general, level: "janggal",
		patterns: [/\bsegera\b/, /\bhari ini juga\b/, /\b1\s*x\s*24\s*jam\b/, /\bsisa (?:slot|kuota)\b/, /\bjangan sampai kehabisan\b/, /\bburua{1,2}n\b/, /\bsebelum (?:pukul|jam)\b/],
		explanation: "Batas waktu yang mendesak bisa membuat orang melewatkan pemeriksaan. Tenggat waktu saja belum membuktikan ada penipuan.",
		action: "Berhenti sejenak dan pastikan tenggat itu melalui kanal yang kamu cari sendiri.",
	},
	{
		id: "secret-code", category: "Permintaan data rahasia", contexts: general, level: "perhatian utama",
		patterns: [/\b(?:otp|pin|cvv)\b/, /\bkode (?:verifikasi|otp)\b/, /\bkata sandi\b/, /\bpassword\b/, /\bkode masuk\b/],
		explanation: "Kode verifikasi, PIN, CVV, dan kata sandi dapat memberi akses ke akun atau pembayaran. Pihak lain tidak perlu memintanya lewat chat.",
		action: "Jangan kirim kodenya; hubungi penyedia layanan melalui aplikasi atau kanal resminya.",
	},
	{
		id: "move-platform", category: "Pindah kanal", contexts: general, level: "janggal",
		patterns: [/\bpindah ke (?:wa|whatsapp|telegram)\b/, /\blanjut (?:chat|komunikasi) (?:di|lewat) (?:wa|whatsapp|telegram)\b/, /\bchat (?:aku|saya) di (?:wa|whatsapp|telegram)\b/, /\bkontak (?:wa|whatsapp|telegram) pribadi\b/],
		explanation: "Mengajak pindah kanal dapat mengurangi perlindungan atau catatan dari platform awal. Konteks dan kebijakan platform tetap perlu diperiksa.",
		action: "Lanjutkan percakapan di kanal awal sampai identitas dan prosesnya jelas.",
	},
	{
		id: "install-link", category: "Tautan atau berkas", contexts: general, level: "perhatian utama",
		patterns: [/\binstall aplikasi\b/, /\bunduh (?:file|berkas|aplikasi|apk)\b/, /\bklik (?:tautan|link|view)\b/, /\blihat resi\b/, /\bview (?:foto|gambar|dokumen)\b/, /\b[a-z0-9_-]+\.(?:pdf|jpg|png)\.apk\b/, /\b[a-z0-9_-]+\.apk\b/],
		explanation: "Tautan dan file yang diminta untuk dibuka atau dipasang dapat menjalankan tindakan pada perangkat. Nama file saja tidak memastikan jenis atau isinya.",
		action: "Jangan pasang file dari chat; periksa lewat aplikasi atau situs resmi yang kamu buka sendiri.",
	},
	{
		id: "authority-threat-reward", category: "Mengaku pihak resmi", contexts: ["auto", "official"], level: "perhatian utama",
		patterns: [/(?:akun|rekening|layanan) (?:anda|kamu) (?:akan )?(?:diblokir|ditangguhkan)/, /\bpegawai pajak\b/, /\banda terpilih\b/, /\bupdate data\b/, /\bverifikasi akun sekarang\b/, /\b(?:hadiah|bantuan) (?:anda|kamu) cair\b/],
		explanation: "Ancaman pemblokiran atau hadiah yang disertai permintaan tindakan bisa mendorong keputusan cepat. Teks ini sendiri tidak membuktikan siapa pengirimnya.",
		action: "Tutup pesan dan cari sendiri kanal resmi lembaga atau layanan yang disebut.",
	},
	{
		id: "keep-secret", category: "Diminta merahasiakan", contexts: general, level: "janggal",
		patterns: [/\bjangan bilang siapa[ -]?siapa\b/, /\brahasiakan dari (?:keluarga|teman|siapa pun)\b/, /\bjangan cerita ke siapa pun\b/],
		explanation: "Permintaan merahasiakan percakapan dapat menghalangi kamu meminta pendapat atau memeriksa informasi.",
		action: "Tunjukkan pesan kepada orang yang kamu percaya sebelum mengambil tindakan.",
	},
	{
		id: "commerce-no-protection", category: "Transaksi di luar perlindungan", contexts: ["auto", "commerce"], level: "perhatian utama",
		patterns: [/\b(?:transfer|tf) dulu\b/, /\btanpa (?:cod|rekber|rekening bersama)\b/, /\b(?:dp|uang muka) dulu\b/, /\btransfer langsung ke rekening pribadi\b/, /\bbayar (?:lewat|via) link di luar platform\b/],
		explanation: "Pembayaran langsung atau di luar mekanisme perlindungan platform bisa lebih sulit ditelusuri atau dibatalkan.",
		action: "Gunakan metode pembayaran dan perlindungan yang disediakan platform; periksa nama penerima sebelum membayar.",
	},
	{
		id: "commerce-price", category: "Harga tidak biasa", contexts: ["auto", "commerce"], level: "janggal",
		patterns: [/\bjauh di bawah pasar\b/, /\bcuci gudang\b/, /\bbanting harga\b/, /\bharga (?:murah|miring) banget\b/, /\bbonus (?:besar|melimpah)\b/],
		explanation: "Promosi besar bisa saja nyata, tetapi harga yang sangat berbeda patut dibandingkan dengan penjual dan daftar harga lain.",
		action: "Bandingkan harga dan reputasi penjual di dalam platform sebelum membayar.",
	},
	{
		id: "commerce-refund-trick", category: "Permintaan pengembalian dana", contexts: ["auto", "commerce"], level: "perhatian utama",
		patterns: [/\bsalah transfer\b/, /\bkelebihan transfer\b/, /\btolong kembalikan\b/, /\bbukti transfer sudah saya kirim\b/, /\bdana tertahan\b/, /\bbayar biaya admin dulu\b/],
		explanation: "Klaim salah transfer atau dana tertahan perlu dicocokkan dengan mutasi rekening dan aturan layanan pembayaran.",
		action: "Jangan mengembalikan dana berdasarkan bukti kiriman; cek mutasi dan hubungi penyedia pembayaran lewat aplikasi resminya.",
	},
	{
		id: "investment-guarantee", category: "Janji hasil investasi", contexts: ["auto", "investment"], level: "perhatian utama",
		patterns: [/\buntung pasti\b/, /\bprofit harian\b/, /\bgaransi uang kembali\b/, /\bmodal kecil untung besar\b/, /\brobot trading\b/, /\bajak teman dapat bonus\b/, /\bmember get member\b/, /\bkuota terbatas\b/],
		explanation: "Janji keuntungan pasti atau bonus dari mengajak anggota tidak menjelaskan risiko dan sumber hasilnya.",
		action: "Jangan setor dana dulu; periksa izin dan informasi produk melalui kanal resmi regulator yang relevan.",
	},
	{
		id: "loan-upfront", category: "Biaya pinjaman di muka", contexts: ["auto", "investment"], level: "perhatian utama",
		patterns: [/(?:pinjaman|dana) cair.{0,35}tanpa (?:jaminan|bi checking)/, /\btanpa (?:jaminan|bi checking)\b/, /\b(?:biaya|bayar) (?:admin|asuransi|pajak pencairan) dulu\b/, /\bbiaya pencairan\b/],
		explanation: "Janji pencairan mudah yang disertai biaya sebelum dana diterima patut diverifikasi. Pesan ini tidak cukup untuk memastikan status pemberi pinjaman.",
		action: "Jangan membayar biaya awal; cari sendiri legalitas pemberi pinjaman lewat kanal resmi OJK.",
	},
	{
		id: "app-permission", category: "Akses perangkat", contexts: ["auto", "investment"], level: "perhatian utama",
		patterns: [/\bakses (?:ke )?(?:galeri|kontak)\b/, /\bizinkan akses (?:kontak|foto|galeri)\b/],
		explanation: "Akses galeri atau kontak dapat membuka informasi pribadi yang tidak diperlukan untuk sebagian layanan.",
		action: "Jangan berikan izin sebelum memahami kebutuhan aplikasi dan memeriksa pengembangnya.",
	},
	{
		id: "job-upfront", category: "Biaya rekrutmen", contexts: ["auto", "job"], level: "perhatian utama",
		patterns: [/\b(?:bayar|biaya|transfer) (?:untuk )?(?:seragam|pelatihan|deposit|administrasi|admin)\b/, /\bdeposit (?:kerja|lowongan|rekrutmen)\b/],
		explanation: "Permintaan biaya sebelum mulai bekerja perlu diperiksa karena proses dan ketentuan rekrutmen bisa berbeda-beda.",
		action: "Minta rincian tertulis dan konfirmasi ke perusahaan lewat kontak resmi yang kamu temukan sendiri.",
	},
	{
		id: "job-high-pay", category: "Tawaran kerja", contexts: ["auto", "job"], level: "janggal",
		patterns: [/\btanpa pengalaman.{0,30}(?:gaji|rp)\s*(?:rp\s*)?(?:10|[1-9])\s*(?:juta|jt)\b/, /\bkerja santai dari rumah\b/, /\bgaji besar tanpa kualifikasi\b/],
		explanation: "Imbalan tinggi dengan syarat sangat sedikit perlu dibandingkan dengan deskripsi tugas, perusahaan, dan proses seleksinya.",
		action: "Cari lowongan yang sama di situs atau kanal resmi perusahaan dan pastikan rincian pekerjaannya.",
	},
	{
		id: "job-no-interview", category: "Proses rekrutmen", contexts: ["auto", "job"], level: "janggal",
		patterns: [/\blangsung diterima tanpa wawancara\b/, /\bditerima kerja tanpa (?:tes|interview|wawancara)\b/],
		explanation: "Penerimaan tanpa proses yang jelas membuat identitas pemberi kerja dan rincian pekerjaan perlu ditinjau lebih lanjut.",
		action: "Hubungi perusahaan melalui nomor atau situs resmi yang kamu cari sendiri untuk memastikan tawarannya.",
	},
	{
		id: "job-task-topup", category: "Tugas dan top-up", contexts: ["auto", "job"], level: "perhatian utama",
		patterns: [/\b(?:like|subscribe) (?:dan )?(?:dapat|dibayar|dibayar)\b/, /\btugas (?:like|subscribe)\b/, /\btop[ -]?up (?:saldo|dulu)\b/, /\bdeposit untuk (?:tugas|komisi)\b/],
		explanation: "Tugas sederhana yang meminta top-up atau deposit dapat memindahkan risiko pembayaran ke pencari kerja.",
		action: "Jangan top-up untuk menerima tugas; konfirmasi lowongan lewat kanal resmi perusahaan.",
	},
	{
		id: "job-private-contact", category: "Kontak rekrutmen", contexts: ["auto", "job"], level: "janggal",
		patterns: [/\b(?:hubungi|kontak|chat) hanya (?:lewat|via) wa\b/, /\bwhatsapp pribadi\b/, /\brekrutmen hanya lewat whatsapp\b/],
		explanation: "Kontak pribadi saja tidak cukup untuk memastikan hubungan seseorang dengan perusahaan.",
		action: "Cari kontak perusahaan secara mandiri dan tanyakan apakah perekrut serta lowongannya terdaftar.",
	},
	{
		id: "wallet-card-social", category: "Tawaran kartu dompet digital", contexts: ["auto", "commerce"], level: "janggal",
		patterns: [/\bkartu (?:fisik )?(?:e-?wallet|dompet digital)\b/, /\bkartu saldo (?:gratis|murah)\b/],
		explanation: "Tawaran kartu atau saldo lewat unggahan sosial perlu dicocokkan dengan produk dan penjual resmi layanan terkait.",
		action: "Periksa ketersediaan produk langsung di aplikasi atau situs resmi penyedia dompet digital.",
	},
];

export const RULES = rules;

export const RULE_TEST_CASES: Record<string, { positive: string; negative: string }> = {
	"urgent-pressure": { positive: "Buruaaan, sisa slot hari ini juga.", negative: "Jadwal pengiriman hari Senin." },
	"secret-code": { positive: "Kirim kode OTP untuk lanjut.", negative: "Kode pesanan tertera pada nota." },
	"move-platform": { positive: "Pindah ke WhatsApp pribadi ya.", negative: "Kita lanjutkan lewat fitur chat aplikasi ini." },
	"install-link": { positive: "Klik view dan unduh resi.apk.", negative: "Tautan informasi tersedia di halaman bantuan." },
	"authority-threat-reward": { positive: "Akun Anda akan diblokir jika tidak update data.", negative: "Pembaruan layanan berlangsung hari Jumat." },
	"keep-secret": { positive: "Jangan bilang siapa-siapa ya.", negative: "Silakan diskusikan dengan keluarga." },
	"commerce-no-protection": { positive: "Transfer dulu tanpa rekber.", negative: "Pembayaran menggunakan fitur checkout platform." },
	"commerce-price": { positive: "Cuci gudang, harga jauh di bawah pasar.", negative: "Harga sesuai daftar produk." },
	"commerce-refund-trick": { positive: "Saya salah transfer, tolong kembalikan.", negative: "Transfer berhasil sesuai invoice." },
	"investment-guarantee": { positive: "Untung pasti dengan profit harian.", negative: "Nilai investasi dapat naik atau turun." },
	"loan-upfront": { positive: "Pinjaman cair tanpa BI checking, bayar biaya admin dulu.", negative: "Baca rincian biaya sebelum mengajukan pinjaman." },
	"app-permission": { positive: "Izinkan akses kontak dan galeri.", negative: "Aplikasi hanya meminta izin kamera saat memindai." },
	"job-upfront": { positive: "Bayar biaya seragam dulu.", negative: "Seragam disediakan perusahaan tanpa biaya." },
	"job-high-pay": { positive: "Tanpa pengalaman gaji 10 juta.", negative: "Gaji mengikuti pengalaman dan kualifikasi." },
	"job-no-interview": { positive: "Langsung diterima tanpa wawancara.", negative: "Tahapan wawancara dijadwalkan pekan depan." },
	"job-task-topup": { positive: "Tugas like dan top-up saldo dulu.", negative: "Tugas administrasi dibahas saat wawancara." },
	"job-private-contact": { positive: "Kontak hanya lewat WA pribadi.", negative: "Hubungi HR melalui email perusahaan." },
	"wallet-card-social": { positive: "Kartu dompet digital murah dijual di sini.", negative: "Baca informasi produk di aplikasi penyedia." },
};

export function analyzeMessage(text: string, context: MessageContext = "auto"): Finding[] {
	if (!text) return [];
	const normalized = normalizeWithMap(text);
	const findings: Finding[] = [];
	const seen = new Set<string>();
	for (const rule of rules) {
		if (context !== "auto" && !rule.contexts.includes(context) && !rule.contexts.includes("auto")) continue;
		for (const pattern of rule.patterns) {
			pattern.lastIndex = 0;
			for (const match of normalized.value.matchAll(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`))) {
				const from = match.index ?? 0;
				const to = from + match[0].length;
				if (!match[0] || from >= normalized.starts.length || to === 0) continue;
				const start = normalized.starts[from];
				const end = normalized.ends[Math.min(to - 1, normalized.ends.length - 1)];
				const key = `${rule.id}:${start}:${end}`;
				if (seen.has(key)) continue;
				seen.add(key);
				findings.push({ id: rule.id, category: rule.category, level: rule.level, quote: text.slice(start, end), start, end, explanation: rule.explanation, action: rule.action });
			}
		}
	}
	const rankContext = (finding: Finding) => {
		const rule = rules.find((item) => item.id === finding.id)!;
		return context !== "auto" && rule.contexts.includes(context) ? 0 : 1;
	};
	return findings.sort((a, b) => Number(a.level !== "perhatian utama") - Number(b.level !== "perhatian utama") || rankContext(a) - rankContext(b) || a.start - b.start);
}


export type LinkPart = { label: string; value: string };
export type LinkInspection = {
	url: string;
	parts: LinkPart[];
	observations: string[];
};

const URL_RE = /(?:https?:\/\/)?(?:[^\s/@]+@)?(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d{1,5})?(?:\/[^\s<>"']*)?|(?:https?:\/\/)?(?:[^\s/@]+@)?(?:\d{1,3}\.){3}\d{1,3}(?::\d{1,5})?(?:\/[^\s<>"']*)?/giu;
const MULTI_LEVEL_SUFFIXES = new Set(["co.id", "go.id", "ac.id", "or.id", "web.id", "sch.id", "my.id"]);
const SHORTENERS = new Set(["bit.ly", "tinyurl.com", "t.co", "s.id", "is.gd", "cutt.ly", "rb.gy"]);
const OFFICIAL_WORDS = /bank|pajak|kurir|resi|verifikasi|bea.?cukai|bantuan/iu;

function trimUrlCandidate(candidate: string) {
	return candidate.replace(/[),.!?;:]+$/u, "");
}


function registrableDomain(hostname: string) {
	const labels = hostname.toLowerCase().split(".").filter(Boolean);
	if (labels.length <= 2) return hostname;
	const suffix2 = labels.slice(-2).join(".");
	return labels.slice(-(MULTI_LEVEL_SUFFIXES.has(suffix2) ? 3 : 2)).join(".");
}


export function inspectLinks(text: string): LinkInspection[] {
	const found = new Set<string>();
	const results: LinkInspection[] = [];
	for (const match of text.matchAll(URL_RE)) {
		const raw = trimUrlCandidate(match[0]);
		const dedupeKey = raw.toLowerCase();
		if (found.has(dedupeKey)) continue;
		found.add(dedupeKey);
		const withProtocol = /^https?:\/\//iu.test(raw) ? raw : `https://${raw}`;
		let parsed: URL;
		try { parsed = new URL(withProtocol); } catch { continue; }
		const hostname = parsed.hostname.toLowerCase();
		const labels = hostname.split(".");
		const isIp = /^(?:\d{1,3}\.){3}\d{1,3}$/u.test(hostname);
		const rootDomain = isIp ? hostname : registrableDomain(hostname);
		const hostParts = hostname === rootDomain ? rootDomain : `${labels.slice(0, -rootDomain.split(".").length).join(".") || "(tidak ada)"} → ${rootDomain}`;
		const path = parsed.pathname === "/" ? "(tidak ada)" : parsed.pathname;
		const extension = path.split("/").pop()?.includes(".") ? path.split("/").pop()!.split(".").pop()! : "(tidak ada)";
		const observations: string[] = [];
		if (SHORTENERS.has(rootDomain)) observations.push("Domain ini dikenal sebagai layanan pemendek tautan; tujuan akhirnya belum terlihat dari teks.");
		if (isIp) observations.push("Alamat tujuan memakai angka IP, bukan nama domain biasa.");
		if (parsed.username || parsed.password || raw.includes("@")) observations.push("Tautan memuat karakter @ yang bisa membingungkan bagian alamat.");
		if ((hostname.match(/-/gu) ?? []).length >= 2) observations.push("Nama domain memiliki beberapa tanda hubung.");
		if (hostname.includes("xn--")) observations.push("Domain memakai bentuk punycode yang dapat mewakili karakter internasional.");
		if (/^(?:apk|xapk|apks|exe|msi|dmg|pkg|bat|cmd|scr)$/iu.test(extension)) observations.push(`Ekstensi berkas .${extension} dapat menjalankan atau memasang aplikasi.`);
		const nonRootHost = hostname.replace(rootDomain, "");
		if (OFFICIAL_WORDS.test(`${nonRootHost}${path}`) && !OFFICIAL_WORDS.test(rootDomain)) observations.push("Kata yang tampak resmi muncul di subdomain atau jalur, bukan di domain utama.");
		results.push({
			url: raw,
			parts: [
				{ label: "Protokol", value: /^https?:\/\//iu.test(raw) ? parsed.protocol.replace(":", "") : "Tidak dicantumkan" },
				{ label: "Subdomain → domain utama", value: hostParts },
				{ label: "Domain utama sebenarnya", value: rootDomain },
				{ label: "Jalur", value: path },
				{ label: "Ekstensi file", value: extension },
			],
			observations,
		});
	}
	return results;
}


export const EXAMPLES: Record<Exclude<MessageContext, "auto"> | "auto", string> = {
	auto: "Halo, paket alat tulis yang kamu pesan sudah kami siapkan.\nUntuk mempertahankan harga, transfer hari ini juga ke rekening pribadi. Transfer dulu ya.\nKalau sudah, kirim bukti transfer ya.\nTerima kasih, pesanan akan dikemas besok.",
	official: "Pemberitahuan layanan ContohNet: pemeliharaan dijadwalkan hari Jumat pukul 22.00.\nAkun Anda akan diblokir hari ini juga jika tidak update data di tautan contoh-verifikasi.invalid.\nJangan bilang siapa-siapa dan kirim kode OTP agar akun kembali aktif.\nTerima kasih sudah membaca pemberitahuan ini.",
	commerce: "Halo, sepatu ukuran 38 masih tersedia dan bisa dikirim hari Senin.\nCuci gudang, harga jauh di bawah pasar, transfer dulu ke rekening pribadi ya, tanpa rekber.\nKalau ada pertanyaan ukuran, boleh tanya dulu.\nFoto tambahan bisa saya kirim lewat chat ini.",
	investment: "Kami mengadakan kelas pengelolaan keuangan daring setiap Sabtu.\nRobot trading ini menjanjikan profit harian dan untung pasti, modal kecil untung besar.\nAjak teman dapat bonus; kuota terbatas. Buruan daftar hari ini ya.\nMateri kelas dan biaya akan dijelaskan sebelum pendaftaran.",
	job: "Wawancara hari Senin jam 10 di kantor kami, bawa CV.\nPosisi admin media sosial, jam kerja Senin sampai Jumat.\nTanpa pengalaman gaji 10 juta, langsung diterima tanpa wawancara.\nBayar biaya seragam dulu lewat WhatsApp pribadi.\nRincian tugas dijelaskan saat bertemu.",
};

export const VERIFICATION_STEPS: Record<MessageContext, string[]> = {
	auto: ["Jangan membagikan OTP, PIN, kata sandi, atau data sensitif.", "Cari sendiri kanal resmi pihak yang disebut dan tanyakan apakah pesan itu benar.", "Jangan membuka tautan atau memasang file sebelum memahami sumbernya.", "Minta pendapat orang tepercaya jika pesan mendesak atau meminta rahasia."],
	official: ["Buka aplikasi atau situs resmi dengan mengetik alamatnya sendiri.", "Cari nomor layanan pelanggan di kanal resmi, bukan dari pesan yang diterima.", "Jangan membagikan kode OTP, PIN, atau kata sandi lewat chat maupun telepon."],
	commerce: ["Cocokkan nama penerima dengan nama penjual sebelum membayar.", "Gunakan COD atau rekening bersama yang disediakan platform bila tersedia.", "Hindari tautan pembayaran di luar platform; selesaikan transaksi di aplikasi resmi.", "Tanyakan detail barang yang hanya penjualnya bisa jawab dan simpan percakapan."],
	investment: ["Cari sendiri status izin produk dan penyedia melalui kanal resmi OJK.", "Baca dokumen risiko, biaya, dan sumber imbal hasil sebelum menyetor dana.", "Jangan transfer biaya awal atau mengajak orang lain sebelum memahami produknya."],
	job: ["Cari lowongan yang sama di situs atau kanal resmi perusahaan.", "Konfirmasi nama perekrut lewat kontak perusahaan yang kamu temukan sendiri.", "Minta rincian tugas, gaji, dan tahapan seleksi secara tertulis.", "Jangan membayar biaya atau mengirim dokumen sensitif sebelum proses terverifikasi."],
};

export const WHAT_CANNOT_BE_CHECKED: Record<MessageContext, string[]> = {
	auto: ["Siapa pemilik nomor atau akun pengirim — cari kontak pihak yang disebut secara mandiri.", "Reputasi rekening dan tautan dari teks saja — gunakan kanal resmi penyedia layanan untuk memeriksa."],
	official: ["Identitas pengirim pesan — hubungi lembaga lewat nomor atau aplikasi resmi yang kamu cari sendiri.", "Status akun atau transaksi — cek langsung di aplikasi resmi, bukan melalui tautan pesan."],
	commerce: ["Reputasi penjual dan kepemilikan rekening — periksa riwayat di platform dan cocokkan nama penerima sebelum transfer.", "Kondisi barang — minta bukti terbaru dan gunakan mekanisme transaksi platform."],
	investment: ["Legalitas dan izin penyedia — cari nama badan usaha di kanal resmi OJK; jangan mengandalkan klaim dalam pesan.", "Usia domain atau tujuan akhir tautan — periksa secara mandiri tanpa memasukkan data sensitif."],
	job: ["Keberadaan perusahaan dan status lowongan — cari situs resmi perusahaan atau hubungi kontak yang tercantum di sana.", "Identitas perekrut — konfirmasi ke perusahaan, jangan hanya mengandalkan kartu nama atau profil chat."],
};

export function contextLabel(context: MessageContext) {
	return ({ auto: "Otomatis", official: "Chat dari pihak resmi", commerce: "Belanja dan jual-beli", investment: "Investasi dan pinjaman", job: "Lowongan kerja" })[context];
}

