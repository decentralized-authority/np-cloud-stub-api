const fs = require('fs-extra');
const path = require('path');
const { DataStore } = require('./data-store');
const {BlockController} = require('./block-controller');
const _ = require('lodash');
const { createLogger, timeout } = require('./util');
const {APIServer} = require('./api-server');
const {port} = require('./constants');
const {DB} = require('./db');
const { Configuration, HttpRpcProvider, Pocket } = require('@pokt-network/pocket-js');

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
    return new Pocket([dispatcher], new HttpRpcProvider(dispatcher), configuration);

    // Start the block controller

    const blockController = new BlockController(dataStore, handleError);
    blockController.on(BlockController.events.BLOCK_INCREASE, newBlock => {
      console.log('Block', newBlock);
    });
    await blockController.initialize();
    await timeout();

    const server = new APIServer(port, db, str => logger.info(str), handleError);
    await server.start();

  } catch(err) {
    handleError(err);
  }
})();
