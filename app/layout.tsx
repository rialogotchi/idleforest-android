import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Rethink_Sans } from "next/font/google";
import "./globals.css";

const candu = localFont({
	src: "./fonts/CanduRounded.otf",
	variable: "--font-candu",
	weight: "400",
});

const rethinkSans = Rethink_Sans({
	subsets: ["latin"],
	variable: "--font-rethink-sans",
	display: "swap",
	adjustFontFallback: false,
	weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
	title: "Idle Forest",
	description: "Idle Forest — grow a virtual forest.",
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	maximumScale: 1,
	userScalable: false,
};

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="en">
			<body
				className={`${candu.variable} ${rethinkSans.variable} font-rethink-sans antialiased`}
			>
				{children}
			</body>
		</html>
	);
}
