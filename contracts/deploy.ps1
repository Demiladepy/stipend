# Deploy StipendVault to Base mainnet (8453)
# Prereq: copy .env.example -> .env and fill PRIVATE_KEY + BASE_RPC_URL
#         dedicated dev wallet needs ~0.001 ETH on Base for gas

$ErrorActionPreference = "Stop"
$env:PATH = "$HOME\.foundry\bin;" + $env:PATH

if (-not (Test-Path ".env")) {
    Write-Error "Missing contracts/.env — copy .env.example and add PRIVATE_KEY + BASE_RPC_URL"
}

forge script script/Deploy.s.sol:DeployStipendVault `
    --rpc-url base `
    --broadcast `
    -vvvv

Write-Host ""
Write-Host "Copy the StipendVault address from the logs above into:"
Write-Host "  contracts/.env  -> STIPEND_VAULT_ADDRESS"
Write-Host "  ../.env.local   -> NEXT_PUBLIC_STIPEND_VAULT_ADDRESS"
Write-Host "Then update STIPEND_BUILD.md Phase 2 RESUME NOTE + PROGRESS LOG."
