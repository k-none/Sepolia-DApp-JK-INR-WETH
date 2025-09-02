import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import config from './config';

function formatUnitsSafe(v, d=18){ try { return ethers.utils.formatUnits(v||0, d); } catch { return "0"; } }

export default function App(){
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null);

  const [jk, setJK] = useState(null);
  const [inr, setINR] = useState(null);
  const [weth, setWETH] = useState(null);
  const [amm, setAMM] = useState(null);

  const [wrapAmt, setWrapAmt] = useState("");
  const [unwrapAmt, setUnwrapAmt] = useState("");
  const [balances, setBalances] = useState({eth:"0",weth:"0",jk:"0",inr:"0"});

  const [swapToken, setSwapToken] = useState("JK");
  const [swapDir, setSwapDir] = useState("WETH_TO_TOKEN");
  const [amountIn, setAmountIn] = useState("");
  const [quoteOut, setQuoteOut] = useState("");

  useEffect(()=>{
    if (window.ethereum){
      const p = new ethers.providers.Web3Provider(window.ethereum);
      setProvider(p);
    }
  },[]);

  async function connect(){
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    const s = provider.getSigner();
    const a = await s.getAddress();
    setSigner(s); setAccount(a);

    const jkC = new ethers.Contract(config.JK_ADDRESS, config.ERC20_ABI, s);
    const inrC = new ethers.Contract(config.INR_ADDRESS, config.ERC20_ABI, s);
    const wethC = new ethers.Contract(config.WETH_ADDRESS, config.WETH_ABI, s);
    const ammC = new ethers.Contract(config.AMM_ADDRESS, config.AMM_ABI, s);
    setJK(jkC); setINR(inrC); setWETH(wethC); setAMM(ammC);

    await refreshBalances(p=s, addr=a, jkC, inrC, wethC);
  }

  async function refreshBalances(p, addr, jkC, inrC, wethC){
    const providerRaw = new ethers.providers.Web3Provider(window.ethereum);
    const [ethBal, wethBal, jkBal, inrBal] = await Promise.all([
      providerRaw.getBalance(addr),
      wethC.balanceOf(addr),
      jkC.balanceOf(addr),
      inrC.balanceOf(addr)
    ]);
    setBalances({
      eth: ethers.utils.formatEther(ethBal),
      weth: formatUnitsSafe(wethBal),
      jk: formatUnitsSafe(jkBal),
      inr: formatUnitsSafe(inrBal)
    });
  }

  async function wrap(){
    const val = ethers.utils.parseEther(wrapAmt || "0");
    const tx = await weth.deposit({ value: val });
    await tx.wait();
    await refreshBalances(null, account, jk, inr, weth);
    setWrapAmt("");
  }

  async function unwrap(){
    const amt = ethers.utils.parseEther(unwrapAmt || "0");
    const tx = await weth.withdraw(amt);
    await tx.wait();
    await refreshBalances(null, account, jk, inr, weth);
    setUnwrapAmt("");
  }

  function tokenAddr(){ return swapToken === "JK" ? config.JK_ADDRESS : config.INR_ADDRESS; }
  function tokenContract(){ return swapToken === "JK" ? jk : inr; }

  async function fetchReserves(){
    if (!amm) return {token: ethers.BigNumber.from(0), weth: ethers.BigNumber.from(0)};
    const [rA, rB] = await amm.getReserves(tokenAddr(), config.WETH_ADDRESS);
    // rA corresponds to tokenAddr() reserve
    return { token: rA, weth: rB };
  }

  function calcOut(inAmt, rIn, rOut){
    const feeDen = ethers.BigNumber.from(1000);
    const feeNum = ethers.BigNumber.from(3);
    const inBN = ethers.utils.parseUnits(inAmt || "0", 18);
    const inFee = inBN.mul(feeDen.sub(feeNum)).div(feeDen);
    const numerator = inFee.mul(rOut);
    const denominator = rIn.add(inFee);
    return numerator.div(denominator);
  }

  async function updateQuote(){
    if (!amountIn || Number(amountIn)<=0 || !amm) { setQuoteOut(""); return; }
    const { token, weth: rWeth } = await fetchReserves();
    let out;
    if (swapDir === "WETH_TO_TOKEN") out = calcOut(amountIn, rWeth, token);
    else out = calcOut(amountIn, token, rWeth);
    setQuoteOut(ethers.utils.formatUnits(out, 18));
  }

  useEffect(()=>{ updateQuote(); }, [amountIn, swapDir, swapToken, amm]);

  async function swap(){
    const amt = ethers.utils.parseUnits(amountIn || "0", 18);
    if (swapDir === "WETH_TO_TOKEN"){
      await (await weth.approve(config.AMM_ADDRESS, amt)).wait();
      await (await amm.swap(config.WETH_ADDRESS, tokenAddr(), amt, 0)).wait();
    } else {
      await (await tokenContract().approve(config.AMM_ADDRESS, amt)).wait();
      await (await amm.swap(tokenAddr(), config.WETH_ADDRESS, amt, 0)).wait();
    }
    await refreshBalances(null, account, jk, inr, weth);
    setAmountIn(""); setQuoteOut("");
  }

  return (
    <div style={{padding:24,fontFamily:'Inter, Arial', maxWidth: 900, margin:'0 auto'}}>
      <h1>Swap ETH ⇄ JK / INR (via WETH)</h1>
      {!account ? <button onClick={connect}>Connect Wallet</button> : <p>Connected: {account}</p>}

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap: 16}}>
        <div style={{border:'1px solid #ddd', borderRadius:12, padding:16}}>
          <h3>Wrap / Unwrap</h3>
          <p>ETH: {balances.eth} | WETH: {balances.weth}</p>
          <div>
            <input placeholder="ETH amount" value={wrapAmt} onChange={e=>setWrapAmt(e.target.value)} />
            <button onClick={wrap} disabled={!wrapAmt}>Wrap to WETH</button>
          </div>
          <div style={{marginTop:8}}>
            <input placeholder="WETH amount" value={unwrapAmt} onChange={e=>setUnwrapAmt(e.target.value)} />
            <button onClick={unwrap} disabled={!unwrapAmt}>Unwrap to ETH</button>
          </div>
        </div>

        <div style={{border:'1px solid #ddd', borderRadius:12, padding:16}}>
          <h3>Swap</h3>
          <div style={{marginBottom:8}}>
            <label>Token: </label>
            <select value={swapToken} onChange={e=>setSwapToken(e.target.value)}>
              <option value="JK">JK</option>
              <option value="INR">INR</option>
            </select>
          </div>
          <div style={{marginBottom:8}}>
            <label>Direction: </label>
            <select value={swapDir} onChange={e=>setSwapDir(e.target.value)}>
              <option value="WETH_TO_TOKEN">WETH → {swapToken}</option>
              <option value="TOKEN_TO_WETH">{swapToken} → WETH</option>
            </select>
          </div>
          <div>
            <input placeholder="Amount in" value={amountIn} onChange={e=>setAmountIn(e.target.value)} />
            <button onClick={swap} disabled={!amountIn}>Swap</button>
          </div>
          <div style={{marginTop:8}}>
            <small>Estimated out: {quoteOut || "-"}</small>
          </div>
        </div>
      </div>

      <hr/>
      <h3>Contract Addresses (edit src/config.js)</h3>
      <pre>{JSON.stringify({
        JK_ADDRESS: config.JK_ADDRESS,
        INR_ADDRESS: config.INR_ADDRESS,
        WETH_ADDRESS: config.WETH_ADDRESS,
        AMM_ADDRESS: config.AMM_ADDRESS
      }, null, 2)}</pre>
    </div>
  );
}
