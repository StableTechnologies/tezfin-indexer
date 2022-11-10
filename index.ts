import * as log from 'loglevel';
import * as cjs from 'conseiljs';
import fetch from 'cross-fetch';

import { KeyStoreUtils, SoftSigner } from 'conseiljs-softsigner';
import { StartIndexer } from './src/indexer/indexer';
import { getUserLiquidity, StartServer, updateUserLiquidity } from './src/server/server';
const logger = log.getLogger('conseiljs');

logger.setLevel('info', false); // to see only errors, set to 'error'
cjs.registerLogger(logger);
cjs.registerFetch(fetch);

(BigInt.prototype as any).toJSON = function () {
    return this.toString();
};

const init = async () => {
    const config = await import(`./config/${process.env.NETWORK || 'mainnet'}.json`);
    const privKey = process.env.PRIVATE_KEY as string
    if(privKey == "" || privKey == undefined){
        throw new Error("missing private key")
    }
    console.log(`starting indexer for ${config.network}`)
    
    const keyStore = await KeyStoreUtils.restoreIdentityFromSecretKey(privKey);
    const signer: cjs.Signer = await SoftSigner.createSigner(cjs.TezosMessageUtils.writeKeyWithHint(keyStore.secretKey, 'edsk'));
    
    StartServer(getUserLiquidity);
    await StartIndexer(config, signer, keyStore, updateUserLiquidity, config.pollIntervalInseconds * 1000);
}

init()