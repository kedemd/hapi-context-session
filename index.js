/**
 * Created by kedemd on 3/26/2015.
 */
var Hoek = require('hoek');
var Boom = require('boom');

var internals = {};

exports.register = function(server, options, next){
    server.plugins['context'].scheme('session', internals.implementation);

    next();
};

exports.register.attributes = {
    pkg: require('./package.json'),
    dependencies: ['hapi-context']
};

internals.implementation = function(request, options, callback){
    Hoek.assert(request, 'request is required');
    Hoek.assert(options, 'Missing strategy options');

    Hoek.assert(typeof options.getContext === 'function', 'getContext method must be a function:', options.getContext);

    options.getContext(request, function(err, context){
        return callback(err, context);
    });
};