import fetch from 'cross-fetch';

export const FetchUsers = async (bigMapIds: number[], network: string): Promise<Set<string>> => {
    const users = new Set<string>();
    for (const id of bigMapIds) {
        const response = await fetch(`https://api.${network}.tzkt.io/v1/bigmaps/${id}/keys?active=true&limit=10000`);
        const data = await response.json() as any;
        data.forEach((item: any) => {
            users.add(item.key)
        });
    }
    return users
}


type MarketData = {
    address: string;
    price: bigint;
    updateLevel: string;
    collateralFactor: bigint
}
export const GetAllMarkets = async (comptrollerMapId: number, network: string): Promise<Record<string, MarketData>> => {
    const markets: Record<string,MarketData> = {}
    const response = await fetch(`https://api.${network}.tzkt.io/v1/bigmaps/${comptrollerMapId}/keys?active=true&limit=10000`);
    const data = await response.json() as any;
    data.forEach((item: any) => {
        markets[item.value.name] = {
            address: item.key,
            price: BigInt(item.value.price),
            updateLevel: item.value.updateLevel,
            collateralFactor: BigInt(item.value.collateralFactor)
        }
    });
    return markets;
}

export const GetAllUserCollaterals = async (comptrollerMapId: number, network: string): Promise<Record<string,Set<string>>> => {
    const collaterals: Record<string,Set<string>> = {}
    const response = await fetch(`https://api.${network}.tzkt.io/v1/bigmaps/${comptrollerMapId}/keys?active=true&limit=10000`);
    const data = await response.json() as any;
    data.forEach((item: any) => {
        collaterals[item.key] = new Set(item.value)
    });
    return collaterals;
}