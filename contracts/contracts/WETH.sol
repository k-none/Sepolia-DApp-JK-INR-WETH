// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title Wrapped Ether (WETH)
 * @dev ERC20 that mints on deposit() and burns on withdraw().
 */
contract WETH is ERC20 {
    constructor() ERC20("Wrapped Ether", "WETH") {}

    receive() external payable { deposit(); }

    function deposit() public payable {
        require(msg.value > 0, "no ETH sent");
        _mint(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external {
        _burn(msg.sender, amount);
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "ETH transfer failed");
    }
}
