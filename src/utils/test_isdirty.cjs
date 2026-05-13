const { layoutsEqual } = require('./comparison.cjs');

const racks = [{ rackId: '1', position: [0, 0] }];
const baselineRacks = [{ rackId: '1', position: [0, 0] }];

const addedRacks = [...baselineRacks, { rackId: '2', position: [1, 0] }];

function getIsDirty(current, baseline) {
  if (!baseline) return false;
  return !layoutsEqual(current, baseline);
}

console.log("Same:", getIsDirty(racks, baselineRacks));
console.log("Added:", getIsDirty(addedRacks, baselineRacks));

