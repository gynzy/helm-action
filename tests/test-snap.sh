#!/bin/bash
set -e
cd tests

export PATH="/tmp/bin:$PATH"

mkdir -p /tmp/bin
cp ./helm-fake /tmp/bin/helm
mkdir -p /opt/google-cloud-sdk/bin/
cp ./gcloud-fake /opt/google-cloud-sdk/bin/gcloud

for s in $(find ./scenarios/ -mindepth 1 | grep -v 'snap'); do
  echo $s
  $s > $s.snap.1
  if ! diff $s.snap.1 $s.snap; then
    echo "DIFF FAILED for $s"
    echo "Expected:"
    cat $s.snap | head -20
    echo "---"
    echo "Actual:"
    cat $s.snap.1 | head -20
    exit 1
  fi
  echo 'ok'
done
