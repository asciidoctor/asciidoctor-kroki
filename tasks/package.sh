#!/bin/bash
# Package a distribution as a zip and tar.gz archive

set -e

cd "$(dirname "$0")"
cd ..
npm run build
mkdir dist
cd build/
zip -r ../dist/asciidoctor-kroki.dist.zip .
tar -zcvf ../dist/asciidoctor-kroki.dist.tar.gz .
