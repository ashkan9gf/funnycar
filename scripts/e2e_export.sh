#!/bin/bash
# e2e_export.sh — export استاتیک out/ برای E2E (همان محیط APK)
set -e
ROOT=/home/z/my-project
cd $ROOT
cp next.config.ts /tmp/next.config.ts.bak
cat > next.config.ts <<'EOF'
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
EOF
rm -rf /tmp/api_backup_e2e
mv src/app/api /tmp/api_backup_e2e
set +e
bunx next build 2>&1 | tail -5
BUILD_RC=$?
set -e
mv /tmp/api_backup_e2e src/app/api
cp /tmp/next.config.ts.bak next.config.ts
if [ $BUILD_RC -ne 0 ]; then echo "BUILD FAILED rc=$BUILD_RC"; exit 1; fi
test -f out/index.html && echo "out/index.html OK"
