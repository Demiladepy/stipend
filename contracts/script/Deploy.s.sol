// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {StipendVault} from "../src/StipendVault.sol";

/// @notice Deploy StipendVault to Base mainnet (chain id 8453).
/// @dev Requires contracts/.env with PRIVATE_KEY and BASE_RPC_URL.
///      Run: forge script script/Deploy.s.sol:DeployStipendVault --rpc-url base --broadcast -vvvv
contract DeployStipendVault is Script {
    function run() external returns (StipendVault vault) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
        vault = new StipendVault();
        vm.stopBroadcast();
        console2.log("StipendVault:", address(vault));
        console2.log("Chain id:", block.chainid);
    }
}
