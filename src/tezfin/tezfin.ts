import * as cjs from 'conseiljs';
import { TezosNodeReader } from 'conseiljs';
import { TezosLendingPlatform, FToken, ProtocolAddresses } from 'tezoslendingplatform';


export const GetPrices = async(ctokenAddresses:any, oracle:string, server:string)=>{
    const head = await cjs.TezosNodeReader.getBlockHead(server);
    const price:Record<string, any> = {}
    for(const asset in ctokenAddresses){
       const assetPrice = await cjs.TezosNodeWriter.runView(
        server,
        "main",
        oracle,
        "getPrice",
        { "string": `${asset}-USD` },
        `${head.header.level}`
    );
    price[asset] = assetPrice.data.args[1].int;
    }
    return price
}

export const GetUserSnapShot = async(user:string, ctoken:string, server:string, block:string)=>{
    const data =  await cjs.TezosNodeWriter.runView(
        server,
        "main",
        ctoken,
        "getAccountSnapshotView",
        { "string": user },
        block,
    );
    return {
        borrowBalance : BigInt(data.data.args[0].args[1].int),
        cTokenBalance : BigInt(data.data.args[1].int),
        exchangeRate : BigInt(data.data.args[2].int),
    }
}

export const GetAccrualBlockNumber = async(ctoken:string, server:string)=>{
    const head = await cjs.TezosNodeReader.getBlockHead(server);
    return await cjs.TezosNodeWriter.runView(
        server,
        "main",
        ctoken,
        "accrualBlockNumber",
        { "prim": "Unit" },
        `${head.header.level}`,
    );
}

export async function UpdateInterest(user: string, comptroller:string, server: string, signer: cjs.Signer, keystore: cjs.KeyStore, gas: number = 800_000, freight: number = 20_000): Promise<{opHash:string,head:number}> {
    const head = await cjs.TezosNodeReader.getBlockHead(server);
    const param = `{ "bytes": "${cjs.TezosMessageUtils.writeAddress(user)}" }`;
    const operation = await cjs.TezosNodeWriter.sendContractInvocationOperation(server, signer, keystore, comptroller, 0, 0, freight, gas, "updateAccountLiquidityWithView", param, cjs.TezosParameterFormat.Micheline, undefined, true);
    return confirmTransaction(server, cjs.TezosContractUtils.clearRPCOperationGroupHash(operation.operationGroupID),head.header.level);
}

export const confirmTransaction = async (server:string, opHash:string, startBlock:number) => {
    return await cjs.TezosNodeReader.awaitOperationConfirmation(
        server,
        startBlock,
        opHash,
        6
    ).then((res) => {
        if (
            res.contents[0].metadata.operation_result.status === 'applied'
        ) {
            return res;
        }
        throw new Error('operation status not applied');
    });
};

export async function Liquidate(details: FToken.LiquidateDetails, protocolAddresses: ProtocolAddresses, server: string, signer: cjs.Signer, keystore: cjs.KeyStore, gas: number = 800_000, freight: number = 20_000) {
    const head = await TezosNodeReader.getBlockHead(server)
    const opHash = await TezosLendingPlatform.Liquidate(details,protocolAddresses, server, signer, keystore, 0, gas, freight);
    await confirmTransaction(server,opHash,head.header.level);
}

export async function GetMarkets(protocolAddresses: ProtocolAddresses, server: string): Promise<Record<string,FToken.Storage>> {
    // get storage for all contracts
    let markets:Record<string,FToken.Storage> = {};
    await Promise.all(Object.keys(protocolAddresses.fTokens).map(async (asset) => {
        const fTokenAddress = protocolAddresses.fTokens[asset];
        const fTokenType = protocolAddresses.underlying[protocolAddresses.fTokensReverse[fTokenAddress]].tokenStandard;
            const fTokenStorage: FToken.Storage = await FToken.GetStorage(fTokenAddress, protocolAddresses.underlying[protocolAddresses.fTokensReverse[fTokenAddress]], server, fTokenType);
            markets[asset as string] = fTokenStorage
    }));
    return markets;
}