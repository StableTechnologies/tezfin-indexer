import { GetMarkets, GetUserSnapShot, UpdateInterest } from "../tezfin/tezfin";
import { FetchUsers, GetAllUserCollaterals } from "../tzkt/apis";
import * as cjs from 'conseiljs';
import { UpdateCallBack } from "../server/server";
import { LiquidateCallback, UserData, UserMarketData } from "../bot/bot";
import { Comptroller, ProtocolAddresses } from "tezoslendingplatform";

const sleep = (ms: number) => new Promise(resolveFunc => setTimeout(resolveFunc, ms));

export const StartIndexer = async (config: any, protocolAddresses: ProtocolAddresses, signer: cjs.Signer, keystore: cjs.KeyStore, updateUserLiquidity: UpdateCallBack, liquidateUsers: LiquidateCallback, sleepTime: number) => {
    while (true) {
        try {
            let userLiquidity: Record<string, any> = {};
            const allMarkets = await GetMarkets(protocolAddresses, config.server);
            const users = await FetchUsers(Object.values(allMarkets), config.network).then(items => Array.from(items));
            if (users.length > 0) {
                let liquidatedUsers: UserData[] = []
                console.log("update interest params")
                await UpdateInterest(users[0], protocolAddresses.comptroller, config.server, signer, keystore);
                const comptrollerStorage = await Comptroller.GetStorage(protocolAddresses.comptroller, protocolAddresses, config.server)
                const expScale = BigInt(comptrollerStorage.expScale.toString())
                const startTime = performance.now();
                const collaterals = await GetAllUserCollaterals(comptrollerStorage.collateralsMapId, config.network)
                const accrualBlock = comptrollerStorage.markets["USD"].updateLevel.toString()
                console.log(`calculating liquidity for ${users.length} users`)
                for (const user of users) {
                    let userData: Record<string, UserMarketData> = {};
                    console.log(` - calculating liquidity for ${user}`)
                    let totalLiquidity = BigInt(0), borrow = BigInt(0);
                    for (const cToken in comptrollerStorage.markets) {
                        let collateral = false;
                        const userSnap = await GetUserSnapShot(user, protocolAddresses.fTokens[cToken], config.server, accrualBlock)
                        const priceIndex = BigInt(comptrollerStorage.markets[cToken].price.toString()) * BigInt(comptrollerStorage.markets[cToken].collateralFactor.toString()) / expScale;
                        const tokensToDenom = priceIndex * userSnap.exchangeRate / expScale
                        if (collaterals[user] != undefined && collaterals[user].has(protocolAddresses.fTokens[cToken])) {
                            totalLiquidity += tokensToDenom * userSnap.cTokenBalance / expScale
                            collateral = true;
                        }
                        borrow += BigInt(comptrollerStorage.markets[cToken].price.toString()) * userSnap.borrowBalance / expScale
                        userData[cToken] = {
                            borrowBalance: userSnap.borrowBalance,
                            cTokenBalance: userSnap.cTokenBalance,
                            exchangeRate: userSnap.exchangeRate,
                            isCollateral: collateral,
                            borrowBalanceUSD: BigInt(comptrollerStorage.markets[cToken].price.toString()) * userSnap.borrowBalance / expScale,
                            supplybalanceUSD: (BigInt(comptrollerStorage.markets[cToken].price.toString()) * userSnap.exchangeRate / expScale) * userSnap.cTokenBalance / expScale,
                            usdPrice: BigInt(comptrollerStorage.markets[cToken].price.toString()),
                        }
                    }
                    userLiquidity[user] = {
                        collateral: totalLiquidity,
                        borrow: borrow,
                    }
                    if (totalLiquidity < borrow) {
                        liquidatedUsers.push({ marketData: userData, totalBorrowUSD: borrow, totalLiquidityUSD: totalLiquidity, address: user })
                    }
                }
                const seconds = Math.round((performance.now() - startTime) / 1000);
                console.log(`time taken for ${users.length} users ${seconds}secs`);
                updateUserLiquidity(userLiquidity, parseInt(accrualBlock))

                if (liquidatedUsers.length > 0) {
                    liquidateUsers(config, liquidatedUsers, comptrollerStorage, protocolAddresses, signer, keystore)
                }
            }
        } catch (e) {
            console.log("faield to run liquidity update job ", e)
        }
        await sleep(sleepTime);
    }
}
