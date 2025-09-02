// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SimpleAMM {
    struct Pair {
        address tokenA;
        address tokenB;
        uint256 reserveA;
        uint256 reserveB;
        uint256 totalShares;
        mapping(address => uint256) shares;
    }

    mapping(bytes32 => Pair) private pairs;

    event PoolCreated(address indexed tokenA, address indexed tokenB, bytes32 pairId);
    event LiquidityAdded(bytes32 pairId, address indexed provider, uint256 amountA, uint256 amountB, uint256 shares);
    event LiquidityRemoved(bytes32 pairId, address indexed provider, uint256 amountA, uint256 amountB, uint256 shares);
    event Swapped(bytes32 pairId, address indexed trader, address tokenIn, uint256 amountIn, uint256 amountOut);

    uint256 public constant FEE_NUM = 3; // 0.3%
    uint256 public constant FEE_DEN = 1000;

    function _pairId(address a, address b) internal pure returns (bytes32) {
        return a < b ? keccak256(abi.encodePacked(a, b)) : keccak256(abi.encodePacked(b, a));
    }

    function createPool(address tokenA, address tokenB) external {
        require(tokenA != tokenB, "identical tokens");
        bytes32 id = _pairId(tokenA, tokenB);
        Pair storage p = pairs[id];
        require(p.tokenA == address(0) && p.tokenB == address(0), "pool exists");
        p.tokenA = tokenA; p.tokenB = tokenB;
        emit PoolCreated(tokenA, tokenB, id);
    }

    function getReserves(address tokenA, address tokenB) external view returns (uint256 reserveA, uint256 reserveB) {
        bytes32 id = _pairId(tokenA, tokenB);
        Pair storage p = pairs[id];
        if (p.tokenA == tokenA) {
            return (p.reserveA, p.reserveB);
        } else {
            return (p.reserveB, p.reserveA);
        }
    }

    function addLiquidity(address tokenA, address tokenB, uint256 amountA, uint256 amountB) external returns (uint256 sharesMinted) {
        bytes32 id = _pairId(tokenA, tokenB);
        Pair storage p = pairs[id];
        require(p.tokenA != address(0), "pool not exists");
        IERC20(tokenA).transferFrom(msg.sender, address(this), amountA);
        IERC20(tokenB).transferFrom(msg.sender, address(this), amountB);

        if (p.totalShares == 0) {
            sharesMinted = _sqrt(amountA * amountB);
        } else {
            uint256 shareA = (amountA * p.totalShares) / p.reserveA;
            uint256 shareB = (amountB * p.totalShares) / p.reserveB;
            require(shareA == shareB, "uneven amounts");
            sharesMinted = shareA;
        }
        require(sharesMinted > 0, "insufficient liquidity minted");

        if (p.tokenA == tokenA) { p.reserveA += amountA; p.reserveB += amountB; }
        else { p.reserveA += amountB; p.reserveB += amountA; }

        p.totalShares += sharesMinted;
        p.shares[msg.sender] += sharesMinted;

        emit LiquidityAdded(id, msg.sender, amountA, amountB, sharesMinted);
    }

    function removeLiquidity(address tokenA, address tokenB, uint256 shares) external returns (uint256 amountA, uint256 amountB) {
        bytes32 id = _pairId(tokenA, tokenB);
        Pair storage p = pairs[id];
        require(p.shares[msg.sender] >= shares, "not enough shares");

        amountA = (shares * p.reserveA) / p.totalShares;
        amountB = (shares * p.reserveB) / p.totalShares;

        p.shares[msg.sender] -= shares;
        p.totalShares -= shares;
        p.reserveA -= amountA;
        p.reserveB -= amountB;

        if (p.tokenA == tokenA) {
            IERC20(tokenA).transfer(msg.sender, amountA);
            IERC20(tokenB).transfer(msg.sender, amountB);
        } else {
            IERC20(tokenA).transfer(msg.sender, amountB);
            IERC20(tokenB).transfer(msg.sender, amountA);
        }

        emit LiquidityRemoved(id, msg.sender, amountA, amountB, shares);
    }

    function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut) external returns (uint256 amountOut) {
        bytes32 id = _pairId(tokenIn, tokenOut);
        Pair storage p = pairs[id];
        require(p.tokenA != address(0), "pool not exists");

        uint256 reserveIn;
        uint256 reserveOut;
        bool reversed = false;
        if (p.tokenA == tokenIn) { reserveIn = p.reserveA; reserveOut = p.reserveB; }
        else { reserveIn = p.reserveB; reserveOut = p.reserveA; reversed = true; }

        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);

        uint256 amountInWithFee = amountIn * (FEE_DEN - FEE_NUM) / FEE_DEN;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = reserveIn + amountInWithFee;
        amountOut = numerator / denominator;
        require(amountOut >= minAmountOut, "slippage");

        if (!reversed) { p.reserveA += amountIn; p.reserveB -= amountOut; }
        else { p.reserveB += amountIn; p.reserveA -= amountOut; }

        IERC20(tokenOut).transfer(msg.sender, amountOut);
        emit Swapped(id, msg.sender, tokenIn, amountIn, amountOut);
    }

    function _sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y == 0) return 0;
        uint256 x = y / 2 + 1;
        z = y;
        while (x < z) {
            z = x;
            x = (y / x + x) / 2;
        }
    }

    function sharesOf(address tokenA, address tokenB, address who) external view returns (uint256) {
        bytes32 id = _pairId(tokenA, tokenB);
        Pair storage p = pairs[id];
        return p.shares[who];
    }
}
