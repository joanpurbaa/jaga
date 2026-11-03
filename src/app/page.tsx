import Image from "next/image";
import Link from "next/link";
import { FiArrowRight, FiCheck, FiEye, FiBookOpen, FiShield } from "react-icons/fi";

type Feature = {
	id: string;
	href: string;
	image: string;
	step: string;
	eyebrow: string;
	title: string;
	description: string;
	duration: string;
	note: string;
	cta: string;
};

const features: Feature[] = [
	{
		id: "simulasi",
		href: "/simulasi",
		image: "/card1.webp",
		step: "01",
		eyebrow: "Learn · Latihan",
		title: "Simulasi penipuan",
		description:
			"Latih instingmu lewat simulasi percakapan WhatsApp. Kenali cara pelaku membangun kepercayaan, menciptakan urgensi, dan memengaruhi keputusan.",
		duration: "± 3 menit",
		note: "Skenario edukasi",
		cta: "Mulai simulasi",
	},
	{
		id: "lowongan",
		href: "/cek-lowongan",
		image: "/card2.webp",
		step: "02",
		eyebrow: "Recognize · Periksa",
		title: "Cek lowongan kerja",
		description:
			"Tinjau poster dan informasi lowongan yang mencurigakan. Lihat kejanggalan pada identitas, proses rekrutmen, serta informasi yang tercantum.",
		duration: "± 1 menit",
		note: "Analisis AI lokal di server",
		cta: "Periksa lowongan",
	},
	{
		id: "qris",
		href: "/cek-qris",
		image: "/card3.webp",
		step: "03",
		eyebrow: "Recognize · Periksa",
		title: "Cek informasi QRIS",
		description:
			"Baca nama merchant, kota, dan jenis QRIS. Cocokkan informasi yang terbaca dengan merchant sebelum melanjutkan pembayaran.",
		duration: "± 30 detik",
		note: "Dibaca di perangkatmu",
		cta: "Baca QRIS",
	},
	{
		id: "cek-pesan",
		href: "/cek-pesan",
		image: "/card4.webp",
		step: "04",
		eyebrow: "Kenali",
		title: "Cek pesan",
		description: "Tempel chat, tawaran jual-beli, atau ajakan investasi. Lihat kalimat yang janggal, lengkap dengan alasannya.",
		duration: "± 30 detik",
		note: "Dibaca di perangkatmu",
		cta: "Cek pesan",
	},
	{
		id: "terlanjur",
		href: "/terlanjur",
		image: "/card5.webp",
		step: "05",
		eyebrow: "Bertindak",
		title: "Sudah terlanjur?",
		description: "Pilih apa yang sudah terjadi. Dapatkan langkah berurutan, dari yang harus dilakukan sekarang sampai yang bisa menyusul.",
		duration: "± 2 menit",
		note: "Tanpa data pribadi",
		cta: "Lihat langkahnya",
	},
];

const threats = [
	{ title: "Pesan WhatsApp mendesak", text: "Permintaan transfer, kode OTP, atau bantuan dari akun yang mengaku orang dekat." },
	{ title: "Lowongan kerja palsu", text: "Proses rekrutmen yang meminta biaya, data sensitif, atau tindakan sebelum jelas kebenarannya." },
	{ title: "QRIS dan transaksi", text: "Nama merchant atau nominal yang perlu dicocokkan sebelum kamu menyelesaikan pembayaran." },
	{ title: "Phishing dan impersonasi", text: "Tautan dan akun yang meniru pihak resmi untuk mendorongmu membagikan informasi." },
];

const safetyTips = [
	"Jangan terburu-buru mengikuti instruksi yang membuatmu panik.",
	"Verifikasi identitas lewat kanal resmi yang kamu cari sendiri.",
	"Jangan bagikan OTP, PIN, kata sandi, atau data sensitif.",
	"Hentikan interaksi dan minta konfirmasi jika ada yang janggal.",
];

const websiteStructuredData = {
	"@context": "https://schema.org",
	"@type": "WebSite",
	name: "Jaga",
	description:
		"Platform edukasi untuk membantu generasi muda mengenali penipuan digital melalui simulasi, pemeriksaan lowongan kerja, dan pembacaan informasi QRIS.",
	inLanguage: "id-ID",
	...(process.env.NEXT_PUBLIC_SITE_URL
		? { url: process.env.NEXT_PUBLIC_SITE_URL }
		: {}),
};

export default function HomePage() {
	return (
		<main className="min-h-screen w-full bg-linear-to-b from-amber-50 via-gray-100 to-gray-100 px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
			<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteStructuredData).replace(/</g, "\\u003c") }} />
			<div className="mx-auto flex w-full max-w-6xl flex-col gap-16 sm:gap-20">
				<header className="max-w-3xl animate-fade-up motion-reduce:animate-none">
					<p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 shadow-sm ring-1 ring-black/5">
						<span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
						Edukasi penipuan digital · Gratis dicoba
					</p>
					<h1 className="mt-5 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
						Jangan mudah percaya. <span className="text-amber-600">Kenali sebelum terjebak.</span>
					</h1>
					<p className="mt-5 max-w-2xl text-base leading-relaxed text-gray-600 sm:text-lg">
						Pelajari cara mengenali penipuan digital, periksa hal-hal yang mencurigakan, dan ketahui langkah yang bisa kamu ambil untuk melindungi diri sendiri maupun orang lain.
					</p>
					<div className="mt-7 flex flex-wrap gap-3">
						<Link href="/simulasi" className="inline-flex items-center gap-3 rounded-full bg-gray-900 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-gray-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gray-900">
							Latih instingmu <FiArrowRight aria-hidden="true" />
						</Link>
						<Link href="#fitur" className="inline-flex items-center rounded-full bg-white px-5 py-3 text-sm font-bold text-gray-800 ring-1 ring-black/10 transition-colors hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-600">
							Lihat semua fitur
						</Link>
					</div>
				</header>

				<section aria-labelledby="ancaman-title" className="grid gap-6 border-y border-gray-200 py-8 sm:grid-cols-[0.8fr_1.2fr] sm:items-start sm:py-10">
					<div>
						<p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">The Trust Trap</p>
						<h2 id="ancaman-title" className="mt-2 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Modus bisa datang dalam bentuk yang terasa akrab.</h2>
						<p className="mt-3 max-w-md text-sm leading-6 text-gray-600">Penipuan online sering memanfaatkan kepercayaan, rasa takut, atau kesempatan yang terasa terlalu mendesak. Kenali polanya sebelum memutuskan.</p>
					</div>
					<ul className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
						{threats.map((threat) => <li key={threat.title} className="flex gap-3">
							<span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800"><FiEye size={15} aria-hidden="true" /></span>
							<div><h3 className="text-sm font-bold text-gray-900">{threat.title}</h3><p className="mt-1 text-sm leading-5 text-gray-600">{threat.text}</p></div>
						</li>)}
					</ul>
				</section>

				<section id="fitur" aria-labelledby="fitur-title" className="scroll-mt-8">
					<div className="mb-6 flex flex-col gap-2 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
						<div><p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">Belajar dengan praktik</p><h2 id="fitur-title" className="mt-2 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Mulai dari situasi yang kamu temui.</h2></div>
						<p className="max-w-md text-sm leading-6 text-gray-600">Kenali tanda, latih respons, dan gunakan informasi sebagai bahan untuk memeriksa lebih lanjut.</p>
					</div>
					<div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-6 lg:gap-6">
						{features.map((feature, index) => {
							const wide = feature.id === "cek-pesan" || feature.id === "terlanjur";
							const wideAlone = wide && features.filter(f => f.id === "cek-pesan" || f.id === "terlanjur").length === 1;
							const layout = wide ? (wideAlone ? "md:col-span-2 lg:col-span-6" : "lg:col-span-3") : "lg:col-span-2";
							return <article key={feature.id} className={`animate-fade-up motion-reduce:animate-none ${layout}`} style={{ animationDelay: `${100 + index * 100}ms` }}>
							<Link href={feature.href} className={`group relative isolate flex flex-col justify-between overflow-hidden rounded-3xl bg-gray-900 p-5 shadow-lg shadow-black/10 ring-1 ring-black/5 transition-[transform,box-shadow] duration-500 ease-out hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-black/25 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-400 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${wide ? "min-h-[22rem]" : "min-h-[25rem] sm:min-h-[27rem]"}`}>
								<Image src={feature.image} alt="" fill sizes={wide ? "(min-width: 1024px) 50vw, 100vw" : "(min-width: 1024px) 33vw, 100vw"} className={`-z-20 object-cover transition-transform duration-700 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100 ${wide ? "object-right" : "object-center"}`} />
								<div aria-hidden="true" className={`absolute inset-0 -z-10 ${wide ? "bg-linear-to-r from-black/95 via-black/70 to-black/10" : "bg-linear-to-t from-black/95 via-black/50 to-black/10"}`} />
								<div className="flex w-full items-center justify-between"><span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-gray-900">{feature.step}</span><span className="rounded-full bg-black/40 px-3 py-1 text-xs font-medium text-white ring-1 ring-white/20 backdrop-blur">{feature.duration}</span></div>
								<div className={`flex flex-col gap-3 ${wide ? "w-full max-w-[70%]" : ""}`}>
									<p className="text-xs font-semibold uppercase tracking-widest text-amber-300">{feature.eyebrow}</p>
									<h3 className="text-2xl font-bold text-white">{feature.title}</h3>
									<p className="text-sm leading-relaxed text-white/85">{feature.description}</p>
									<p className="text-xs text-white/70">{feature.note}</p>
									<span className="mt-1 inline-flex w-full items-center justify-between rounded-full bg-white px-5 py-3 text-sm font-bold text-gray-900 transition-colors group-hover:bg-amber-400">{feature.cta}<FiArrowRight className="size-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" aria-hidden="true" /></span>
								</div>
							</Link>
						</article>;
						})}
					</div>
				</section>

				<section aria-labelledby="alur-title" className="rounded-3xl bg-white/75 p-6 ring-1 ring-black/5 sm:p-8">
					<div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">Dari sadar ke bertindak</p><h2 id="alur-title" className="mt-2 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Kenali. Pelajari. Ambil jeda.</h2></div>
					<div className="mt-7 grid gap-6 sm:grid-cols-3 sm:gap-8">
						{[
							{ icon: FiEye, name: "Recognize", text: "Perhatikan tanda yang janggal sebelum mengambil keputusan." },
							{ icon: FiBookOpen, name: "Learn", text: "Latih respons lewat skenario dan penjelasan yang mudah dipahami." },
							{ icon: FiShield, name: "Act", text: "Verifikasi melalui kanal resmi dan pilih langkah yang lebih aman." },
						].map(({ icon: Icon, name, text }) => <article key={name} className="flex gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-800"><Icon size={19} aria-hidden="true" /></span><div><h3 className="font-bold text-gray-900">{name}</h3><p className="mt-1 text-sm leading-5 text-gray-600">{text}</p></div></article>)}
					</div>
				</section>

				<section aria-labelledby="safety-title" className="grid gap-6 sm:grid-cols-[0.8fr_1.2fr] sm:items-start">
					<div><p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">Kebiasaan keamanan digital</p><h2 id="safety-title" className="mt-2 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Jeda sebentar. Periksa dulu.</h2><p className="mt-3 text-sm leading-6 text-gray-600">Langkah sederhana membantu menjaga keamanan digital saat menerima pesan, tawaran, atau permintaan pembayaran.</p></div>
					<ul className="grid gap-3 sm:grid-cols-2">{safetyTips.map((tip) => <li key={tip} className="flex gap-3 rounded-2xl bg-white/70 p-4 text-sm leading-5 text-gray-700 ring-1 ring-black/5"><FiCheck className="mt-0.5 shrink-0 text-emerald-700" aria-hidden="true" />{tip}</li>)}</ul>
				</section>

				<footer className="border-t border-gray-200 pt-6 pb-2">
					<p className="max-w-3xl text-xs leading-relaxed text-gray-500 sm:text-sm">Aplikasi ini membantu kamu berpikir lebih jernih, bukan memastikan sesuatu aman atau penipuan. Hasilnya bisa keliru, jadi selalu verifikasi lewat kanal resmi.{" "}<Link href="/batasan" className="font-semibold text-gray-700 underline underline-offset-4 transition-colors hover:text-gray-900">Batasan dan privasi</Link></p>
					<p className="mt-4 text-xs text-gray-400">Jaga · Guardians of the Digital Space</p>
				</footer>
			</div>
		</main>
	);
}
