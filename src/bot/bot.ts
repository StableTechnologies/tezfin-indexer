import { Comptroller, FToken, ProtocolAddresses } from "tezoslendingplatform";
import { liquidate } from "../tezfin/tezfin";
import * as cjs from 'conseiljs';

export type UserMarketData = {
    borrowBalance: bigint;
    cTokenBalance: bigint;
    exchangeRate: bigint;
    isCollateral: boolean;
    borrowBalanceUSD: bigint;
    supplybalanceUSD: bigint;
    usdPrice: bigint;
}

export type UserData = {
    marketData: Record<string, UserMarketData>,
    totalLiquidityUSD: bigint;
    totalBorrowUSD: bigint;
    address: string;
}

export type LiquidateCallback = (config: any, userData: UserData[], comptrollerStorage: Comptroller.Storage, protocolAddresses: ProtocolAddresses, signer: cjs.Signer, keystore: cjs.KeyStore) => void;


export const runLiquidate: LiquidateCallback = async (config, userData, comptrollerStorage, protocolAddresses, signer, keyStore) => {
    const expScale = BigInt(comptrollerStorage.expScale.toString())
    console.log("here")
    for (let user of userData) {
        try {
            // if no loan in required asset skip user
            if (user.marketData[config.liquidatingAsset].borrowBalance <= 0) {
                console.log("here1", user.marketData,config.liquidatingAsset, user.marketData[config.liquidatingAsset])
                continue;
            }

            console.log(`liquidating user ${user.address}`)

            // total usd amount that is uncollateralized 
            const diff = user.totalBorrowUSD - user.totalLiquidityUSD;

            // calcualte max repayable loan amount for given asset in usd
            // if diff is  < maxClose use that else use maxClsoe for the given asset
            const maxClose = BigInt(comptrollerStorage.closeFactorMantissa.toString()) * user.marketData[config.liquidatingAsset].borrowBalanceUSD / expScale;
            let maxRepay = diff;
            if (diff > maxClose) {
                maxRepay = maxClose;
            }

            // convert repay amount from usd to token denomination
            let repayAmount = (maxRepay * expScale) / user.marketData[config.liquidatingAsset].usdPrice;
            if (repayAmount <= 0) {
                console.log(`skipping liquidating user ${user.address} as repay amount <= 0`)
                continue;
            }

            // figure out asset with maximum supply
            let maxSupplyAsset = config.liquidatingAsset;
            for (let asset in user.marketData) {
                if (user.marketData[asset].supplybalanceUSD > user.marketData[maxSupplyAsset].supplybalanceUSD && user.marketData[asset].isCollateral) {
                    maxSupplyAsset = asset;
                }
            }
            // check if selected asset has any supply and is also a collateral
            if (user.marketData[maxSupplyAsset].supplybalanceUSD <= 0 || !user.marketData[maxSupplyAsset].isCollateral) {
                console.log(`skipping liquidating user ${user.address} as proper collateral not found`)
                continue
            }

            // calculate amount of loan that can be repaid gien the maximum seizable collateral available in maxSupplyAsset
            const denominator = BigInt(comptrollerStorage.liquidationIncentiveMantissa.toString()) * user.marketData[config.liquidatingAsset].usdPrice / expScale;
            const numerator = user.marketData[maxSupplyAsset].exchangeRate * user.marketData[maxSupplyAsset].usdPrice / expScale;
            const ratio = numerator * expScale / denominator

            // only take 90% of total supply to reduce calculation errors
            const maxRepayAccordingToSeizeAsset = user.marketData[maxSupplyAsset].cTokenBalance * BigInt(9) * ratio / expScale / BigInt(10);

            // if max collateral that can be seized is less than what total repay amount update repay amount
            if (maxRepayAccordingToSeizeAsset < repayAmount) {
                repayAmount = maxRepayAccordingToSeizeAsset
            }

            console.log(`liquidating user ${user.address} for asset ${config.liquidatingAsset}, amount = ${parseInt(repayAmount.toString())} seizing collateral ${maxSupplyAsset}`)
            await liquidate({ amount: parseInt(repayAmount.toString()), borrower: user.address, seizeCollateral: maxSupplyAsset, supplyCollateral: config.liquidatingAsset }, protocolAddresses, config.server, signer, keyStore)
            console.log(`liquidated user ${user.address} for asset ${config.liquidatingAsset}, amount = ${parseInt(repayAmount.toString())} seizing collateral ${maxSupplyAsset}`)
        } catch (e) {
            console.log(`failed to liquidate user ${user.address} `, e)
        }

    }
}