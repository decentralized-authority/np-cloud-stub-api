const { DB } = require('./src/db');
const { DATA_DIR } = require('./src/constants');
const { generateId } = require('./src/util');
const {Invitation} = require('./src/types/invitation');

(async function() {
  const memo = process.argv[2];
  if(!memo) {
    console.error('You must pass in an argument which specifies who the invitation is for.');
    process.exit(1);
  }
  const db = new DB(DATA_DIR);
  const invitation = generateId();
  await db.invitations.insert(new Invitation({
    invitation,
    memo,
    valid: true,
    redeemedByUser: '',
  }));
  console.log(`Invitation for ${memo}:\n\n${invitation}\n`);
})();
