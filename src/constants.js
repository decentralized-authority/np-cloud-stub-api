const path = require('path');
module.exports.dataStoreKeys = {
  ACCOUNT: 'ACCOUNT',
};

module.exports.PORT = 3300;

module.exports.POCKET_MINIMUM_STAKE = BigInt('15100');

module.exports.TRANSACTION_FEE_UPOKT = '10000';

const dataDir = path.resolve(__dirname, '../data');
module.exports.DATA_DIR = dataDir;
module.exports.DATA_PATH = path.join(dataDir, 'data.json');
const logsDir = path.resolve(__dirname, '../logs');
module.exports.LOGS_DIR = logsDir;
module.exports.LOG_PATH = path.join(logsDir, 'server.log');
