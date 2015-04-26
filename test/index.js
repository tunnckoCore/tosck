/**
 * tosck <https://github.com/tunnckoCore/tosck>
 *
 * Copyright (c) 2015 Charlike Mike Reagent, contributors.
 * Released under the MIT license.
 */

'use strict';

var pem = require('pem');
var zlib = require('zlib');
var test = require('assertit');
var tosck = require('../index');
var server = require('./server.js');
var httpServer = server.createHttpServer();

// assertit like mocha
var describe = test.describe;
var assert = test.assert;
var it = test.it;

// ssl server stuff
var SSL_Server = null;
var SSL_Key = null;
var SSL_Cert = null;
var SSL_caRootKey = null;
var SSL_caRootCert = null;

// gzip stuff
var testGzipContent = 'Compressible response content.';

// http server routes
httpServer.on('/', function(req, res) {
  res.statusCode = 404;
  res.end('not');
});
httpServer.on('/test', function(req, res) {
  res.end(req.url);
});
httpServer.on('/empty', function(req, res) {
  res.end();
});
httpServer.on('/ok', function(req, res) {
  res.end('ok');
});
httpServer.on('/?cat=meow', function(req, res) {
  res.end(req.url);
});
httpServer.on('/headers', function(req, res) {
  res.end(JSON.stringify(req.headers));
});
httpServer.on('/gzip', function(req, res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Encoding', 'gzip');
  zlib.gzip(testGzipContent, function(err, data) {
    res.end(data);
  });
});
httpServer.on('/corrupted', function(req, res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Encoding', 'gzip');
  res.end('Not gzipped content');
});

// tests
describe('tosck', function() {
  it('setup HTTP server', function(done) {
    httpServer.listen(httpServer.port, function() {
      done();
    });
  });
  it('throw TypeError address to be string (required)', function(done) {
    function fixture() {
      tosck({body: {}}, function() {});
    }
    assert.throws(fixture, TypeError);
    assert.throws(fixture, /expect `address` be string/);
    done();
  });
  it('throw TypeError callback to be function (required)', function(done) {
    function fixture() {
      tosck(httpServer.url, {body: {}});
    }
    assert.throws(fixture, TypeError);
    assert.throws(fixture, /expect `callback` be function/);
    done();
  });
  it('dns error message', function(done) {
    tosck('.com', function(err) {
      assert.ok(err !== null);
      assert.strictEqual(/getaddrinfo ENOTFOUND/.test(err.message), true);
      done();
    });
  });
  it('error message when status code < 200 or status code > 299', function(done) {
    tosck(httpServer.url, function(err, data, res) {
      assert.ok(err !== null);
      assert.strictEqual(/response code is 404/.test(err.message), true);
      done();
    });
  });
  it('extends url.parse object with opts second argument', function(done) {
    tosck(httpServer.url, {path: '/test'}, function(err, data) {
      assert.strictEqual(err, null);
      assert.strictEqual(data, '/test');
      done();
    });
  });
  it('override query part of path property with query passed in opts', function(done) {
    tosck(httpServer.url + '/?test=doge', {query: {cat: 'meow'}}, function(err, data) {
      assert.strictEqual(err, null);
      assert.strictEqual(data, '/?cat=meow');
      done();
    });
  });
  it('decompress gzip/deflate content automagically', function(done) {
    tosck(httpServer.url + '/gzip', function(err, data) {
      assert.strictEqual(err, null);
      assert.strictEqual(data, testGzipContent);
      done();
    });
  });
  it('preserve headers property', function(done) {
    tosck(httpServer.url + '/gzip', function(err, data, res) {
      assert.strictEqual(err, null);
      assert.ok(res.headers);
      done();
    });
  });
  it('decompress gzip error', function(done) {
    tosck(httpServer.url + '/corrupted', function(err) {
      assert.ok(err);
      assert.strictEqual(err.message, 'incorrect header check');
      assert.strictEqual(err.code, 'Z_DATA_ERROR');
      done();
    });
  });
  it('send user-agent header by default', function(done) {
    tosck(httpServer.url + '/headers', function(err, data) {
      var headers = JSON.parse(data);
      var userAgent = headers['user-agent'];

      assert.strictEqual(userAgent, 'https://github.com/tunnckoCore/tosck');
      done();
    });
  });
  it('send accept-encoding header by default', function(done) {
    tosck(httpServer.url + '/headers', function(err, data) {
      var headers = JSON.parse(data);
      var acceptEncoding = headers['accept-encoding'];

      assert.strictEqual(acceptEncoding, 'gzip,deflate');
      done();
    });
  });
  it('send host header by default', function(done) {
    tosck(httpServer.url + '/headers', function(err, data) {
      var headers = JSON.parse(data);

      assert.strictEqual(headers.host, 'localhost:' + httpServer.port);
      done();
    });
  });
  it('transform headers names to lowercase', function(done) {
    tosck(httpServer.url + '/headers', {headers:{'USER-AGENT': 'cat-meow'}}, function(err, data) {
      var headers = JSON.parse(data);
      var userAgent = headers['user-agent'];

      assert.strictEqual(userAgent, 'cat-meow');
      done();
    });
  });
  it('empty response', function(done) {
    tosck(httpServer.url + '/empty', function(err, data) {
      assert.strictEqual(err, null);
      assert.strictEqual(data, '');
      done();
    });
  });
  it('protocol-less http URLs', function(done) {
    tosck((httpServer.url + '/ok').replace(/^http:\/\//, ''), function(err, data) {
      assert.strictEqual(err, null);
      assert.equal(data, 'ok');
      done();
    });
  });
  it('buffer on encoding === null', function(done) {
    tosck(httpServer.url + '/ok', {encoding: null}, function(err, data) {
      assert.strictEqual(err, null);
      assert.strictEqual(Buffer.isBuffer(data), true);
      done();
    });
  });
  it('setup SSL root pem', function(done) {
    pem.createCertificate({
      days: 1,
      selfSigned: true
    }, function(err, keys) {
      SSL_caRootKey = keys.serviceKey;
      SSL_caRootCert = keys.certificate;
      done();
    });
  });
  it('setup pem', function(done) {
    pem.createCertificate({
      serviceCertificate: SSL_caRootCert,
      serviceKey: SSL_caRootKey,
      serial: Date.now(),
      days: 500,
      country: '',
      state: '',
      locality: '',
      organization: '',
      organizationUnit: '',
      commonName: 'tunnckocore.tk'
    }, function(err, keys) {
      SSL_Key = keys.clientKey;
      SSL_Cert = keys.certificate;
      done();
    });
  });
  it('setup SSL (HTTPS) server', function(done) {
    SSL_Server = server.createHttpsServer(server.portSSL + 1, {
      key: SSL_Key,
      cert: SSL_Cert
    });

    SSL_Server.on('/https/ok', function(req, res) {
      res.end('https ok');
    });

    SSL_Server.listen(SSL_Server.port, function() {
      done();
    });
  });
  it('make request to HTTPS server', function(done) {
    tosck('https://github.com', {
      strictSSL: true
    }, function(err, data, res) {
      assert.strictEqual(err, null);
      assert.ok(data);
      done();
    });
  });
  it('request SSL server with CA', function(done) {
    tosck(SSL_Server.url + '/https/ok', {
      strictSSL: true,
      ca: SSL_caRootCert,
      headers: {host: 'tunnckocore.tk'}
    }, function(err, data) {
      assert.strictEqual(err, null);
      assert.strictEqual(data, 'https ok');
      done();
    });
  });
  it('cleanup HTTP server', function(done) {
    httpServer.close();
    done();
  });
  it('cleanup SSL server', function(done) {
    SSL_Server.close();
    done();
  });
});
