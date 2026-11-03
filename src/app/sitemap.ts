import type { MetadataRoute } from "next";

const publicPaths = ["", "/simulasi", "/cek-lowongan", "/cek-qris", "/batasan"];

export default function sitemap(): MetadataRoute.Sitemap {
	const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");

	// Sitemap URLs must be absolute; don't publish localhost or guess the production domain.
	if (!siteUrl) return [];

	return publicPaths.map((path) => ({
		url: `${siteUrl}${path}`,
		changeFrequency: "monthly",
		priority: path === "" ? 1 : 0.7,
	}));
}
