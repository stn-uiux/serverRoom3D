const EPSILON = 0.0001;

function isClose(a, b) {
  return Math.abs(a - b) < EPSILON;
}

function areArraysClose(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!isClose(a[i], b[i])) return false;
  }
  return true;
}

function layoutsEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (typeof a !== typeof b) return false;

  if (typeof a === 'number') {
    return isClose(a, b);
  }

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    // Check if it's a numeric array (like position or scale)
    if (a.length > 0 && typeof a[0] === 'number') {
      return areArraysClose(a, b);
    }
    for (let i = 0; i < a.length; i++) {
      if (!layoutsEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (typeof a === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
      if (!layoutsEqual(a[key], b[key])) return false;
    }
    return true;
  }

  return a === b;
}

module.exports = { layoutsEqual };
