#!/bin/bash
# Publish the package to npmjs

set -e

cd "$(dirname "$0")"
node publish.js
