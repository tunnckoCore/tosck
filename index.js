/**
 * tosck <https://github.com/tunnckoCore/tosck>
 *
 * Copyright (c) 2015 Charlike Mike Reagent, contributors.
 * Released under the MIT license.
 */

'use strict';

// require('autoinstall');
var handleArguments = require('handle-arguments');
var prependHttp = require('prepend-http');
var lowercase = require('lowercase-keys');
var extender = require('extend-shallow');
var resolveUrl = require('url').resolve;
var formatUrl = require('url').format;
var parseUrl = require('url').parse;
var errors = require('http-errors');
var kindOf = require('kind-of');
var omit = require('object.omit');
var https = require('https');
var http = require('http');
var zlib = require('zlib');
var util = require('util');
var qs = require('qs');

var fullUrl = 'https://user:pass@github.com/foo/damn?foo=bar&baz[0]=qux&baz[1]=jax&cat=123&a[b]=c#users=hash';
tosck(fullUrl, {query: {aaaa: {bbb: 'ccc'}}, path: '/cat/meow?foo=dog', maxRedirects: 12})

function tosck(url, opts, callback) {
  var argz = handleArguments(arguments);
  argz = transformArguments(argz);
  argz = validateArguments(argz.url, argz.opts, argz.callback);
  argz = normalizeArguments(argz.url, argz.opts, argz.callback);


  console.log(JSON.stringify(argz, 0, 2))
}

/**
 * Transform arguments to something meaningful
 *
 * @param  {Object} `argz`
 * @return {Object}
 * @api private
 */
function transformArguments(argz) {
  return {
    url: argz.args[0],
    opts: argz.args[1] || {},
    callback: argz.callback
  };
}

/**
 * Validate type of arguments
 *
 * @param  {String}   `url`
 * @param  {Object}   `[opts]`
 * @param  {Function} `callback`
 * @api private
 */
function validateArguments(url, opts, callback) {
  if (kindOf(url) !== 'string') {
    throw new TypeError('[tosck] url should be string');
  }
  opts = validateOptions(opts);

  return {
    url: url,
    opts: opts,
    callback: callback
  };
}

/**
 * Validate options object properties
 *
 * @param  {Object} `opts`
 * @return {Object}
 * @api private
 */
function validateOptions(opts) {
  if (opts.query && kindOf(opts.query) !== 'string' && kindOf(opts.query) !== 'object') {
    throw new TypeError('[tosck] opts.query should be string or object');
  }
  if (opts.path && kindOf(opts.path) !== 'string') {
    throw new TypeError('[tosck] opts.path should be string');
  }
  if (opts.pathname && kindOf(opts.pathname) !== 'string') {
    throw new TypeError('[tosck] opts.pathname should be string');
  }
  if (opts.host && kindOf(opts.host) !== 'string') {
    throw new TypeError('[tosck] opts.host should be string');
  }
  if (opts.hostname && kindOf(opts.hostname) !== 'string') {
    throw new TypeError('[tosck] opts.hostname should be string');
  }
  if (opts.timeout && kindOf(opts.timeout) !== 'number') {
    throw new TypeError('[tosck] opts.timeout should be number');
  }
  if (opts.socketTimeout && kindOf(opts.socketTimeout) !== 'number') {
    throw new TypeError('[tosck] opts.socketTimeout should be number');
  }
  if (opts.maxRedirects && kindOf(opts.maxRedirects) !== 'number') {
    throw new TypeError('[tosck] opts.maxRedirects should be number');
  }
  if (opts.followRedirects && kindOf(opts.followRedirects) !== 'boolean') {
    throw new TypeError('[tosck] opts.followRedirects should be boolean');
  }

  return opts;
}

/**
 * Normalize arguments to their default values
 *
 * @param  {String}   `url`
 * @param  {Object}   `opts`
 * @param  {Function} `callback`
 * @return {Object}
 * @api private
 */
function normalizeArguments(url, opts, callback) {
  url = prependHttp(url);

  if (opts.body && kindOf(opts.body) !== 'string' && kindOf(opts.body) !== 'buffer') {
    throw new TypeError('[tosck] opts.body should be buffer or string');
  }
  if (opts.body) {
    opts.method = kindOf(opts.method) === 'string' ? opts.method : 'post';
  }

  opts.method = opts.method ? opts.method.toUpperCase() : undefined;
  opts.timeout = opts.timeout ? opts.timeout : false;
  opts.socketTimeout = opts.socketTimeout ? opts.socketTimeout : false;
  opts.maxRedirects = opts.maxRedirects ? opts.maxRedirects : 10;
  opts.followRedirects = opts.followRedirects ? opts.followRedirects : false;
  opts.headers = extender({
    'user-agent': 'https://github.com/tunnckoCore/tosck',
    'accept-encoding': 'gzip,deflate'
  }, lowercase(opts.headers));

  var requestOptions = normalizeRequestOptions(url, opts);
  var requestUrl = formatUrl(requestOptions);

  return {
    url: url,
    opts: omit(opts, Object.keys(requestOptions)),
    requestUrl: requestUrl,
    requestOptions: requestOptions,
    callback: callback
  };
}

/**
 * Normalize, parse and set defaults of http.request options
 *
 * @param  {String} `url`
 * @param  {Object} `opts`
 * @return {Object}
 * @api private
 */
function normalizeRequestOptions(url, opts) {
  var requestOptions = parseUrl(url);
  var query = null;

  // normalize opts.query (extend opts.query possibilities)
  if (kindOf(opts.query) === 'string') {
    query = qs.stringify(qs.parse(opts.query, opts), opts);
  }
  if (kindOf(opts.query) === 'object') {
    query = qs.stringify(opts.query, opts);
  }

  requestOptions.query = query || requestOptions.query;
  requestOptions.path = requestOptions.pathname + '?' + requestOptions.query;
  requestOptions.pathname = opts.path || requestOptions.pathname || null;
  requestOptions.port = opts.port || requestOptions.port || null;
  requestOptions.search = '?' + requestOptions.query;

  if (opts.path && opts.path.indexOf('?') !== -1) {
    var parts = opts.path.split('?');
    requestOptions.pathname = parts[0];
    requestOptions.query = parts[1] + '&' + requestOptions.query;
    requestOptions.search = '?' + requestOptions.query
  }

  if (opts.host && opts.host.indexOf(':') !== -1) {
    var parts = opts.host.split(':');
    requestOptions.hostname = parts[0];
    requestOptions.port = parts[1] || requestOptions.port;
  }

  requestOptions.path = requestOptions.pathname + requestOptions.search;
  requestOptions.host = requestOptions.port
    ? requestOptions.hostname + ':' + requestOptions.port
    : requestOptions.hostname;
  requestOptions.port = requestOptions.port
    ? String(requestOptions.port)
    : null;

  return requestOptions;
}
