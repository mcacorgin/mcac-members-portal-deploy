import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ExcelJS is a Node-only admin export dependency. Keep it external so Next
  // does not compile the ZIP reader's optional S3 adapter.
  serverExternalPackages: ["exceljs"],
  // The floating dev-tools badge overlaps the 390px bottom tab bar and
  // intercepts taps during mobile review; dev-overlay errors still surface.
  devIndicators: false,
};

export default nextConfig;
