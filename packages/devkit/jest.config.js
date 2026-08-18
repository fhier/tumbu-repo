module.exports = {
  preset: '../../apps/api/node_modules/ts-jest',
  testEnvironment: 'node',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': '../../apps/api/node_modules/ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
};
