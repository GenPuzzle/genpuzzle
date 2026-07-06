import type { NextConfig } from "next";
import path from "path";

/** Keep Turbopack/build rooted in genpuzzle/ (parent folder also has a package-lock.json). */
const projectRoot = path.resolve(__dirname);

const nextConfig: NextConfig = {
  outputFileTracingRoot: projectRoot,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {
    root: projectRoot,
    resolveAlias: {
      fs: { browser: "./src/lib/empty.ts" },
      path: { browser: "./src/lib/empty.ts" },
      os: { browser: "./src/lib/empty.ts" },
      crypto: { browser: "./src/lib/empty.ts" },
      stream: { browser: "./src/lib/empty.ts" },
      buffer: { browser: "./src/lib/empty.ts" },
      util: { browser: "./src/lib/empty.ts" },
      process: { browser: "./src/lib/empty.ts" },
      timers: { browser: "./src/lib/empty.ts" },
      tls: { browser: "./src/lib/empty.ts" },
      net: { browser: "./src/lib/empty.ts" },
      child_process: { browser: "./src/lib/empty.ts" },
      https: { browser: "./src/lib/empty.ts" },
      http: { browser: "./src/lib/empty.ts" },
      "image-size": { browser: "./src/lib/empty.ts" },
      express: { browser: "./src/lib/empty.ts" },
    },
  },
  webpack: (config, { webpack, isServer }) => {
    if (!isServer) {
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource: any) => {
          resource.request = resource.request.replace(/^node:/, '');
        })
      );
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
        stream: false,
        buffer: false,
        util: false,
        process: false,
        timers: false,
        tls: false,
        net: false,
        child_process: false,
        https: false,
        http: false,
        "image-size": false,
        express: false,
      };
    }
    return config;
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
          },
          {
            key: "Access-Control-Max-Age",
            value: "86400",
          },
          {
            key: "X-Frame-Options",
            value: "ALLOWALL",
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' *",
          },
        ],
      },
    ];
  },
  allowedDevOrigins: [
    "http://127.0.0.1:3000",
    "http://localhost:3000",
    "http://app.localhost:3000",
    "http://192.168.11.102:3000",
  ],
  images: {
    remotePatterns: [
      {
        hostname: "images.pexels.com",
      },
      {
        hostname: "images.unsplash.com",
      },
      {
        hostname: "chat2db-cdn.oss-us-west-1.aliyuncs.com",
      },
      {
        hostname: "cdn.chat2db-ai.com",
      }
    ],
    localPatterns: [
      {
        pathname: '/**',
        search: '',
      },
    ],
  },
};

export default nextConfig;
