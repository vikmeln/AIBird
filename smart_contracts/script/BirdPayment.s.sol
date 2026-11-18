// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/BirdPayment.sol";

contract BirdPaymentScript is Script {
    function run() external {
        vm.startBroadcast();

        new BirdPayment();

        vm.stopBroadcast();
    }
}
