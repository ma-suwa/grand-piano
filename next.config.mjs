import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 静的なHTML/JSとして out/ に書き出す(Capacitor などでiPhoneアプリに包むため)
  output: 'export',
  // 親フォルダのlockfileをワークスペースルートと誤認しないようにする
  turbopack: {
    root: dirname(fileURLToPath(import.meta.url)),
  },
  devIndicators: false,
  // 同じWi-Fi内のiPadから確認できるようにする
  allowedDevOrigins: ['192.168.*.*', '10.*.*.*', '*.local'],
};

export default nextConfig;
