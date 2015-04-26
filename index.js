/**
 * tosck <https://github.com/tunnckoCore/tosck>
 *
 * Copyright (c) 2015 Charlike Mike Reagent, contributors.
 * Released under the MIT license.
 */

'use strict';

var url = require('url');
var zlib = require('zlib');
var http = require('http');
var https = require('https');
var extend = require('extend-shallow');
var kindOf = require('kind-of');
var statuses = require('statuses');
var prependHttp = require('prepend-http');
var readAllStream = require('read-all-stream');
var lowercase = require('lowercase-keys');

module.exports = tosck;

function tosck(address, opts, callback) {
  if (kindOf(address) !== 'string') {
    throw new TypeError('[tosck] expect `address` be string');
  }
  if (!callback && kindOf(opts) === 'function') {
    callback = opts;
    opts = {};
  }
  if (kindOf(callback) !== 'function') {
    throw new TypeError('[tosck] expect `callback` be funsction');
  }

  var redirects = 0;
  var maxRedirects = kindOf(opts.maxRedirects) === 'number';
  var followRedirects = kindOf(opts.followRedirects) === 'boolean';

  opts = kindOf(opts) === 'object' ? opts : {};
  opts.maxRedirects = maxRedirects ? opts.maxRedirects : 10;
  opts.followRedirects = followRedirects ? opts.followRedirects : false;

  opts.headers = extend({
    'user-agent': 'https://github.com/tunnckoCore/tosck',
    'accept-encoding': 'gzip,deflate'
  }, lowercase(opts.headers));

  if (opts.body) {
    opts.method = kindOf(opts.method) === 'string' ? opts.method : 'post';
  }

  var parsedUrl = url.parse(prependHttp(address));
  var fn = parsedUrl.protocol === 'https:' ? https : http;

  opts = lowercase(opts);
  opts = extend(parsedUrl, opts);

  var req = fn.request(opts, function(response) {
    var res = response;
    var contentEncoding = res.headers['content-encoding'];

    // decompress
    if (['gzip', 'deflate'].indexOf(contentEncoding) !== -1) {
      res = res.pipe(zlib.createUnzip());
    }

    // redirects
    var isRedirect = statuses.redirect[response.statusCode];
    var location = response.headers.location;
    if (opts.followRedirects && isRedirect && location) {
      response.resume(); // Discard response

      if (redirects++ > opts.maxRedirects) {
        var msg = 'Redirected ' + redirects + ' times. Aborting.';
        callback(new Error(msg), undefined, response);
        return;
      }

      tosck(url.resolve(address, location), opts, callback);
      return;
    }

    readAllStream(res, opts.encoding, function(err, data) {
      if (opts.json === true) {
        tryJson(data, callback, response);
        return;
      }
      callback(err, data, response);
    });
  });
  req.once('error', function (err) {
    callback(err);
  })
  req.end();
};

function tryJson(data, callback, response) {
  var isError = null;
  try {
    data = JSON.parse(data);
  } catch(err) {
    isError = err;
  }
  callback(isError, data, response);
}
