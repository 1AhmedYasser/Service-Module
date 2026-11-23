# Vault support

Service-Module reads its backend secrets from the shared Bürokratt HashiCorp
Vault (the instance defined in Buerokratt-Chatbot's `docker-compose.yml`,
see `Buerokratt-Chatbot/vault/README.md`) instead of `constants.ini` or
filesystem secret files.

## Access path

Ruuter never handles a raw Vault token. DSLs call the Service-Module Vault
Agent's API proxy, which authenticates with its own AppRole and injects the
token:

| Constant | Default | Purpose |
|---|---|---|
| `SERVICE_VAULT_AGENT` | `http://vault-agent-service-module:8205` | Vault Agent proxy reached over the shared `bykstack` network |
| `SERVICE_VAULT_SECRETS_PATH` | `service-module/prod` | KV v2 prefix this deployment reads from |

A test deployment points `SERVICE_VAULT_AGENT` at
`http://vault-agent-service-module-test:8206` and sets
`SERVICE_VAULT_SECRETS_PATH=service-module/test`. The test AppRole's policy
explicitly denies `secret/service-module/prod/*`, so test credentials can't
read production secrets.

## Policies

| AppRole | Policy | Access |
|---|---|---|
| `service-module-service` | `service-module-policy` | read on `secret/service-module/prod/*` |
| `service-module-test-service` | `service-module-test-policy` | read on `secret/service-module/test/*`; `secret/service-module/prod/*` denied |

Both are read-only. Other modules' prefixes (`backoffice/*`, `ckb/*`,
`llm-module/*`, ...) are not granted and so are denied.

## Backend flows covered

| Flow | Secret | Field |
|---|---|---|
| Azure Search indexer trigger (`POST services/edit`, `POST services/status`) via `TEMPLATES/trigger-azure-indexer.yml` | `<SERVICE_VAULT_SECRETS_PATH>/azure-search` | `api_key` |

`AZURE_SEARCH_SERVICE_NAME` and `AZURE_SEARCH_INDEXER_NAME` stay in
`constants.ini` because they aren't secret. `AZURE_SEARCH_API_KEY` has been
removed from `constants.ini`.

Out of scope here: API call credential references (`secrets/prod|test`
variables), a credential-selection UI, and migrating all existing credentials.

## Local development

Service-Module's `docker-compose.yml` ships its own small Vault, so it runs
without the Chatbot stack: `service-module-vault`, `service-module-vault-init`
and `vault-agent-service-module`, which is reachable on `bykstack` under the
same hostname as the shared agent. Its init script (`vault/vault-init.sh`)
creates only `service-module-policy` and the `service-module-service` AppRole.
It's safe to re-run, and it unseals Vault after a restart.

```sh
docker compose up -d service-module-vault service-module-vault-init vault-agent-service-module
docker exec service-module-vault sh -c 'VAULT_TOKEN=$(awk "/^Initial Root Token:/ {print \$4}" /vault/data/init.txt) \
  vault kv put secret/service-module/prod/azure-search api_key=<key>'
```

Don't run this local agent and the Chatbot stack's `vault-agent-service-module`
at the same time. Both answer to the same hostname on `bykstack`, so Ruuter
would reach either Vault at random.

## Writing a secret

```sh
docker exec vault sh -c 'VAULT_TOKEN=$(jq -r .root_token /vault/data/init.json) \
  vault kv put secret/service-module/prod/azure-search api_key=<key>'
```

## Reading a secret from a DSL

Use the `vault-secret` template. It doesn't log the request or response
content, and it never returns the raw Vault response:

```yaml
get_my_secret:
  template: "[#SERVICE_PROJECT_LAYER]/vault-secret"
  requestType: templates
  body:
    name: "my-secret"
  result: my_secret   # { status, data }
```

## Failure modes

`vault-secret` returns a `status` for each case and logs a distinct message
that names the secret path but never its value. There's no fallback to
`constants.ini` or files.

| `status` | Cause |
|---|---|
| `ok` | Secret read; values are in `data` |
| `missing` | Secret path doesn't exist (Vault `404`) |
| `denied` | The policy doesn't allow this path (Vault `403`) |
| `unavailable` | Vault is sealed, down, or erroring (any other status from the agent) |
| `invalid` | Secret name failed validation (`[A-Za-z0-9_-]+`) |

If the Vault Agent itself can't be reached, Ruuter raises a connection error
(`Webclient error: ... vault-agent-service-module`) and the calling DSL fails.

For the Azure indexer, `missing`, `denied` and `unavailable` are logged as
`Error!` and the indexer run is skipped. Saving or changing the status of a
service still succeeds, as it did before when the key was empty.

## Verifying

```sh
# prod identity can read prod
docker run --rm --network bykstack curlimages/curl -s -o /dev/null -w '%{http_code}\n' \
  http://vault-agent-service-module:8205/v1/secret/data/service-module/prod/azure-search   # 200 (404 if not written yet)

# test identity can't read prod
docker run --rm --network bykstack curlimages/curl -s -o /dev/null -w '%{http_code}\n' \
  http://vault-agent-service-module-test:8206/v1/secret/data/service-module/prod/azure-search   # 403

# neither can read another module's secrets
docker run --rm --network bykstack curlimages/curl -s -o /dev/null -w '%{http_code}\n' \
  http://vault-agent-service-module:8205/v1/secret/data/backoffice/global/tim-postgresql   # 403
```
