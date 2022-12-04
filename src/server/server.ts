import express, { Express, Request, Response } from 'express';

export type UpdateCallBack = (userLiquidity: Record<string, any>, accrualBlock: number) => void;
export type GetData = () => Record<string, any>;

let userLiquidity = {};
let accrualBlock = 0;
export const updateUserLiquidity = (liquidity: Record<string, any>, accrualBlockNumber: number): void => {
    // TODO: might need a mutex, but skipping in favor of db
    userLiquidity = liquidity
    accrualBlock = accrualBlockNumber
}

export const getUserLiquidity = () => {
    return { liquidity: structuredClone(userLiquidity), block: accrualBlock }
}


export const StartServer = async (getLiquidity: GetData) => {
    const app: Express = express();
    const port = process.env.PORT || "8888";

    app.get('/', (req: Request, res: Response) => {
        res.json(getLiquidity());
    });

    app.listen(port, () => {
        console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
    });
}