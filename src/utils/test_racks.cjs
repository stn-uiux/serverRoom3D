const { layoutsEqual } = require('./test_comp_helper.cjs');

const racks = [
  {
    rackId: '1', mapId: 'A', width: 24, orientation: 180, position: [0, 0], devices: [
      { deviceId: 'd1', itemId: 'i1', position: 1, size: 1, portStates: [] }
    ]
  }
];

const baselineRacks = [
  {
    rackId: '1', mapId: 'A', width: 24, orientation: 180, position: [0, 0], devices: [
      { deviceId: 'd1', itemId: 'i1', position: 1, size: 1, portStates: [] }
    ]
  }
];

console.log("Same:", layoutsEqual(racks, baselineRacks));

const movedRacks = [
  {
    rackId: '1', mapId: 'A', width: 24, orientation: 180, position: [1, 0], devices: [
      { deviceId: 'd1', itemId: 'i1', position: 1, size: 1, portStates: [] }
    ]
  }
];

console.log("Moved:", layoutsEqual(movedRacks, baselineRacks));

const addedRacks = [...baselineRacks, { rackId: '2', mapId: 'A', position: [2, 0] }];

console.log("Added:", layoutsEqual(addedRacks, baselineRacks));

