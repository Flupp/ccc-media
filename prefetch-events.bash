#!/usr/bin/env bash

set -Ceu

function trace() {
	printf '+'
	printf ' %q' "${@}"
	printf '\n'
	"${@}"
}

mkdir prefetched-events

< data.json  \
jq --raw-output0 '.[].guid'  \
| while IFS= read -d $'\0' -r
  do
	trace curl --fail --output "prefetched-events/${REPLY}" "https://media.ccc.de/public/events/${REPLY}" || true
  done
