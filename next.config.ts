import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // The API base is read at build time for the browser bundle, so it must
  // be present in the hosting platform's build environment, not only at
  // runtime. A frontend still calling localhost in production is almost
  // always this variable missing from the build step.
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080',
  },
};

export default config;
