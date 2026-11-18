// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract BirdPayment {
    address public owner;
    uint256 public constant PACKAGE_PRICE = 0.001 ether;
    uint256 public constant PACKAGE_ATTEMPTS = 20;
    // Событие покупки тарифа
    event PackagePurchased(
        address indexed buyer,
        uint256 indexed userId,
        uint256 attempts,
        uint256 amount
    );
    constructor() {
        owner = msg.sender;
    }

    function buyPackage(uint256 userId) external payable {
        require(userId > 0, "Invalid user ID");
        require(msg.value == PACKAGE_PRICE, "Incorrect payment");
        emit PackagePurchased(
            msg.sender,
            userId,
            PACKAGE_ATTEMPTS,
            msg.value
        );
    }

    // Вывод средств владельцем
    function withdraw() external {
        require(msg.sender == owner, "Only owner");
        (bool success, ) = payable(owner).call{ value: address(this).balance }("");
        require(success, "Withdraw failed");
    }
}
