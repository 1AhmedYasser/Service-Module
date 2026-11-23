#!/bin/sh
set -e

export VAULT_ADDR="${VAULT_ADDR:-http://service-module-vault:8200}"
INIT_FILE="/vault/data/init.txt"
CREDENTIALS_DIR="/agent/credentials"
ROLE="service-module-service"

echo "=== Service-Module local Vault initialization ==="

echo "Waiting for Vault..."
for i in $(seq 1 30); do
    rc=0
    vault status >/dev/null 2>&1 || rc=$?
    [ "$rc" -ne 1 ] && break
    echo "Waiting... ($i/30)"
    sleep 2
done

if ! vault operator init -status >/dev/null 2>&1; then
    echo "Initializing Vault (1 key share / 1 threshold - local dev only)..."
    vault operator init -key-shares=1 -key-threshold=1 > "$INIT_FILE"
    chmod 600 "$INIT_FILE"
fi

UNSEAL_KEY=$(awk '/^Unseal Key 1:/ {print $4}' "$INIT_FILE")
ROOT_TOKEN=$(awk '/^Initial Root Token:/ {print $4}' "$INIT_FILE")

if vault status 2>/dev/null | grep -q '^Sealed *true'; then
    echo "Unsealing Vault..."
    vault operator unseal "$UNSEAL_KEY" >/dev/null
fi

export VAULT_TOKEN="$ROOT_TOKEN"

vault secrets list | grep -q '^secret/' || vault secrets enable -path=secret -version=2 kv
vault auth list | grep -q '^approle/' || vault auth enable approle

vault policy write service-module-policy - <<'EOF'
path "secret/data/service-module/prod/*" { capabilities = ["read"] }
path "secret/metadata/service-module/prod/*" { capabilities = ["read", "list"] }
EOF

vault write "auth/approle/role/$ROLE" \
    token_policies=service-module-policy token_period=1h token_num_uses=0 \
    secret_id_ttl=0 secret_id_num_uses=0 bind_secret_id=true >/dev/null

mkdir -p "$CREDENTIALS_DIR"
RID_FILE="$CREDENTIALS_DIR/${ROLE}_role_id"
SID_FILE="$CREDENTIALS_DIR/${ROLE}_secret_id"

vault read -field=role_id "auth/approle/role/$ROLE/role-id" > "$RID_FILE"
chmod 640 "$RID_FILE"

if [ -s "$SID_FILE" ] && VAULT_TOKEN= vault write auth/approle/login \
        role_id="$(cat "$RID_FILE")" secret_id="$(cat "$SID_FILE")" >/dev/null 2>&1; then
    echo "$ROLE: existing secret_id still valid - reusing"
else
    echo "$ROLE: minting a new secret_id"
    vault write -f -field=secret_id "auth/approle/role/$ROLE/secret-id" > "$SID_FILE"
    chmod 640 "$SID_FILE"
fi

echo "=== Vault init complete ==="
