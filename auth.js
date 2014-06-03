var mongoose = require('mongoose')
  , fs = require('fs')
  , jade = require('jade')
  , moment = require('moment')
  , credentials = {
		clientID: process.env.CLIENT_ID
	  , clientSecret: process.env.CLIENT_SECRET
	  , site: process.env.AUTH_SERVER
	  , authorizationPath: '/oauth/authorize'
	  , tokenPath: '/oauth/access_token'
	}
  , OAuth2 = require('simple-oauth2')(credentials)
  , redirect_uri = process.env.BASEURL + '/oauth/callback'
  , request = require('request');

var client_access_token = null
  , requestCache = {};

var setPrimaryExperimonth = function(req, memberships) {
	if(!req.session.experimonth) req.session.experimonth = {};
	if(memberships.length === 1) {
		req.session.experimonth.current = memberships[0]._id;
	}
	req.session.experimonth.memberships = memberships;
};

var populatePlayer = function(auth, req, res, next){
	//Determine which experimonths (of this kind) the current remote_user is enrolled in.
	auth.doAuthServerClientRequest('GET', '/api/1/experimonths/activeByKind/' + auth.clientID, null, function(err, experimonths){
		if(experimonths) {
			var memberships = []; //array of *active* experimonth ids that this user is a member of
			for(var x=0; x < experimonths.length; x++) {
				var month = experimonths[x];
				inner: for(var y=0; y < month.users.length; y++) {
					var uid = month.users[y]._id;
					if(uid === req.user._id) {
						memberships.push(month);
						break inner;
					}
				}
			}
			if(memberships.length) {
				setPrimaryExperimonth(req, memberships);	
			} else {
				if(req.session.experimonth) {
					req.session.experimonth.current = null;
					req.session.experimonth.memberships = null;
				}
				req.flash('info', 'You are not a member of any active experimonths. Please visit your Profile and ensure that you are enrolled in this experimonth. You may need to accept the agreement before your enrollment becomes active.');
			}
		}
		return next();
	});
};

module.exports = {
	clientID: credentials.clientID
	// This is for doing a request to the auth server by the client (not on behalf of a user)
	// callback should be: function(err, res, body)
  , doAuthServerClientRequest: function(method, path, params, callback){
		var cacheString = path+'-'+JSON.stringify(params)
		  , t = this;
		// TODO: Disabling cache for testing!
/*
		if(method == 'GET' && requestCache[cacheString]){
			if(requestCache[cacheString].expires && requestCache[cacheString].expires > Date.now()){
				return callback(requestCache[cacheString].err, requestCache[cacheString].body);
			}
			delete requestCache[cacheString];
		}
*/
		var gotAccessToken = function(){
			params = params || {};
			params.access_token = client_access_token;
			OAuth2.ClientCredentials.request(method, path, params, function(err, res, body){

			    try      { body = JSON.parse(body); }
			    catch(e) { /* The OAuth2 server does not return a valid JSON'); */ }
			    
				if(body && body.error && body.error == 'Access token expired!'){
					// generate a new access_token
					client_access_token = null;
					return t.doAuthServerClientRequest(method, path, params, callback);
				}

			    if(method == 'GET'){
				    requestCache[cacheString] = {
				    	err: err
				      , body: body
				      , expires: Date.now() + (1000 * 60 * 5) // 5 Minutes
				    };
				}

				return callback(err, body);
			});
		};
		if(!client_access_token){
			return OAuth2.ClientCredentials.getToken({}, function(err, result){
				client_access_token = result.access_token;
				gotAccessToken();
			});
		}
		gotAccessToken();
	}
  , setup: function(app){
		var $this = this;
		app.use(function(req, res, next){
			if(req.session.token){
				if(!req.user){
					// We don't have info about a user 
					// Use the token to request the user from the auth server
					return request({
						uri: process.env.AUTH_SERVER + '/profile/get?access_token='+req.session.token.access_token
					  , json: true
					}, function (error, response, body) {
						if(body && body.error && body.error == 'Access token expired!'){
							// clear the session token and start over.
							delete req.session.token;
							return next();
						}
						if(error || response.statusCode != 200){
							return next(new Error('Error connecting to auth server'));
						}
						if(body.error || !body.expires || !body.user){
							return next(new Error('Error retrieving user information: '+body.error));
						}
						req.user = body.user;
						return populatePlayer($this, req, res, next);
					});
				}
				return populatePlayer($this, req, res, next);
			}
			return next();
		});
	}
  , route: function(app){
		app.get('/oauth/callback', function(req, res){
			// We're not handling the grant callback (where we'd request the token)
			// Get the token
			OAuth2.AuthCode.getToken({
				code: req.param('code')
			  , redirect_uri: redirect_uri
			}, function(error, result) {
				if(error){
					req.flash('error', 'There was an error retreiving an access token!');
					return res.redirect('/');
				}
/* 				console.log('got token? ', arguments, req.session.redirect_uri); */
				req.session.token = result;
				if(req.session.redirect_uri){
					var uri = req.session.redirect_uri;
					delete req.session.redirect_uri;
					return res.redirect(uri);
				}
				res.redirect('/');
			});
			return;
		});
		app.get('/login', function(req, res, next){
			if(req.session.token){
				// We should do something with this token!
				var token = OAuth2.AccessToken.create(req.session.token);
				// TODO: We can't use this as the oauth provider code doesn't set expiration
				// We should replace this with a call to the server to determine if the user's session is still available / active
//				if(!token.expired()){
					// Can continue!
					if(req.param('redirect_uri')){
						return res.redirect(req.param('redirect_uri'));
					}
					return res.redirect('/');
//				}
//				// Need to refresh, so delete and fall-through;
//				delete req.session.token;
			}
			
			// We've fallen through to here, meaning
			//	- We don't have a token in our session
			//	- So, we need to push the user to the auth server to login
			req.session.redirect_uri = req.url;
			var authorization_uri = OAuth2.AuthCode.authorizeURL({
				redirect_uri: redirect_uri
			  , scope: '<scope>'
			  , state: '<state>'
			});
			res.redirect(authorization_uri);
		});
		app.get('/logout', function(req, res, next){
			delete req.session.redirect_uri;
			delete req.session.token;
			delete req.user;
			delete req.session.experimonth;
			return res.redirect((process.env.AUTH_SERVER || 'http://app.dev:8000') + '/logout');
		});
		app.get('/reset-session', function(req, res, next){
			delete req.session.token;
			delete req.user;
			delete req.session.experimonth;
			return res.redirect('/login?redirect_uri=/play');
		});
	}
  , authorize: function(requiredState, requiredRole){
		if(!requiredState){
			requiredState = 0;
		}
		if(!requiredRole){
			requiredRole = 0;
		}
		return function(req, res, next){
			if(req.user){
				// We have a user!
				if(req.user.role < requiredRole){
					// But the user doesn't have an appropriate role
					req.flash('error', 'You are not authorized to view that page!');
					res.redirect('/');
					return;
				}
				// We're authorized!
				return next();
			}else if(req.session.token){
				return next();
			}

			req.session.redirect_uri = req.url;
			var authorization_uri = OAuth2.AuthCode.authorizeURL({
				redirect_uri: redirect_uri
			  , scope: '<scope>'
			  , state: '<state>'
			});
			return res.redirect(authorization_uri);
			
			req.flash('error', 'Please login to access that page!');
			return res.redirect('/');
		};
	}
};