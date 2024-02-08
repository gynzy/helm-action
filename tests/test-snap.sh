#!/bin/bash
set -e
cd tests

export PATH="/tmp/bin:$PATH"

mkdir -p /tmp/bin
cp ./helm-fake /tmp/bin/helm
cp ./helm3-fake /tmp/bin/helm3
mkdir -p /opt/google-cloud-sdk/bin/
cp ./gcloud-fake /opt/google-cloud-sdk/bin/gcloud

for s in $(find ./scenarios/ -mindepth 1 | grep -v 'snap'); do
  echo $s
  $s > $s.snap.1
  diff $s.snap.1 $s.snap
  echo 'ok'
done
