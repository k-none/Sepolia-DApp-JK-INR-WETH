# Sepolia DApp — Swap ETH ⇄ JK / INR via WETH (AMM)

This DApp lets users **swap Sepolia ETH** to your tokens **JK** and **INR** using a simple constant-product AMM.
It uses **WETH** (wrapped ETH) so native ETH can be swapped like any ERC20.

## What's inside
- `contracts/`
  - `JKToken.sol`, `INRToken.sol` — ERC20 tokens
  - `WETH.sol` — wraps ETH with `deposit()` / `withdraw()`
  - `SimpleAMM.sol` — constant-product AMM (ERC20-only, fee 0.3%)
  - Hardhat config + deploy script that deploys JK, INR, WETH, AMM and **creates pools** for JK-WETH & INR-WETH
- `frontend/` (Vite + React + ethers)
  - Connect wallet, wrap/unwrap ETH, and swap WETH ⇄ JK/INR with quotes

## Quick start
### Backend
```bash
cd contracts
npm install
npm install @openzeppelin/contracts
npx hardhat compile
```

Create `.env` in `contracts/`:
```
SEPOLIA_RPC=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
PRIVATE_KEY=0xYOUR_PRIVATE_KEY
```

Deploy (Sepolia):
```bash
npx hardhat run scripts/deploy.js --network sepolia
```

### Frontend
```bash
cd ../frontend
npm install
# Edit src/config.js with the printed addresses for JK, INR, WETH, AMM
npm run dev
```
Connect MetaMask on Sepolia and use the app.

## Seed liquidity (example)
After deploy, **add initial liquidity** to JK-WETH and INR-WETH pools so swaps work:
```js
// in Hardhat console (npx hardhat console --network sepolia)
const jk = await ethers.getContractAt("JKToken", "JK_ADDRESS");
const inr = await ethers.getContractAt("INRToken", "INR_ADDRESS");
const weth = await ethers.getContractAt("WETH", "WETH_ADDRESS");
const amm = await ethers.getContractAt("SimpleAMM", "AMM_ADDRESS");

// approve and add (example ratios)
await jk.approve(amm.address, ethers.utils.parseUnits("10000",18));
await weth.deposit({ value: ethers.utils.parseEther("10") });
await weth.approve(amm.address, ethers.utils.parseEther("10"));
await amm.addLiquidity(jk.address, weth.address, ethers.utils.parseUnits("10000",18), ethers.utils.parseEther("10"));

// INR-WETH
await inr.approve(amm.address, ethers.utils.parseUnits("10000",18));
await weth.approve(amm.address, ethers.utils.parseEther("10"));
await amm.addLiquidity(inr.address, weth.address, ethers.utils.parseUnits("10000",18), ethers.utils.parseEther("10"));
```
