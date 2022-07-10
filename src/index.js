const fs = require('fs-extra');
const { DataStore } = require('./data-store');
const { BlockController } = require('./block-controller');
const _ = require('lodash');
const { createLogger, timeout, getRandom} = require('./util');
const { APIServer } = require('./api-server');
const { DATA_DIR, DATA_PATH, LOGS_DIR, LOG_PATH, PORT, dataStoreKeys} = require('./constants');
const { DB } = require('./db');
const { Configuration, HttpRpcProvider, Pocket } = require('@pokt-network/pocket-js');
const { AccountController } = require('./account-controller');

fs.ensureDirSync(DATA_DIR);
fs.ensureDirSync(LOGS_DIR);

const logger = createLogger(LOG_PATH);
const db = new DB(DATA_DIR);
const dataStore = new DataStore(DATA_PATH);

const handleError = err => {
  if(_.isString(err)) {
    logger.error(err);
  } else if(_.isError(err)) {
    logger.error(err.message + '\n' + err.stack);
  } else {
    console.error(err);
  }
};

(async function() {
  try {

    logger.info('Starting Node Pilot Stub API');

    const dispatcher = new URL(process.env.POCKET_ENDPOINT);
    const configuration = new Configuration(5, 1000, 0, 40000, undefined, undefined, undefined, undefined, undefined, undefined, false);
    const pocket = new Pocket([dispatcher], new HttpRpcProvider(dispatcher), configuration);

    const blockController = new BlockController(pocket, handleError);
    await blockController.initialize();
    const accountController = new AccountController(pocket);

    blockController.on(BlockController.events.BLOCK_INCREASE, async newBlock => {
      console.log('Block', newBlock);
      const nodes = await db.nodes.find({staked: false});
      const balances = await Promise
        .all(nodes.map(n => accountController.getBalance(n.address)));
      const validators = await db.nodes.find({staked: true});
      for(let i = 0; i < nodes.length; i++) {
        try {
          const n = nodes[i];
          const balance = BigInt(balances[i]);
          const balanceRequired = BigInt(n.balanceRequired);
          const stake = balanceRequired - BigInt(1);
          if(n.stakeTx) {
            const tx = await accountController.getTransaction(n.stakeTx);
            const { height } = tx;
            await db.nodes.update({address: n.address}, {$set: {
                staked: true,
                stakedAmount: stake.toString(10),
                stakedBlock: height.toString(10),
              }});
          } else if(balance < balanceRequired) {
            continue;
          } else { // balance is greater than balance required
            logger.info(`Stake ${n.address}`);
            const stakeTx = await accountController.send(
              n.rawPrivateKey,
              stake.toString(10),
              n.address,
              dataStore.get(dataStoreKeys.ACCOUNT).address,
            );
            await db.nodes.update({address: n.address}, {$set: {
                stakeTx,
              }});
          }
        } catch(err) {
          handleError(err);
        }
      }
      for(const n of validators) {
        try {
          const shouldGetReward = getRandom(1, 21) === 1; // 1 in 20 chance
          if(shouldGetReward) {
            const reward = getRandom(2, 11);
            logger.info(`Reward of ${reward} POKT for ${n.address}`);
            await accountController.send(
              dataStore.get(dataStoreKeys.ACCOUNT).rawPrivateKey,
              reward.toString(10),
              dataStore.get(dataStoreKeys.ACCOUNT).address,
              n.address,
            );
          }
        } catch(err) {
          handleError(err);
        }
      }
    });

    await timeout();

    let account = dataStore.get(dataStoreKeys.ACCOUNT);
    if(!account) {
      account = await accountController.create(AccountController.generatePassword());
      await dataStore.set(dataStoreKeys.ACCOUNT, account);
    }
    const balance = await accountController.getBalance(account.address);

    logger.info(`API account address ${account.address}`);
    logger.info(`API account balance ${balance}`);

    const server = new APIServer(PORT, db, blockController, accountController, str => logger.info(str), handleError);
    await server.start();

  } catch(err) {
    handleError(err);
  }
})();
