import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const metadataBase = siteUrl ? new URL(siteUrl) : undefined;

const siteDescription =
	"Pelajari cara mengenali penipuan digital melalui simulasi WhatsApp, pemeriksaan lowongan kerja, dan pembacaan informasi QRIS. Kenali tanda mencurigakan sebelum mengambil keputusan.";

const plusJakartaSans = Plus_Jakarta_Sans({
	variable: "--font-plus-jakarta-sans",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	metadataBase,
	title: "Kenali Penipuan Digital & Belajar Lebih Aman | Jaga",
	description: siteDescription,
	applicationName: "Jaga",
	category: "education",
	alternates: siteUrl ? { canonical: "/" } : undefined,
	openGraph: {
		title: "Kenali Penipuan Digital & Belajar Lebih Aman | Jaga",
		description: siteDescription,
		locale: "id_ID",
		type: "website",
		...(siteUrl ? { url: siteUrl } : {}),
		...(metadataBase ? { images: [{ url: "/card2.webp", alt: "Belajar mengenali tanda lowongan kerja mencurigakan bersama Jaga" }] } : {}),
	},
	twitter: {
		card: "summary_large_image",
		title: "Kenali Penipuan Digital & Belajar Lebih Aman | Jaga",
		description: siteDescription,
		...(metadataBase ? { images: ["/card2.webp"] } : {}),
	},
	robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
	return (
		<html lang="id" className={`${plusJakartaSans.variable} h-full antialiased`}>
			<body className="min-h-full flex flex-col font-sans">{children}</body>
		</html>
	);
}
