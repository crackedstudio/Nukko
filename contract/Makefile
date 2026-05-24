-include .env

build:
	forge build

test:
	forge test -vv

test-v:
	forge test -vvvv

# ── Deploy (first time) ───────────────────────────────────────────────────────

deploy-alfajores:
	forge script script/Deploy.s.sol \
		--rpc-url alfajores \
		--broadcast \
		--verify \
		-vvvv

deploy-mainnet:
	forge script script/Deploy.s.sol \
		--rpc-url celo \
		--broadcast \
		--verify \
		-vvvv

# ── Upgrade (after first deploy) ─────────────────────────────────────────────
# Set PROXY_ADDRESS in .env before running these

upgrade-alfajores:
	forge script script/Upgrade.s.sol \
		--rpc-url alfajores \
		--broadcast \
		--verify \
		-vvvv

upgrade-mainnet:
	forge script script/Upgrade.s.sol \
		--rpc-url celo \
		--broadcast \
		--verify \
		-vvvv

clean:
	forge clean

.PHONY: build test test-v deploy-alfajores deploy-mainnet upgrade-alfajores upgrade-mainnet clean
