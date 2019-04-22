#!/bin/bash
# Package a distribution as a zip and tar.gz archive

set -e

npm run dist
mkdir bin
cd dist/
zip -r ../bin/asciidoctor-kroki.dist.zip .
tar -zcvf ../bin/asciidoctor-kroki.dist.tar.gz .
cd -
