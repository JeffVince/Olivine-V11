const Sequencer = require('@jest/test-sequencer').default;

class CustomSequencer extends Sequencer {
  sort(tests) {
    // Sort tests by type: unit -> integration -> e2e -> performance
    const testOrder = {
      'unit': 1,
      'integration': 2,
      'e2e': 3,
      'performance': 4
    };

    return tests.sort((testA, testB) => {
      const getTestType = (testPath) => {
        if (testPath.includes('/unit/')) return 'unit';
        if (testPath.includes('/integration/')) return 'integration';
        if (testPath.includes('/e2e/')) return 'e2e';
        if (testPath.includes('/performance/')) return 'performance';
        return 'unit'; // default
      };

      const typeA = getTestType(testA.path);
      const typeB = getTestType(testB.path);

      const orderA = testOrder[typeA] || 1;
      const orderB = testOrder[typeB] || 1;

      if (orderA !== orderB) {
        return orderA - orderB;
      }

      // If same type, sort alphabetically
      return testA.path.localeCompare(testB.path);
    });
  }
}

module.exports = CustomSequencer;
