// vim: noai:ts=2:sw=2
var fs = require('fs'),
    url = require('url'),

    Router = require('mixu_minimal').Router,

    Package = require('./package.js'),
    Resource = require('./resource.js'),
    ETag = require('./etag.js'),

    remoteUrl = 'http://registry.npmjs.com/',
    logger = console;

var api = new Router();

api.configure = function(config) {
  if (typeof config.remoteUrl !== 'undefined') {
    remoteUrl = config.remoteUrl;
  }
  if (typeof config.logger !== 'undefined') {
    logger = config.logger;
  }
};

// GET /package
api.get(new RegExp('^/([^/]+)$'), function(req, res, match) {
  var name = match[1];
  Package.getIndex(name, function(err, fullpath, etag) {
    if (err) {
      res.statusCode = err.statusCode || 500;
      logger.error('[' + res.statusCode + '] Error: ', err);
      if (err.content) {
        res.write(err.content);
      }
      res.end();
      return;
    }

    if (ETag.handle304(req, res, etag)) {
      return;
    }

    res.end(JSON.stringify(fullpath));
  });
});

// GET /package/download/package-version.tgz
// GET /package/-/package-version.tgz
api.get(new RegExp('^/([^/]+)/(.+)/([^/]+)$'), function(req, res, match) {
  var uri = url.resolve(remoteUrl, match[0]);

  // direct cache access - this is a file get, not a metadata get
  logger.log('cache get', uri);

  Resource.get(uri)
          .getReadablePath(function(err, fullpath, etag) {
            if (err) {
              res.statusCode = err.statusCode || 500;
              logger.error('[' + res.statusCode + '] Error: ', err);
              if (err.content) {
                res.write(err.content);
              }
              res.end();
              return;
            }

            if (ETag.handle304(req, res, etag)) {
              return;
            }

            res.setHeader('Content-type', 'application/octet-stream');
            fs.createReadStream(fullpath).pipe(res);
          });
});

// /-/ or /package/-/ are special
api.get(new RegExp('^/-/(.+)$'), Package.proxy);
api.get(new RegExp('^/(.+)/-(.*)$'), Package.proxy);

// GET /package/version
api.get(new RegExp('^/([^/]+)/([^/]+)$'), function(req, res, match) {
  var name = match[1],
      version = match[2],
      self = this;
  Package.getVersion(name, version, function(err, fullpath, etag) {
    if (err) {
      res.statusCode = err.statusCode || 500;
      logger.error('[' + res.statusCode + '] Error: ', err);
      if (err.content) {
        res.write(err.content);
      }
      res.end();
      return;
    }

    if (ETag.handle304(req, res, etag)) {
      return;
    }

    res.end(JSON.stringify(fullpath));
  });
});

// EXPERIMENTAL!
// Publish support

api.put(new RegExp('.*'), function(req, res, match) {
  logger.log('Publish recieved');
  var tempFile = 'w:/Temp/_npmlazy/_tmp-'+Math.random().toString(36).substring(2);
  var filePipe = fs.createWriteStream(tempFile);
  req.pipe(filePipe);
  filePipe.on('finish', function(){
    Package.publishToSelf(tempFile, function(err){
      fs.unlink(tempFile);
      if (err) {
        logger.error(err);
        res.statusCode = 400;
        res.end();
      } else {
        res.statusCode = 200;
        res.end();
      }
    });
  });
});

api.post(new RegExp('.*'), function(req, res, match, data) {
  console.log('got a POST to '+match[0]);
});

module.exports = api;
