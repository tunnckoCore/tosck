/**
 * tosck <https://github.com/tunnckoCore/tosck>
 *
 * Copyright (c) 2015 Charlike Mike Reagent, contributors.
 * Released under the MIT license.
 */

'use strict';

var http = require('http');
var https = require('https');

exports.host = 'localhost';
exports.port = 6767;
exports.portSSL = 16167;

exports.createHttpServer =  function(port) {
  var host = exports.host;
  port = port || exports.port;

  var server = http.createServer(function(req, res) {
    server.emit(req.url, req, res);
  });

  server.host = host;
  server.port = port;
  server.url = 'http://' + host + ':' + port;
  server.protocol = 'http';

  return server;
};

exports.createHttpsServer = function(port, opts) {
  var host = exports.host;
  opts = opts || {};
  port = port || exports.portSSL;

  var server = https.createServer(opts, function(req, res) {
    server.emit(req.url, req, res);
  });

  server.host = host;
  server.port = port;
  server.url = 'https://' + host + ':' + port;
  server.protocol = 'https';

  return server;
};
