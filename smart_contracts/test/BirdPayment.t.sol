// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/BirdPayment.sol";

contract BirdPaymentTest is Test {
    BirdPayment payment;

    function setUp() public {
        payment = new BirdPayment();
    }

    // Успешная оплата
    function testBuyPackage() public {
        address buyer = address(0x1234);
        vm.deal(buyer, 1 ether);
        vm.prank(buyer);
        payment.buyPackage{value: 0.001 ether}(3);
        assertEq(address(payment).balance, 0.001 ether);
    }

    // Неправильная сумма
    function testWrongPayment() public {
        vm.expectRevert(bytes("Incorrect payment"));
        payment.buyPackage{value: 0}(3);
    }

    // Неправильный ID пользователя
    function testInvalidUserId() public {
        vm.expectRevert(bytes("Invalid user ID"));
        payment.buyPackage{value: 0.001 ether}(0);
    }
}
