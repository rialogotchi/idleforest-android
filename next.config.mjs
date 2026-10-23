/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",          // statik çıktı -> out/  (Capacitor webDir)
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
