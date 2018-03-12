const { promisify } = require('util');
const xml2js = require('xml2js');
module.exports = {
    parseString: promisify(xml2js.parseString),
    Builder: xml2js.Builder
};
