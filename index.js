/**
 * Created by kedemd on 3/26/2015.
 */
var Hoek = require('hoek');
var Boom = require('boom');

var internals = {};

exports.register = function(server, options, next){
    server.ext('onPreResponse', function(request, reply){
        var plugin = request.plugins['hapi-context-session'];

        if (plugin){
            internals.endSession(request, plugin.options.beforeEndSession, plugin.options.afterEndSession, function(err){
                if (err) return reply(Boom.badImplementation("Failed to end session", err));
                return reply.continue();
            });
        } else {
            reply.continue();
        }
    });

    server.on('response', function(request){
        var plugin = request.plugins['hapi-context-session'];

        if (plugin){
            if (!request.plugins.context || !request.plugins.context.release){
                request.server.log(['error','hapi-context-session'], "No context to release");
                return;
            }

            request.plugins.context.release(function(err){
                if (err) {
                    request.log(['error', 'hapi-context-session'], { message : 'Failed to release context session', error : err });
                }
            });
        }
    });

    server.plugins['context'].scheme('session', internals.implementation);
    next();
};

exports.attributes = require('./package.json');

internals.endSession = function(request, beforeEndSession, afterEndSession, callback){
    var code = request.response.isBoom ? request.response.output.statusCode : request.response.statusCode;
    code = code ? code : 500;

    if (request.response &&
        (code == 401) || (code == 403) || // unauthorized|| // forbidden
        (code >= 200  && code < 300)) { // ok

        beforeEndSession(request, function(err){
            if (err) return callback(Boom.badImplementation("Before end session failed", err));

            request.plugins.context.commit(function(err, result){
                if (err) {
                    // Something went wrong while trying to commit the session.
                    return callback(Boom.badImplementation("Failed to commit the session", err));
                }

                afterEndSession(request, function(err){
                    if (err) return callback(Boom.badImplementation("After end session failed", err));

                    return callback();
                });
            });
        });
    } else {
        if (!request.plugins.context || !request.plugins.context.rollback){
            request.server.log(['error','hapi-context-session'], "No context to rollback");
            return callback();
        }

        request.plugins.context.rollback(function(err){
            // If there was an error return it
            if (err) return callback(Boom.badImplementation("Failed while trying to rollback session",err));

            beforeEndSession(request, function(err){
                if (err) return callback(Boom.badImplementation("Before end session failed", err));
                afterEndSession(request, function(err){
                    if (err) return callback(Boom.badImplementation("After end session failed", err));
                    return callback();
                });
            });
        });
    }
};

internals.implementation = function(request, options, callback){
    Hoek.assert(request, 'request is required');
    Hoek.assert(options, 'Missing strategy options');

    Hoek.assert(typeof options.getContext === 'function', 'getContext method must be a function:', options.getContext);
    Hoek.assert(typeof options.beforeEndSession === 'function', 'getContext method must be a function:', options.beforeEndSession);
    Hoek.assert(typeof options.afterEndSession === 'function', 'getContext method must be a function:', options.afterEndSession);

    request.plugins['hapi-context-session'] = {
        options : options
    };

    options.getContext(request, function(err, context){
        if (err) return callback(err);

        Hoek.assert(typeof context.commit === 'function', 'commit method must be a function:', context.commit);
        Hoek.assert(typeof context.rollback === 'function', 'rollback method must be a function:', context.rollback);
        Hoek.assert(typeof context.release === 'function', 'release method must be a function:', context.release);

        // Register the request options for later use
        request.plugins['hapi-context-session'].context = context;

        return callback(err, context);
    });
};
