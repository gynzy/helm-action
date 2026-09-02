#!/bin/bash

# Note: core.getInput() only maps spaces to underscores, not dashes, so the
# hyphenated "create-namespace" input is actually read from the literal
# INPUT_CREATE-NAMESPACE env var (same quirk applies to the other hyphenated
# inputs, e.g. value-files, dry-run, fetch-dependencies). Bash's VAR=value
# prefix syntax can't assign to a name containing a dash, so it's set here
# via `env` instead.

INPUT_CLUSTERPROJECT="GKEproject" \
INPUT_CLUSTERLOCATION="GKElocation" \
INPUT_CLUSTERNAME="clusterName" \
INPUT_CLUSTERSAJSON='{"json":"here", "client_email":"example@example.com"}' \
INPUT_TOKEN=foo \
INPUT_SECRETS='{"secret": "val"}' \
INPUT_CHART=app \
INPUT_NAMESPACE=default \
INPUT_RELEASE=app \
INPUT_VERSION=1234 \
INPUT_TRACK=stable \
INPUT_VALUES='{"replicaCount": 1, "image": {"repository": "nginx", "tag": "latest"}}' \
env 'INPUT_CREATE-NAMESPACE=true' \
node ../index.js
