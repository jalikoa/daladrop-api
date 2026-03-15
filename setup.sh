#!/usr/bin/env bash
##############################################################################
# elasticsearch/setup.sh
#
# One-time setup: creates the ILM policy, component template, and index
# template for nfc-api-logs.
#
# Run after Elasticsearch is healthy:
#   bash elasticsearch/setup.sh
#
# Requires: curl, jq (optional)
##############################################################################

set -euo pipefail

ES_URL="${ELASTICSEARCH_URL:-http://localhost:9200}"
ES_USER="${ELASTICSEARCH_USERNAME:-elastic}"
ES_PASS="${ELASTICSEARCH_PASSWORD:-changeme}"

AUTH="-u ${ES_USER}:${ES_PASS}"
HEADERS='-H "Content-Type: application/json"'

echo "→ Waiting for Elasticsearch at ${ES_URL}..."
until curl -s $AUTH "${ES_URL}/_cluster/health" | grep -q '"status"'; do
  sleep 3
done
echo "  Elasticsearch is up."

# ── 1. ILM policy: 30-day hot → delete ───────────────────────────────────────
echo "→ Creating ILM policy..."
curl -s -X PUT $AUTH "${ES_URL}/_ilm/policy/nfc-logs-30d" \
  -H "Content-Type: application/json" -d '{
  "policy": {
    "phases": {
      "hot": {
        "min_age": "0ms",
        "actions": {
          "rollover": {
            "max_primary_shard_size": "5gb",
            "max_age": "1d"
          },
          "set_priority": { "priority": 100 }
        }
      },
      "warm": {
        "min_age": "2d",
        "actions": {
          "shrink": { "number_of_shards": 1 },
          "forcemerge": { "max_num_segments": 1 },
          "set_priority": { "priority": 50 }
        }
      },
      "delete": {
        "min_age": "30d",
        "actions": {
          "delete": {}
        }
      }
    }
  }
}'
echo ""

# ── 2. Component template: mappings ──────────────────────────────────────────
echo "→ Creating component template (mappings)..."
curl -s -X PUT $AUTH "${ES_URL}/_component_template/nfc-logs-mappings" \
  -H "Content-Type: application/json" -d '{
  "template": {
    "mappings": {
      "dynamic": true,
      "properties": {
        "@timestamp":           { "type": "date" },
        "log.level":            { "type": "keyword" },
        "message":              { "type": "text", "fields": { "keyword": { "type": "keyword", "ignore_above": 512 } } },
        "context":              { "type": "keyword" },
        "service":              { "type": "keyword" },
        "environment":          { "type": "keyword" },
        "app":                  { "type": "keyword" },
        "type":                 { "type": "keyword" },
        "http.request.method":  { "type": "keyword" },
        "http.response.status": { "type": "short" },
        "url.path":             { "type": "keyword" },
        "durationMs":           { "type": "float" },
        "userId":               { "type": "long" },
        "merchantId":           { "type": "long" },
        "requestId":            { "type": "keyword" },
        "ip_address":           { "type": "ip" },
        "geo":                  { "type": "object" },
        "trace":                { "type": "text", "index": false },
        "process.pid":          { "type": "integer" },
        "host.name":            { "type": "keyword" }
      }
    }
  }
}'
echo ""

# ── 3. Index template: ties policy + mappings to the index pattern ────────────
echo "→ Creating index template..."
curl -s -X PUT $AUTH "${ES_URL}/_index_template/nfc-api-logs" \
  -H "Content-Type: application/json" -d '{
  "index_patterns": ["nfc-api-logs-*"],
  "template": {
    "settings": {
      "number_of_shards": 1,
      "number_of_replicas": 0,
      "index.lifecycle.name": "nfc-logs-30d",
      "index.lifecycle.rollover_alias": "nfc-api-logs"
    }
  },
  "composed_of": ["nfc-logs-mappings"],
  "priority": 200
}'
echo ""

# ── 4. Bootstrap the write alias ─────────────────────────────────────────────
echo "→ Bootstrapping write alias..."
FIRST_INDEX="nfc-api-logs-$(date +%Y.%m.%d)-000001"
curl -s -X PUT $AUTH "${ES_URL}/${FIRST_INDEX}" \
  -H "Content-Type: application/json" -d "{
  \"aliases\": {
    \"nfc-api-logs\": {
      \"is_write_index\": true
    }
  }
}" 2>/dev/null || echo "  Index already exists — skipping."
echo ""

echo "✓ Elasticsearch setup complete."
echo "  ILM policy:    nfc-logs-30d     (hot 1d → warm 2d → delete 30d)"
echo "  Index pattern: nfc-api-logs-*"
echo "  Write alias:   nfc-api-logs"