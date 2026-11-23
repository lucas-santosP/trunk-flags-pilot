#!/usr/bin/env bash
set -euo pipefail

validated_sha="$1"
candidate_sha="$2"

if [ -z "$validated_sha" ] || [ "$validated_sha" = "$candidate_sha" ]; then
  exit 1
fi

if ! git merge-base --is-ancestor "$validated_sha" "$candidate_sha"; then
  exit 1
fi

changed=$(git diff --name-only "$validated_sha" "$candidate_sha")
[ "$changed" = "flags/production.json" ]
