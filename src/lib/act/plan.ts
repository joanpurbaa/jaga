export const INCIDENTS = [
	{ id: "transferred", label: "Sudah transfer uang atau membayar" },
	{ id: "shared-code", label: "Sudah memberi OTP, PIN, atau kode verifikasi" },
	{ id: "installed-app", label: "Sudah install file atau aplikasi dari chat (misalnya APK)" },
	{ id: "clicked-data", label: "Sudah klik tautan dan mengisi data" },
	{ id: "identity-photo", label: "Sudah mengirim foto KTP atau selfie" },
	{ id: "account-taken", label: "Akun WhatsApp atau media sosial diambil alih" },
	{ id: "fake-job-payment", label: "Sudah membayar untuk lowongan kerja yang ternyata palsu" },
	{ id: "wrong-qris", label: "Sudah membayar ke QRIS yang ternyata tujuan keliru" },
] as const;

export type IncidentId = (typeof INCIDENTS)[number]["id"];
export type IncidentWhen = "recent" | "today" | "older";
export type Urgency = "now" | "hour" | "today" | "week";
export type SourceId = keyof typeof OFFICIAL_SOURCES;
export type ActionStep = {
	id: string;
	eventIds: IncidentId[];
	urgency: Urgency;
	title: string;
	description: string;
	why: string;
	channelInstruction?: string;
	sourceIds: SourceId[];
};

// PERLU DITINJAU MANUSIA sebelum rilis: verifikasi kembali langkah keselamatan,
// bahasa yang digunakan, kanal resmi, dan tanggal verifikasi di bawah.
export const OFFICIAL_SOURCES = {
	iasc: {
		name: "Indonesia Anti-Scam Centre (IASC) — OJK",
		url: "https://iasc.ojk.go.id/",
		verifiedAt: "2026-11-03",
		note: "Portal resmi pelaporan penipuan transaksi keuangan; OJK juga menyarankan menyimpan bukti dan melapor ke penegak hukum.",
	},
	ojkImpersonationWarning: {
		name: "Waspada situs yang mengatasnamakan IASC — OJK",
		url: "https://ojk.go.id/id/berita-dan-kegiatan/info-terkini/Pages/Waspada-Penipuan-Website-Mengatasnamakan-Indonesia-Anti-Scam-Centre-IASC.aspx",
		verifiedAt: "2026-11-03",
		note: "OJK menyatakan pelaporan IASC hanya melalui iasc.ojk.go.id dan memperingatkan situs tiruan.",
	},
	ojkRecoveryScam: {
		name: "Waspada recovery scam — OJK/Satgas PASTI",
		url: "https://ojk.go.id/id/berita-dan-kegiatan/info-terkini/Pages/Satgas-PASTI-Blokir-796-Entitas-Ilegal-di-Oktober---Desember-2024.aspx",
		verifiedAt: "2026-11-03",
		note: "OJK menjelaskan modus recovery scam yang meminta biaya pemulihan dana.",
	},
	androidSafety: {
		name: "Remove malware or unsafe software — Android Help",
		url: "https://support.google.com/accounts/answer/9924802?hl=en",
		verifiedAt: "2026-11-03",
		note: "Panduan resmi Google untuk memeriksa Play Protect, menghapus aplikasi yang tidak dipercaya, dan mencari bantuan/reset bila tanda malware berlanjut.",
	},
	whatsappRecovery: {
		name: "How to recover a compromised account — WhatsApp Help Center",
		url: "https://faq.whatsapp.com/1131652977717250/",
		verifiedAt: "2026-11-03",
		note: "Panduan pemulihan akun, kode registrasi, verifikasi dua langkah, perangkat tertaut, dan pemberitahuan ke kontak.",
	},
	whatsappDevices: {
		name: "Check and unlink linked devices — WhatsApp Help Center",
		url: "https://faq.whatsapp.com/1428782138011916/",
		verifiedAt: "2026-11-03",
		note: "Panduan resmi meninjau dan mengeluarkan perangkat WhatsApp yang tidak dikenal.",
	},
	googlePassword: {
		name: "Change compromised passwords — Google Account Help",
		url: "https://support.google.com/accounts/answer/9457609?hl=en",
		verifiedAt: "2026-11-03",
		note: "Panduan mengganti kata sandi akun Google yang mungkin terekspos dan meninjau keamanan akun.",
	},
	idebku: {
		name: "iDeb SLIK OJK",
		url: "https://idebku.ojk.go.id/",
		verifiedAt: "2026-11-03",
		note: "Portal resmi permohonan informasi debitur SLIK; tidak menggantikan pemantauan atau pelaporan penyalahgunaan identitas.",
	},
} as const;

const financialEvents: IncidentId[] = ["transferred", "fake-job-payment", "wrong-qris"];
const accountEvents: IncidentId[] = ["shared-code", "clicked-data", "account-taken"];
const allEvents = INCIDENTS.map((incident) => incident.id);

export const ACTION_STEPS: ActionStep[] = [
	{
		id: "stop-payment",
		eventIds: financialEvents,
		urgency: "now",
		title: "Hubungi bank atau penyedia pembayaran",
		description: "Laporkan transaksi lewat aplikasi resmi atau nomor pada kartu bank. Minta mereka memeriksa apakah transaksi dapat ditahan atau ditindaklanjuti; catat nomor laporan. Untuk QRIS, jelaskan apakah nama merchant berbeda atau pembayaran terkirim ke tujuan yang keliru.",
		why: "Penanganan transaksi dilakukan oleh bank atau penyedia pembayaran yang terlibat, dan tindak lanjut cepat dapat membantu upaya penanganan.",
		channelInstruction: "Buka aplikasi bank/PJP yang kamu gunakan atau cari nomor pada kartu fisik. Jangan gunakan nomor atau tautan dari pesan yang mencurigakan.",
		sourceIds: ["iasc"],
	},
	{
		id: "secure-accounts",
		eventIds: accountEvents,
		urgency: "now",
		title: "Amankan akun dari perangkat yang kamu percaya",
		description: "Ganti kata sandi akun yang datanya mungkin terbuka, terutama email dan akun yang memakai kata sandi sama. Keluarkan sesi atau perangkat yang tidak dikenal dan aktifkan verifikasi dua langkah bila tersedia.",
		why: "Akun email sering dipakai untuk memulihkan akun lain, sehingga akses yang tidak dikenal perlu dihentikan.",
		channelInstruction: "Buka pengaturan keamanan dari aplikasi atau situs resmi yang kamu ketik sendiri. Jika akun Google terdampak, ikuti panduan resmi berikut.",
		sourceIds: ["googlePassword"],
	},
	{
		id: "recover-whatsapp",
		eventIds: ["account-taken"],
		urgency: "now",
		title: "Pulihkan akun WhatsApp lewat alur resminya",
		description: "Gunakan proses pendaftaran ulang dan pemulihan di aplikasi WhatsApp. Jangan bagikan kode registrasi atau PIN kepada siapa pun, termasuk orang yang mengaku membantu.",
		why: "WhatsApp menjelaskan bahwa mendaftarkan ulang nomor dapat mengeluarkan perangkat lain yang memakai akun tersebut.",
		channelInstruction: "Buka aplikasi WhatsApp atau halaman bantuan resminya; jangan ikuti tautan pemulihan dari pengirim pesan.",
		sourceIds: ["whatsappRecovery"],
	},
	{
		id: "pause-suspected-app",
		eventIds: ["installed-app"],
		urgency: "now",
		title: "Hentikan dulu aktivitas sensitif di perangkat itu",
		description: "Jika APK sudah dipasang di Android, putuskan koneksi sementara dan jangan buka aplikasi bank atau dompet digital dari perangkat tersebut. Gunakan perangkat lain yang kamu percaya untuk menghubungi bank bila informasi finansial mungkin terpapar.",
		why: "Aplikasi dari luar sumber tepercaya dapat membahayakan data perangkat; menghentikan sementara aktivitas sensitif mengurangi paparan sambil kamu memeriksa perangkat.",
		channelInstruction: "Jangan mencoba membuka file lagi. Panduan resmi Android membantu memeriksa aplikasi yang tidak dikenal dan langkah berikutnya.",
		sourceIds: ["androidSafety"],
	},
	{
		id: "stop-extra-fees",
		eventIds: financialEvents,
		urgency: "now",
		title: "Jangan kirim pembayaran tambahan",
		description: "Hentikan permintaan biaya pencairan, administrasi, pajak, atau biaya pemulihan. Jangan membayar orang yang menjanjikan uang pasti kembali.",
		why: "OJK memperingatkan adanya recovery scam yang menyasar korban dan meminta biaya pemulihan dana.",
		channelInstruction: "Jika ada tawaran pemulihan yang mengaku dari IASC, periksa sendiri alamat iasc.ojk.go.id.",
		sourceIds: ["ojkRecoveryScam", "ojkImpersonationWarning"],
	},
	{
		id: "recover-social-account",
		eventIds: ["account-taken"],
		urgency: "hour",
		title: "Tinjau perangkat dan sesi yang masih masuk",
		description: "Setelah akses kembali, keluarkan perangkat tertaut yang tidak kamu kenali dan nyalakan fitur keamanan tambahan. Untuk platform selain WhatsApp, cari petunjuk pemulihan di aplikasi atau pusat bantuan resmi platform tersebut.",
		why: "Sesi tertaut yang tidak dikenal dapat memberi akses berkelanjutan meskipun kamu sudah masuk kembali.",
		channelInstruction: "Di WhatsApp, gunakan menu Perangkat tertaut dan panduan resminya.",
		sourceIds: ["whatsappDevices", "whatsappRecovery"],
	},
	{
		id: "warn-contacts",
		eventIds: ["account-taken"],
		urgency: "hour",
		title: "Beri tahu orang yang mungkin menerima pesan dari akunmu",
		description: "Hubungi keluarga atau teman lewat telepon, bertemu langsung, atau akun lain yang masih kamu kuasai. Minta mereka mengabaikan permintaan uang atau kode sampai kamu mengabari kembali.",
		why: "Akun yang diambil alih dapat dipakai untuk menyamar dan menghubungi orang-orang di daftar kontak.",
		channelInstruction: "Untuk akun WhatsApp yang diambil alih, WhatsApp menyarankan memberi tahu keluarga dan teman.",
		sourceIds: ["whatsappRecovery"],
	},
	{
		id: "scan-and-remove-app",
		eventIds: ["installed-app"],
		urgency: "hour",
		title: "Periksa dan hapus aplikasi yang tidak kamu percaya",
		description: "Di Android, jalankan pemeriksaan Play Protect dan tinjau aplikasi serta izin khusus yang baru diberikan. Bila gejala tetap ada atau kamu ragu, minta bantuan produsen perangkat; reset perangkat mungkin diperlukan.",
		why: "Panduan Android menyarankan pemeriksaan aplikasi tak dikenal dan menyebut reset atau bantuan produsen bila tanda bahaya berlanjut.",
		channelInstruction: "Gunakan menu Play Protect dan pengaturan aplikasi Android, atau buka panduan resmi.",
		sourceIds: ["androidSafety"],
	},
	{
		id: "report-financial-scam",
		eventIds: financialEvents,
		urgency: "hour",
		title: "Laporkan transaksi ke IASC",
		description: "Siapkan bukti transaksi, percakapan, sumber tawaran, dan waktu kejadian, lalu buat laporan di portal resmi. Simpan nomor laporan untuk memantau tindak lanjut. Kecepatan melapor dapat membantu upaya penanganan, tetapi tidak menjamin uang kembali.",
		why: "IASC mengoordinasikan tindak lanjut penipuan transaksi keuangan dengan bank/PJP terkait.",
		channelInstruction: "Pastikan alamatnya tepat iasc.ojk.go.id. Laporan IASC tidak menggantikan laporan polisi bila kamu juga ingin menempuh jalur hukum.",
		sourceIds: ["iasc", "ojkImpersonationWarning"],
	},
	{
		id: "alert-identity-leak",
		eventIds: ["identity-photo"],
		urgency: "hour",
		title: "Waspadai permintaan kode atau verifikasi lanjutan",
		description: "Data KTP atau selfie sering disalahgunakan untuk mencoba membuka akun atau pinjaman yang memerlukan kode verifikasi ke nomor ponselmu. Tolak dan jangan berikan kode OTP atau verifikasi apa pun yang masuk tanpa kamu minta.",
		why: "Pelaku yang memegang foto identitas umumnya masih membutuhkan kode otentikasi (OTP) untuk menyelesaikan pendaftaran layanan.",
		channelInstruction: "Jika menerima SMS OTP yang tidak kamu minta, abaikan dan jangan berikan kepada siapa pun yang menghubungi.",
		sourceIds: ["iasc"],
	},
	{
		id: "preserve-evidence",
		eventIds: allEvents,
		urgency: "today",
		title: "Simpan bukti sebelum percakapan atau akun berubah",
		description: "Simpan tangkapan layar percakapan dan profil, bukti transfer atau pembayaran, nomor rekening/akun tujuan, waktu kejadian, tautan atau nama file, dan nomor laporan. Simpan salinan di perangkat atau media yang kamu kendalikan.",
		why: "Bukti membantu bank, platform, atau pihak yang menerima laporan memahami urutan kejadian.",
		channelInstruction: "Jangan unggah bukti ke Jaga; portal laporan resmi dapat meminta bukti saat kamu mengajukan laporan.",
		sourceIds: ["iasc"],
	},
	{
		id: "identity-monitoring",
		eventIds: ["identity-photo"],
		urgency: "today",
		title: "Waspadai penggunaan identitas tanpa izin",
		description: "Perhatikan pemberitahuan akun, pinjaman, atau layanan keuangan yang tidak kamu ajukan. Jika ingin memeriksa informasi debitur SLIK atas namamu, gunakan iDebku OJK; data SLIK tidak mencakup semua kemungkinan penyalahgunaan identitas.",
		why: "Pemeriksaan berkala dapat membantu kamu menyadari informasi yang perlu ditanyakan lebih lanjut kepada penyedia terkait.",
		channelInstruction: "Permohonan iDeb dapat memerlukan data identitas; pastikan alamat resmi idebku.ojk.go.id dan baca persyaratannya sebelum mengirim data.",
		sourceIds: ["idebku"],
	},
	{
		id: "report-platform",
		eventIds: ["fake-job-payment", "account-taken", "clicked-data", "installed-app"],
		urgency: "today",
		title: "Laporkan akun, iklan, atau lowongan ke platform asal",
		description: "Gunakan fitur lapor di marketplace, media sosial, atau platform tempat tawaran muncul. Jika ada transaksi keuangan, laporan ke platform berjalan terpisah dari laporan ke bank/PJP dan IASC.",
		why: "Platform asal dapat meninjau konten atau akun yang dilaporkan sesuai proses mereka.",
		channelInstruction: "Cari tombol bantuan/laporkan di aplikasi atau situs resmi platform tersebut; tidak ada satu tautan universal untuk semua platform.",
		sourceIds: [],
	},
	{
		id: "police-report",
		eventIds: financialEvents,
		urgency: "today",
		title: "Pertimbangkan membuat laporan polisi",
		description: "Jika kamu ingin menempuh jalur hukum, siapkan kronologi dan bukti lalu datangi kantor kepolisian. IASC menyebut laporan polisi dan laporan finansial ke IASC memiliki tujuan berbeda.",
		why: "Laporan finansial IASC tidak menggantikan jalur proses hukum.",
		channelInstruction: "Cari kantor kepolisian melalui kanal pemerintah resmi atau datang ke kantor terdekat; Jaga tidak mencantumkan nomor darurat atau kontak yang belum diverifikasi untuk kasus ini.",
		sourceIds: ["iasc"],
	},
];

const urgencyOrder: Record<Urgency, number> = { now: 0, hour: 1, today: 2, week: 3 };

export function buildActionPlan(incidentIds: IncidentId[]): ActionStep[] {
	const selected = new Set(incidentIds);
	return ACTION_STEPS
		.filter((step) => step.eventIds.some((id) => selected.has(id)))
		.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency] || ACTION_STEPS.indexOf(a) - ACTION_STEPS.indexOf(b));
}


export function validateIncidentIds(value: unknown): IncidentId[] {
	if (!Array.isArray(value)) return [];
	const allowed = new Set<IncidentId>(INCIDENTS.map((item) => item.id));
	return [...new Set(value.filter((id): id is IncidentId => typeof id === "string" && allowed.has(id as IncidentId)))];
}


export function buildIncidentSummary(incidentIds: IncidentId[], when: IncidentWhen, completedStepIds: string[]) {
	const selected = INCIDENTS.filter((incident) => incidentIds.includes(incident.id)).map((incident) => `- ${incident.label}`);
	const timeLabel = { recent: "Baru saja (dalam 1 jam)", today: "Hari ini", older: "Lebih dari sehari lalu" }[when];
	const completed = buildActionPlan(incidentIds).filter((step) => completedStepIds.includes(step.id)).map((step) => `- ${step.title}`);
	return [
		"Ringkasan kejadian (draf untuk disalin ke kanal laporan resmi)",
		"Apa yang terjadi:", ...selected,
		`Kapan: ${timeLabel}`,
		"Detail untuk saya isi sendiri: [isi sendiri]",
		"Nama / nomor rekening atau akun terkait: [isi sendiri]",
		"Kronologi, tanggal, dan waktu: [isi sendiri]",
		"Langkah yang sudah dilakukan:", ...(completed.length ? completed : ["- [isi sendiri]"]),
		"Bukti yang tersedia: [isi sendiri]",
	].join("\n");
}


export function buildGuardianWarning(incidentIds: IncidentId[]) {
	if (incidentIds.includes("account-taken")) {
		return "Akun saya sedang bermasalah. Kalau ada pesan dari akun saya yang meminta uang, kode, atau data, jangan dituruti dulu. Hubungi saya lewat jalur lain sampai saya mengonfirmasi akun sudah kembali.";
	}
	return "Saya sedang menangani pesan atau transaksi mencurigakan. Kalau kamu menerima tawaran serupa, jangan kirim uang atau kode dulu. Verifikasi lewat kanal resmi yang kamu cari sendiri.";
}


export function urgencyLabel(urgency: Urgency) {
	return ({ now: "Sekarang", hour: "Dalam 1 jam", today: "Hari ini", week: "Minggu ini" })[urgency];
}

