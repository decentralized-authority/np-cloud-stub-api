const fs = require('fs-extra');
const path = require('path');
const { DataStore } = require('./data-store');
const { BlockController } = require('./block-controller');
const _ = require('lodash');
const { createLogger, timeout } = require('./util');
const {APIServer} = require('./api-server');
const { PORT, dataStoreKeys} = require('./constants');
const {DB} = require('./db');
const { Configuration, HttpRpcProvider, Pocket } = require('@pokt-network/pocket-js');
const { AccountController } = require('./account-controller');

const dataDir = path.resolve(__dirname, '../data');
fs.ensureDirSync(dataDir);
const dataPath = path.join(dataDir, 'data.json');

const logsDir = path.resolve(__dirname, '../logs');
fs.ensureDirSync(logsDir);
const logFilePath = path.join(logsDir, 'server.log');
const logger = createLogger(logFilePath);

const db = new DB(dataDir);

const dataStore = new DataStore(dataPath);

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
      for(let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const balance = BigInt(balances[i]);
        const balanceRequired = BigInt(n.balanceRequired);
        const stake = balanceRequired - BigInt(1);
        if(n.stakeTx) {
          await db.nodes.update({address: n.address}, {$set: {
            staked: true,
            stakedAmount: stake.toString(10),
            stakedBlock: (Number(newBlock) - 1).toString(10),
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
