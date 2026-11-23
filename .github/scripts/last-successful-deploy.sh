#!/usr/bin/env bash
set -euo pipefail

environment="$1"

for id in $(gh api "repos/$GITHUB_REPOSITORY/deployments?environment=$environment&per_page=30" --jq '.[].id'); do
  state=$(gh api "repos/$GITHUB_REPOSITORY/deployments/$id/statuses" --jq '.[0].state')
  if [ "$state" = "success" ]; then
    gh api "repos/$GITHUB_REPOSITORY/deployments/$id" --jq '.sha'
    exit 0
  fi
done
