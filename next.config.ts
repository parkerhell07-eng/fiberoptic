import type { NextConfig } from "next";

// حالت عادی: standalone (سرور). حالت بسته‌بندی اندروید: CAP_EXPORT=1 → خروجی استاتیک برای Capacitor
const isCapacitorExport = process.env.CAP_EXPORT === "1";

const nextConfig: NextConfig = {
  output: isCapacitorExport ? "export" : "standalone",
  images: isCapacitorExport ? { unoptimized: true } : undefined,
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
