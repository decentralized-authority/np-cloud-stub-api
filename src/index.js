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
const { CronJob } = require('cron');
const math = require('mathjs');
const dayjs = require('dayjs');

const { bignumber } = math;

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
          const balance = bignumber(balances[i]);
          const balanceRequired = bignumber(n.balanceRequired);
          const stake = math.subtract(balanceRequired, bignumber(1));
          if(n.stakeTx) {
            const tx = await accountController.getTransaction(n.stakeTx);
            const { height } = tx;
            await db.nodes.update({address: n.address}, {$set: {
                staked: true,
                stakedAmount: stake.toString(),
                stakedBlock: height.toString(10),
              }});
          } else if(math.smaller(balance, balanceRequired)) {
            continue;
          } else { // balance is greater than balance required
            logger.info(`Stake ${n.address}`);
            const stakeTx = await accountController.send(
              n.rawPrivateKey,
              stake.toString(),
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
      const deletedNodes = await db.deletedNodes.find({});
      for(const n of deletedNodes.filter(n => n.returnBalance)) {
        try {
          const balance = await accountController.getBalance(n.address);
          if(balance === '0')
            continue;
          const [ user ] = await db.users.find({id: n.user});
          if(!user)
            continue;
          const toReturn = math.subtract(bignumber(balance), bignumber('0.01')).toString();
          await accountController.send(
            n.rawPrivateKey,
            toReturn,
            n.address,
            user.address,
          );
          await db.deletedNodes.update({address: n.address}, {$set: {
              returnBalance: false,
            }});
          logger.info(`Balance of ${toReturn} POKT returned from ${n.address} to ${user.address}`);
        } catch(err) {
          handleError(err);
        }
      }
      for(const n of validators) {
        try {
          const shouldGetReward = getRandom(1, 11) === 1; // 1 in 10 chance
          if(n.unstakeDate) {
            if(dayjs().isAfter(dayjs(n.unstakeDate))) {
              // Send back stake amount
              await accountController.send(
                dataStore.get(dataStoreKeys.ACCOUNT).rawPrivateKey,
                n.stakedAmount,
                dataStore.get(dataStoreKeys.ACCOUNT).address,
                n.address,
              );
              await db.deletedNodes.insert({
                ...n,
                returnBalance: true,
              });
              await db.nodes.remove({address: n.address});
              logger.info(`Unstake complete for ${n.address}`);
            }
          } else if(shouldGetReward) {
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

    const sweep = async function() {
      try {
        const users = await db.users.find({});
        const nodes = await db.nodes.find({staked: true});
        for(const n of nodes) {
          const balance = await accountController.getBalance(n.address);
          const balanceNum = bignumber(balance);
          const diff = math.subtract(balanceNum, bignumber('1.01'));
          if(diff.toNumber() <= 0)
            continue;
          const user = users.find(u => u.id === n.user);
          if(!user)
            continue;
          const tx = await accountController.send(n.rawPrivateKey, diff.toString(), n.address, user.address);
          console.log(`Sweep ${diff.toString()} POKT to ${user.address} with tx ${tx}`);
        }
      } catch(err) {
        handleError(err);
      }
    };

    new CronJob(
      '0 5 0 * * *', // 12:05am every day
      sweep,
      null,
      true,
      'America/New_York',
    );

  } catch(err) {
    handleError(err);
  }
})();
