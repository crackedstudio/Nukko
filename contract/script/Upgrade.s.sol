// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/Nukko.sol";

contract Upgrade is Script {
    function run() external {
        uint256 deployerKey  = vm.envUint("PRIVATE_KEY");
        address proxyAddress = vm.envAddress("PROXY_ADDRESS");

        vm.startBroadcast(deployerKey);

        Nukko newImplementation = new Nukko();
        Nukko(proxyAddress).upgradeToAndCall(address(newImplementation), "");

        vm.stopBroadcast();

        console.log("Proxy           :", proxyAddress);
        console.log("New impl        :", address(newImplementation));
        console.log("Upgrade complete. State preserved.");
    }
}
