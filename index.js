/**
 * tosck <https://github.com/tunnckoCore/tosck>
 *
 * Copyright (c) 2015 Charlike Mike Reagent, contributors.
 * Released under the MIT license.
 */

'use strict';

var qs = require('querystring');
var url = require('url');
var zlib = require('zlib');
var http = require('http');
var https = require('https');
var extend = require('extend-shallow');
var kindOf = require('kind-of');
var statuses = require('statuses');
var prependHttp = require('prepend-http');
var readAllStream = require('read-all-stream');
var objectAssign = require('object-assign');
var lowercase = require('lowercase-keys');
var redirects = 0;

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
    throw new TypeError('[tosck] expect `callback` be function');
  }

  var maxRedirects = kindOf(opts.maxRedirects) === 'number';
  var followRedirects = kindOf(opts.followRedirects) === 'boolean';

  opts = kindOf(opts) === 'object' ? opts : {};

  if (opts.body && !(kindOf(opts.body) === 'string' || kindOf(opts.body) === 'buffer')) {
    throw new TypeError('[tosck] opts.body can be only Buffer or String');
  }

  opts.maxRedirects = maxRedirects ? opts.maxRedirects : 10;
  opts.followRedirects = followRedirects ? opts.followRedirects : false;

  opts.headers = extend({
    'user-agent': 'https://github.com/tunnckoCore/tosck',
    'accept-encoding': 'gzip,deflate'
  }, lowercase(opts.headers));

  if (opts.body) {
    opts.method = kindOf(opts.method) === 'string' ? opts.method : 'post';
  }
  opts.method = opts.method ? opts.method.toUpperCase() : undefined;

  request(address, opts, callback)
};

function request(address, opts, callback) {
  var parsedUrl = url.parse(prependHttp(address));
  var fn = parsedUrl.protocol === 'https:' ? https : http;

  var options = extend({}, parsedUrl, opts);

  if (options.query) {
    var query = options.query;
    options.path = (options.path ? options.path.split('?')[0] : '') + '?';
    query = typeof query === 'string' ? query : qs.stringify(query);
    options.path = options.path + query;
  }


  var req = fn.request(options, function(response) {
    var res = response;
    var code = response.statusCode;
    var contentEncoding = response.headers['content-encoding'];

    // decompress
    if (['gzip', 'deflate'].indexOf(contentEncoding) !== -1) {
      res = res.pipe(zlib.createUnzip());
    }

    // redirects
    var isRedirect = statuses.redirect[code];
    var location = response.headers.location;
    if (isRedirect && opts.followRedirects && location) {
      response.resume(); // Discard response

      if (++redirects > opts.maxRedirects) {
        var msg = 'Redirected ' + opts.maxRedirects + ' times. Aborting.';
        callback(new Error(msg), undefined, response);
        return;
      }

      request(url.resolve(address, location), opts, callback);
      return;
    }

    readAllStream(res, opts.encoding, function(err, data) {
      if (code < 200 || code > 299) {
        var msg = address + ' response code is ' + code + ' (' + statuses[code] + ')';
        err = err || new Error(msg);
        err.message = msg;
        err.code = code;
      }
      if (opts.json === true) {
        tryJson(err, data, response, callback);
        return;
      }
      callback(err, data, response);
    });
  });
  req.once('error', function(err) {
    callback(err);
  });
  if (opts.body) {
    req.end(opts.body, opts.encoding);
    return;
  }
  req.end();
}

function tryJson(err, data, res, cb) {
  try {
    data = JSON.parse(data);
  } catch(e) {
    err = e;
  }
  cb(err, data, res);
}
