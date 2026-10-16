#!/bin/sh
#  Copyright (c) 2025. Deutsche Telekom AG
#
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
#
#  SPDX-License-Identifier: Apache-2.0

# In CI the compose containers run inside a separate dind service, so Keycloak is
# reachable as "docker" rather than on the loopback of this shell. Overridable so the
# probe targets the same host the tests will use — a hard-coded localhost silently
# never answers there, turning this into a plain `sleep $max_wait`.
KEYCLOAK_HOST="${KEYCLOAK_HOST:-localhost}"

wait_for_keycloak() {
  url="http://${KEYCLOAK_HOST}:9090/realms/tnap/.well-known/openid-configuration"
  # Generous because it now aborts instead of falling through: while the probe was
  # broken, a slow realm import was still absorbed by the openapi codegen that runs
  # after this script. Only the failure path waits this long.
  max_wait=180  # Maximum wait time in seconds
  elapsed_time=0

  while true; do
    status=$(wget --quiet --spider --server-response "$url" 2>&1 | awk '/^  HTTP\// {print $2}')
    if [ "$status" = "200" ]; then
      if [ -n "$TERM" ]; then
        tput setaf 10
        printf "`echo " ✔"` `tput sgr0 && echo "Keycloak ready to receive requests"`\n"
      else
        printf " ✔ " && echo "Keycloak ready to receive requests"
      fi
      break
    else
      sleep 1
      elapsed_time=$((elapsed_time + 1))

      # Check if we've exceeded the maximum wait time
      if [ "$elapsed_time" -ge "$max_wait" ]; then
        if [ -n "$TERM" ]; then
          tput setaf 9
          printf "`echo " ✖"` `tput sgr0 && echo "Keycloak failed to be ready within $max_wait seconds"`\n"
        else
          printf " ✖ " && echo "Keycloak failed to be ready within $max_wait seconds"
        fi
        # Fail instead of continuing: every spec authenticates against this realm, so
        # carrying on only trades one clear error here for 260 confusing ones later.
        return 1
      fi
    fi
  done
}

docker-compose -f e2e/compose/docker-compose.yml up -d
# restart wiremock for the process to pick up changes
# in the wiremock/mappings directory
# this is done because upon invocation of this script,
# the containers managed by compose could already be up
docker-compose -f e2e/compose/docker-compose.yml restart wiremock
wait_for_keycloak
