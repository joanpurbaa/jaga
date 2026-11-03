import Link from "next/link";
import {
	FiAlertTriangle,
	FiArrowLeft,
	FiArrowRight,
	FiCheckCircle,
	FiInfo,
	FiLock,
	FiRefreshCw,
	FiShield,
} from "react-icons/fi";

const limitations = [
	{
		icon: FiAlertTriangle,
		title: "AI bisa melakukan kesalahan",
		text: "Analisis dapat kurang tepat, melewatkan indikasi, atau salah memahami konteks. Tinjau bukti yang ditampilkan dan jangan menganggap skor sebagai kepastian.",
	},
	{
		icon: FiRefreshCw,
		title: "Informasi bisa berubah",
		text: "Data merchant, kontak, identitas, dan informasi lowongan dapat berubah atau tidak tersedia saat pemeriksaan dilakukan.",
	},
	{
		icon: FiShield,
		title: "Bukan verifikasi resmi",
		text: "Hasilnya bukan bukti hukum dan tidak menggantikan konfirmasi kepada bank, penyedia pembayaran, perusahaan, atau instansi terkait melalui kanal resmi.",
	},
];

const safetySteps = [
	"Jangan mengirim uang hanya berdasarkan informasi yang belum terverifikasi.",
	"Jangan membagikan OTP, PIN, kata sandi, atau data pribadi kepada kontak yang belum dipastikan.",
	"Hubungi perusahaan atau penyedia layanan melalui kanal resmi yang kamu buka sendiri.",
	"Laporkan aktivitas mencurigakan kepada penyedia layanan atau pihak berwenang yang sesuai.",
];

function SectionTitle({ id, icon: Icon, eyebrow, title }: { id: string; icon: typeof FiInfo; eyebrow?: string; title: string }) {
	return <div className="flex items-start gap-3"><span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><Icon size={19} aria-hidden="true" /></span><div>{eyebrow && <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{eyebrow}</p>}<h2 id={id} className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h2></div></div>;
}

export default function BatasanPage() {
	return <main className="min-h-screen bg-gray-100 px-5 py-8 sm:px-8 sm:py-12 lg:px-12">
		<div className="mx-auto max-w-4xl">
			<header>
				<Link href="/" className="group inline-flex items-center gap-2 rounded-full py-1 pr-3 text-sm font-semibold text-slate-600 transition-colors hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-900">
					<FiArrowLeft size={16} className="transition-transform group-hover:-translate-x-1 motion-reduce:transition-none" aria-hidden="true" />
					Kembali ke beranda
				</Link>
				<div className="mt-8 max-w-3xl">
					<p className="text-sm font-semibold text-amber-700">Jaga · informasi penggunaan</p>
					<h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Batasan &amp; Privasi</h1>
					<p className="mt-3 text-base leading-relaxed text-slate-600 sm:text-lg">Kenali cara kerja, keterbatasan, dan bagaimana data kamu digunakan saat menggunakan platform ini.</p>
				</div>
			</header>

			<section aria-labelledby="important-title" className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
				<div className="flex items-start gap-3">
					<span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800"><FiInfo size={20} aria-hidden="true" /></span>
					<div><h2 id="important-title" className="text-lg font-bold text-slate-900">Alat bantu, bukan penentu kebenaran.</h2><p className="mt-2 text-sm leading-6 text-slate-700">Platform ini membantu kamu mengenali indikasi penipuan digital berdasarkan informasi yang tersedia. Hasil analisis bukan jaminan bahwa suatu aktivitas aman ataupun merupakan penipuan.</p></div>
				</div>
			</section>

			<section aria-labelledby="limits-title" className="mt-10">
				<SectionTitle id="limits-title" icon={FiShield} eyebrow="Sebelum menggunakan hasil" title="Batasan analisis" />
				<div className="mt-5 grid gap-0 border-y border-slate-200 sm:grid-cols-3 sm:divide-x sm:divide-slate-200">
					{limitations.map(({ icon: Icon, title, text }) => <article key={title} className="flex gap-3 py-5 sm:px-4 sm:first:pl-0 sm:last:pr-0">
						<Icon className="mt-0.5 shrink-0 text-slate-500" size={18} aria-hidden="true" />
						<div><h3 className="text-sm font-bold text-slate-900">{title}</h3><p className="mt-1.5 text-sm leading-5 text-slate-600">{text}</p></div>
					</article>)}
				</div>
			</section>

			<section aria-labelledby="privacy-title" className="mt-10">
				<SectionTitle id="privacy-title" icon={FiLock} eyebrow="Pemrosesan dan penyimpanan" title="Bagaimana data kamu digunakan?" />
				<div className="mt-5 divide-y divide-slate-200 border-y border-slate-200">
					<article className="grid gap-2 py-5 sm:grid-cols-[150px_1fr] sm:gap-6">
						<h3 className="text-sm font-bold text-slate-900">Cek lowongan</h3>
						<div className="space-y-2 text-sm leading-5 text-slate-600"><p>Caption, jawaban, dan poster dikirim ke server aplikasi, lalu dianalisis oleh model Ollama lokal pada server tersebut. Implementasi saat ini membatasi koneksi Ollama ke alamat loopback dan tidak mengirim input ke provider AI pihak ketiga.</p><p>Fitur ini tidak menyimpan isi lowongan ke database. Log diagnostik mencatat metadata teknis seperti ukuran gambar dan durasi proses, bukan caption atau gambar. Hasil berada di memori halaman selama sesi berlangsung.</p></div>
					</article>
					<article className="grid gap-2 py-5 sm:grid-cols-[150px_1fr] sm:gap-6">
						<h3 className="text-sm font-bold text-slate-900">Cek QRIS</h3>
						<div className="space-y-2 text-sm leading-5 text-slate-600"><p>Halaman membaca QR dari gambar di browser, lalu mengurai payload dan memeriksa struktur serta CRC di perangkat. Alur halaman ini tidak mengunggah gambar atau payload untuk analisis.</p><p>Payload dan hasil pemeriksaan disimpan sementara di state halaman agar dapat ditampilkan, bukan di penyimpanan persisten aplikasi.</p></div>
					</article>
					<article className="grid gap-2 py-5 sm:grid-cols-[150px_1fr] sm:gap-6">
						<h3 className="text-sm font-bold text-slate-900">Cek pesan</h3>
						<div className="space-y-2 text-sm leading-5 text-slate-600"><p>Teks yang ditempel diperiksa sepenuhnya di browser dengan aturan dan pola lokal. Fitur ini tidak memanggil AI atau API untuk analisis; teks tidak dikirim ke server, dicatat oleh aplikasi, atau disimpan di localStorage.</p><p>Pencocokan kata dan pola bisa melewatkan tanda tertentu atau menandai kalimat yang wajar. Hasilnya tidak menyatakan pesan aman dan bukan kepastian bahwa pesan merupakan penipuan.</p></div>
					</article>
					<article className="grid gap-2 py-5 sm:grid-cols-[150px_1fr] sm:gap-6">
						<h3 className="text-sm font-bold text-slate-900">Simulasi</h3>
						<div className="space-y-2 text-sm leading-5 text-slate-600"><p>Simulasi berjalan dengan skenario dan aturan deterministik untuk tujuan edukasi; tidak ada model AI yang dipanggil saat percakapan berlangsung.</p><p>Browser menyimpan maksimal 10 sesi simulasi di <code className="rounded bg-slate-200/70 px-1 py-0.5 text-xs">localStorage</code>, termasuk waktu, pilihan, skor, dan indikator yang ditemui. Teks bebas yang kamu ketik tidak disimpan; hanya kategori intent-nya. Data ini tetap ada di browser sampai data situs dihapus.</p></div>
					</article>
					<article className="grid gap-2 py-5 sm:grid-cols-[150px_1fr] sm:gap-6">
						<h3 className="text-sm font-bold text-slate-900">Sudah terlanjur?</h3>
						<div className="space-y-2 text-sm leading-5 text-slate-600"><p>Fitur ini tidak meminta data pribadi seperti nomor rekening, nomor HP, nama, KTP, OTP, atau PIN. Pengguna hanya memilih kategori kejadian yang dialami.</p><p>Kemajuan langkah dan pilihan kejadian disimpan di <code className="rounded bg-slate-200/70 px-1 py-0.5 text-xs">localStorage</code> browser pengguna. Tidak ada data yang dikirim ke server aplikasi atau pihak ketiga. Tombol “Hapus data saya” menghapus seluruh data tersimpan kapan saja.</p><p>Panduan ini bukan nasihat hukum atau keuangan profesional dan tidak menjamin pemulihan dana atau hasil tertentu. Kanal resmi yang dicantumkan dapat berubah sewaktu-waktu; pengguna dianjurkan selalu memverifikasi langsung melalui situs resmi lembaga terkait.</p></div>
					</article>
				</div>
				<p className="mt-3 text-xs leading-5 text-slate-500">Penyimpanan dan log pada infrastruktur hosting dapat mengikuti konfigurasi lingkungan tempat aplikasi dijalankan.</p>
			</section>

			<section aria-labelledby="actions-title" className="mt-10 rounded-2xl bg-emerald-50 p-5 ring-1 ring-emerald-100 sm:p-6">
				<SectionTitle id="actions-title" icon={FiCheckCircle} eyebrow="Tetap aman saat memeriksa" title="Apa yang sebaiknya kamu lakukan?" />
				<ul className="mt-4 grid gap-3 sm:grid-cols-2">{safetySteps.map((step) => <li key={step} className="flex items-start gap-2.5 text-sm leading-5 text-slate-700"><FiCheckCircle className="mt-0.5 shrink-0 text-emerald-700" size={17} aria-hidden="true" /><span>{step}</span></li>)}</ul>
			</section>

			<footer className="mt-10 flex flex-col gap-5 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
				<p className="max-w-xl text-sm leading-6 text-slate-600">Gunakan informasi dengan bijak. Tetap kritis dan selalu lakukan verifikasi mandiri.</p>
				<Link href="/" className="group inline-flex w-fit items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-900">Kembali ke beranda<FiArrowRight size={17} className="transition-transform group-hover:translate-x-1 motion-reduce:transition-none" aria-hidden="true" /></Link>
			</footer>
		</div>
	</main>;
}
