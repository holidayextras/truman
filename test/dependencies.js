const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const dirtyChai = require('dirty-chai');

chai.use(sinonChai);
chai.use(dirtyChai);

module.exports = { sinon, expect };
