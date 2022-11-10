# TezFin Indexer

This project provides an indexer for the Tezfin markets, it exposes api to get liquidity for all users that is updated at specific intervals.

## Run Indexer

1. Install dependencies (needs node v18+)
```
npm i
```
2. Start the indexer use the following command:
```
PRIVATE_KEY=<PRIVATE KEY> NETWORK=<TEZOS NETOWRK> npm run start
```
The env variables needed to run the indexer are :
 - PRIVATE KEY : your private key used to update interest params before calculating liquidity
 - NETWORK : Tezos network to run the bot on, support values are `mainnet` and `testnet`.

 ## API

 The indexer runs a server on port `8888` by default but you can configure the api server to run on different port using env vcar `PORT`. To access the indexer data hit the `/` root path and it will return the liquidity data for all the users and the block number at which the liquidity was calculated.