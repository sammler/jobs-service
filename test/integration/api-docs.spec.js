const superTest = require('supertest');
const HttpStatus = require('http-status-codes');
const AppServer = require('./../../src/api/app-server');

const defaultConfig = require('./../test-lib/default-config');

describe('INTEGRATION => /api-docs/', () => {
  let server;
  const appServer = new AppServer(defaultConfig);
  before(() => {
    return appServer.start()
      .then(() => {
        server = superTest(appServer.server);
      });
  });

  after(() => {
    return appServer.stop();
  });

  it('GET /api-docs => returns redirection to /api-docs/', () => {
    return server
      .get('/api-docs')
      .expect(HttpStatus.MOVED_PERMANENTLY);
  });

  it('GET /api-docs/ => returns the api-docs', () => {
    return server
      .get('/api-docs/')
      .expect(HttpStatus.OK);
  });
});
