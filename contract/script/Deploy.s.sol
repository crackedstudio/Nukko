// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/Nukko.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer    = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        // 1. Deploy the implementation (logic contract)
        Nukko implementation = new Nukko();

        // 2. Encode the initialize() call — runs once through the proxy at deploy
        bytes memory initData = abi.encodeWithSelector(
            Nukko.initialize.selector,
            deployer
        );

        // 3. Deploy the proxy — this is the address users and the frontend interact with
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);

        vm.stopBroadcast();

        console.log("Implementation :", address(implementation));
        console.log("Proxy (USE THIS):", address(proxy));
        console.log("Owner           :", deployer);
        console.log("");
        console.log("Add to .env:");
        console.log("PROXY_ADDRESS=", address(proxy));
    }
}
