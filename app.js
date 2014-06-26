process.env.TZ = 'America/New_York';

// Check expected ENV vars
['BASEURL', 'PORT', 'MONGOHQ_URL', 'CLIENT_ID', 'CLIENT_SECRET', 'AUTH_SERVER', 'AWS_ACCESS_KEY', 'AWS_SECRET'].forEach(function(envVar, index){
	if(!process.env[envVar]){
		console.log(envVar+' environment variable is required!');
		process.exit();
	}
})

/**
 * Module dependencies.
 */

var express = require('express')
  , http = require('http')
  , path = require('path')
  , db = require('./db')
  , vm = require('vm')
  , util = require('util')
  , fs = require('fs')
  , flash = require('connect-flash')
  , auth = require('./auth')
  , moment = require('moment')
  , MongoStore = require('connect-mongo')(express)
  , utilities = require('./utilities')
  , config = require('./config');

var app = module.exports = express();
var port = process.env.PORT || 5000;
var server = http.createServer(app);
var io = require('socket.io').listen(server);
  
// Models
var modelsDir = __dirname + '/app/models';
fs.readdirSync(modelsDir).forEach(function(file){
	require(modelsDir + '/' + file);
});

io.set('log level', 1); // reduce logging
server.listen(port, function(){
	console.log("Express server listening on port %d in %s mode", port, app.settings.env);
});

utilities.io = io;
io.sockets.on('connection', function (socket) {
	utilities.addSocket(socket);
	socket.on('disconnect', function(){
		utilities.removeSocket(socket);
	});
});

app.configure(function(){
	app.set('port', process.env.PORT || 5000);
	app.set('views', __dirname + '/app/views');
	app.set('view engine', 'jade');
	app.use(require('less-middleware')({ src: __dirname + '/public' }));
	app.use(express.static(path.join(__dirname, 'public')));
	
	app.use(express.favicon());
	app.use(express.logger('dev'));
	app.use(express.bodyParser());
	app.use(express.methodOverride());
	app.use(express.cookieParser('your secret here'));
	app.use(express.session({
		secret: "plzkthxbai"
		, store: new MongoStore({
			url: process.env.MONGOHQ_URL,
			auto_reconnect: true
		})
	}));
	app.use(flash());
	auth.setup(app);

	var helpers = require('./helpers');
	app.locals(helpers.staticHelpers);
	app.use(function(req, res, next){
		res.locals.flash = req.flash.bind(req)
		res.locals.moment = moment;
		res.locals.token = req.session.token;
		res.local = function(key, val){
			res.locals[key] = val;
		};
		
		var _BASEURL = process.env.BASEURL;
		var EM_NAV = [
			{
				'name': 'Home',
				'link': process.env.AUTH_SERVER
			},
			{
				'name': 'Play!',
				'link': _BASEURL + '/play',
			},
			{
				'name': 'F.A.Q.',
				'link': _BASEURL + '/faq',
			},
			{
				'name': 'Confess',
				'link': process.env.AUTH_SERVER + '/confess'
			}
		];

		if(req.user && req.user.role >= 10){
			EM_NAV.push({
				'name': 'Games',
				'link': '#',
				'children': [
					{
						'name': 'Run Nightly Script',
						'link': _BASEURL + '/nightly'
					},
					{
						'name': 'Reset',
						'link': _BASEURL + '/reset'
					}
				]
			});
			EM_NAV.push({
				'name': 'Players',
				'link': _BASEURL+'/players'
			});
			EM_NAV.push({
				'name': 'Groups',
				'link': _BASEURL+'/groups'
			});
		}
		res.locals.nav = EM_NAV;
		
		return next();
	});
	var setupHelper = function(key, func){
		app.use(function(req, res, next){
			res.locals[key] = func.bind(req, res);
			next();
		});
	}
	for(var key in helpers.dynamicHelpers){
		setupHelper(key, helpers.dynamicHelpers[key]);
	}

});

app.configure('development', function(){
	app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
	app.use(express.errorHandler());
});

// Routes
auth.route(app);

var dir = __dirname + '/app/controllers';
// grab a list of our route files
fs.readdirSync(dir).forEach(function(file){
	var str = fs.readFileSync(dir + '/' + file, 'utf8');
	// inject some pseudo globals by evaluating
	// the file with vm.runInNewContext()
	// instead of loading it with require(). require's
	// internals use similar, so dont be afraid of "boot time".
	var context = { app: app, db: db, util: util, config: config, require: require, __dirname: __dirname };
	// we have to merge the globals for console, process etc
	for (var key in global) context[key] = global[key];
	// note that this is essentially no different than ... just using
	// global variables, though it's only YOUR code that could influence
	// them, which is a bonus.
	vm.runInNewContext(str, context, file);
});


