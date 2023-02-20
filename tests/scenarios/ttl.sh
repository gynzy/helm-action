#!/bin/bash

INPUT_CLUSTERPROJECT="GKEproject" \
INPUT_CLUSTERLOCATION="GKElocation" \
INPUT_CLUSTERNAME="clusterName" \
INPUT_CLUSTERSAJSON='{"json":"here"}' \
INPUT_HELM=helm3 \
INPUT_TOKEN=foo \
INPUT_SECRETS='{"secret": "val"}' \
INPUT_CHART=app \
INPUT_NAMESPACE=default \
INPUT_RELEASE='app-pr-123' \
INPUT_VERSION=1234 \
INPUT_TRACK=stable \
INPUT_VALUES='{"replicaCount": 1, "image": {"repository": "nginx", "tag": "latest"}}' \
INPUT_TTL='7 days' \
node ../index.js
