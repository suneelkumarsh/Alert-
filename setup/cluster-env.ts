/*
 * Copyright (c) 2026. Deutsche Telekom AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Shared resolution of the environment the cluster (smoke test) projects run against.
 * Both playwright.config.ts and the auth.setup*.ts files read from here so the proxy
 * decision cannot drift between a project and the setup that logs in for it — they
 * launch separate browsers, so a mismatch authenticates through one route and tests
 * through another.
 */

export interface ProxySettings {
  server: string;
}

/**
 * Resolves the socks5 proxy for a cluster project, honouring `E2E_SOCKS_PROXY`:
 *
 *   unset      → `socks5://127.0.0.1:<defaultPort>` (the jump-host tunnel; previous behaviour)
 *   `none`     → no proxy, for dev VMs that already sit inside the network
 *   any value  → used verbatim as the proxy server
 *
 * The third form is why this takes a value rather than a boolean: it also replaces the
 * README's "align the ports in the configuration files" step for a non-standard tunnel port.
 */
export function resolveClusterProxy(
  defaultPort: number
): ProxySettings | undefined {
  const configured = process.env.E2E_SOCKS_PROXY?.trim();

  if (configured === 'none') {
    return undefined;
  }

  // Empty/whitespace counts as unset, so an exported-but-blank var still gets the tunnel
  // default instead of silently disabling the proxy.
  return { server: configured || `socks5://127.0.0.1:${defaultPort}` };
}

/**
 * Spreadable form of {@link resolveClusterProxy} for a project's `use` block, which must
 * omit `launchOptions` entirely rather than pass `proxy: undefined`.
 */
export function clusterLaunchOptions(defaultPort: number) {
  const proxy = resolveClusterProxy(defaultPort);
  return proxy ? { launchOptions: { proxy } } : {};
}

export interface ClusterCredentials {
  username: string;
  password: string;
}

/**
 * Credentials for a live cluster login.
 *
 * Call this inside the `setup()` body, never at module scope: Playwright loads these
 * files to enumerate tests (`--list`, or any run that globs them), and a module-scope
 * throw would break listing for everyone who has no cluster credentials set.
 */
export function resolveClusterCredentials(): ClusterCredentials {
  return {
    username: requireCredential('TEST_USERNAME', 'test_username'),
    password: requireCredential('TEST_PASSWORD', 'test_password'),
  };
}

/**
 * Deliberately has no default. The previous `test-admin`/`password` fallbacks turned a
 * missing variable into a failed Keycloak login, which reads like a broken cluster
 * rather than a missing export.
 */
function requireCredential(preferred: string, legacy: string): string {
  const value = process.env[preferred] ?? process.env[legacy];

  if (!value) {
    throw new Error(
      `Missing ${preferred}: smoke tests need credentials for a real portal account.\n` +
        `  TEST_USERNAME='e2e-admin' TEST_PASSWORD='…' npm run smoke:do\n` +
        `The lowercase ${legacy} form is still accepted for backwards compatibility.`
    );
  }

  return value;
}
