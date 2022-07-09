const winston = require('winston');
const uuid = require('uuid');

module.exports.timeout = (ms = 0) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * @param {string} logFilePath
 * @returns {winston.Logger}
 */
module.exports.createLogger = logFilePath => {
  return winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.simple(),
    ),
    transports: [
      new winston.transports.File({
        filename: logFilePath,
        maxsize: 4 * 1024000,
        maxFiles: 1,
      }),
      new winston.transports.Console(),
    ],
  });
};

module.exports.generateUrl = () => {
  const random = uuid.v4().replace(/-/g, '');
  return `${random.slice(0, 6)}.${random.slice(6, 18)}.com`;
};
