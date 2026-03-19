#!/bin/bash

# PDF Card Generation Script for 150 Merchants
# Endpoint: http://localhost:3000/pdf/merchant/{id}/card/generate?async=true
# Auth: Bearer JWT (same token as initial request)

API_BASE="http://localhost:3000/pdf/merchant"
AUTH_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZW1haWwiOiJhZG1pbkBuZmNhcGkuY29tIiwicm9sZSI6IkFETUlOIiwiaWF0IjoxNzczODU4MzExLCJleHAiOjE3NzM5NDQ3MTF9._CprYH9U91I4ko5_9I3PBsVH1gfg2zLJEMH4kYFkfD4"

# Merchant user_id range (matches identity_users after inserting 150 merchants)
START_ID=7
END_ID=156

# Function to generate card for single merchant
generate_card() {
    local merchant_id=$1
    
    local response=$(curl -s -w "\n%{http_code}" -X POST \
        "${API_BASE}/${merchant_id}/card/generate?async=true" \
        -H "Authorization: Bearer ${AUTH_TOKEN}")
    
    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 201 ] || [ "$http_code" -eq 202 ]; then
        echo "[OK] Merchant $merchant_id: Card generation queued (HTTP $http_code)"
        return 0
    else
        echo "[FAIL] Merchant $merchant_id: HTTP $http_code - $body"
        return 1
    fi
}

# Main execution
echo "Starting PDF card generation for merchants $START_ID to $END_ID..."
echo "Endpoint: ${API_BASE}/<id>/card/generate?async=true"
echo "=================================================="

success_count=0
fail_count=0

for merchant_id in $(seq $START_ID $END_ID); do
    if generate_card "$merchant_id"; then
        ((success_count++))
    else
        ((fail_count++))
    fi
    
    # Small delay to avoid overwhelming the server
    sleep 0.2
done

echo "=================================================="
echo "Complete: $success_count succeeded, $fail_count failed"

# Optional: Log results to file
if [ $fail_count -gt 0 ]; then
    echo "Note: Check failed merchants above and retry if needed"
fi