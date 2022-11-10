import { GetUserSnapShot, UpdateInterest } from "../tezfin/tezfin";
import { FetchUsers, GetAllMarkets, GetAllUserCollaterals } from "../tzkt/apis";
import * as cjs from 'conseiljs';
import { UpdateCallBack } from "../server/server";

const sleep = (ms: number) => new Promise(resolveFunc => setTimeout(resolveFunc, ms));
const expScale = BigInt("1000000000000000000")

export const StartIndexer = async (config: any, signer: cjs.Signer, keystore: cjs.KeyStore, updateUserLiquidity: UpdateCallBack, sleepTime:  number) => {
    while (true) {
        let userLiquidity: Record<string, any> = {};
        const users = await FetchUsers(config.ctokenMapIds, config.network).then(items => Array.from(items));
        if (users.length > 0) {
            console.log("update interest params")
            await UpdateInterest(users[0], config.comptroller, config.server, signer, keystore);
            const startTime = performance.now();
            const markets = await GetAllMarkets(config.comptrollerMarketMapId, config.network)
            const collaterals = await GetAllUserCollaterals(config.comptrollerCollateralMapId, config.network)
            const accrualBlock = markets["BTC"].updateLevel
            console.log(`calculating liquidity for ${users.length} users`)
            for (const user of users) {
                console.log(` - calculating liquidity for ${user}`)
                let totalLiquidity = BigInt(0), borrow = BigInt(0);
                for (const cToken in markets) {
                    const userSnap = await GetUserSnapShot(user, markets[cToken].address, config.server, accrualBlock)
                    const priceIndex = markets[cToken].price * markets[cToken].collateralFactor / expScale;
                    const tokensToDenom = priceIndex * userSnap.exchangeRate / expScale
                    if (collaterals[user] != undefined && collaterals[user].has(markets[cToken].address))
                        totalLiquidity += tokensToDenom * userSnap.cTokenBalance / expScale
                    borrow += markets[cToken].price * userSnap.borrowBalance / expScale
                }
                userLiquidity[user] = {
                    collateral: totalLiquidity,
                    borrow: borrow,
                }
            }
            const seconds = Math.round((performance.now() - startTime) / 1000);
            console.log(`time taken for ${users.length} users ${seconds}secs`);
            updateUserLiquidity(userLiquidity, parseInt(accrualBlock))
        }
        await sleep(sleepTime);
    }
}