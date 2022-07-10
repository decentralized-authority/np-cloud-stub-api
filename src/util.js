const winston = require('winston');
const uuid = require('uuid');

module.exports.timeout = (ms = 0) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * @returns {string}
 */
const generateId = () => {
  return uuid.v4().replace(/-/g, '');
};
module.exports.generateId = generateId;

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

/**
 * @returns {string}
 */
module.exports.generateUrl = () => {
  const random = generateId();
  return `${random.slice(0, 6)}.${random.slice(6, 18)}.com`;
};

/**
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
module.exports.getRandom = (min, max) => {
  return Math.floor(Math.random() * (max - min) + min);
};
