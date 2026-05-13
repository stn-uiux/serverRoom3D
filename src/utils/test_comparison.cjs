const { layoutsEqual } = require('./test_comp_helper.cjs');

const a = [{ rackId: '1', position: [0, 0] }];
const b = [{ rackId: '1', position: [0, 1] }];
const c = [{ rackId: '1', position: [0, 0] }, { rackId: '2', position: [1, 1] }];

console.log("a vs b:", layoutsEqual(a, b)); // expected false
console.log("a vs c:", layoutsEqual(a, c)); // expected false
console.log("a vs a:", layoutsEqual(a, JSON.parse(JSON.stringify(a)))); // expected true
