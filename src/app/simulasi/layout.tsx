import { Roboto } from "next/font/google";

const roboto = Roboto({
	subsets: ["latin"],
	weight: ["400", "500", "700"],
	display: "swap",
});

export default function SimulasiLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div
			className={`${roboto.className} h-dvh w-full overflow-hidden bg-[#161717] text-[#e9edef]`}>
			{children}
		</div>
	);
}
