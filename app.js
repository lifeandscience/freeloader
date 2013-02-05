
/**
 * Module dependencies.
 */

var express = require('express')
  , http = require('http')
  , path = require('path')
  , flash = require('connect-flash')
  , models = require('./lib/models')
  , routes = require('./routes')
  , User = models.User
  , passport = require('passport')
  , FacebookStrategy = require('passport-facebook').Strategy
  , config = require('./config');

var app = express();

passport.use(new FacebookStrategy({
		clientID: process.env.FB_APP_ID || '240269872746246',
		clientSecret: process.env.FB_SECRET || '7797ab8af4f7e1cda5e7f9418e7a9db5',
		callbackURL: (process.env.BASEURL || 'http://localhost:5000') + '/auth/facebook/callback'
	},
	function(accessToken, refreshToken, profile, done) {
		User.findOrCreateFromFacebook(profile, function(err, user) {
			if (err) { return done(err); }
			done(null, user);
		});
	}
));

// Serialize based on the user ID.
passport.serializeUser(function(user, done) {
	// @todo: Save your user to the database using the ID as a key.
	done(null, user._id);
});

// Load the user and return it to passport.
passport.deserializeUser(function(id, done) {
	// @todo:	Load your user here based off of the ID, and call done with
	// that user object.
	User.findById(id, done);
});

app.configure(function(){
	app.set('port', process.env.PORT || 5000);
	app.set('views', __dirname + '/views');
	app.set('view engine', 'jade');
	app.use(express.favicon());
	app.use(express.logger('dev'));
	app.use(express.bodyParser());
	app.use(express.methodOverride());
	app.use(express.cookieParser('your secret here'));
	app.use(express.session());
	app.use(flash());
	app.use(passport.initialize());
	app.use(passport.session());

	app.use(function(req, res, next){
		// Dynamic locals
		res.locals.user = req.user;
		res.locals.errorMessages = req.flash('error');
		res.locals.successMessages = req.flash('success');
		res.locals.config = config;
		next();
	});

	app.use(app.router);
	app.use(require('less-middleware')({ src: __dirname + '/public' }));
	app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
	app.use(express.errorHandler());
});

app.get('/', routes.index);
app.post('/', routes.post);
app.get('/clear', routes.clr);
app.get('/do/day/wyffUgTythyruhidas', routes.doDay);

app.get('/auth', routes.auth.index);
app.get('/auth/facebook', routes.auth.facebook.index);
app.get('/auth/facebook/callback', routes.auth.facebook.callback);

app.get('/profile/del', routes.profile.del);
app.get('/profile/list', routes.profile.list);
app.get('/profile/generate', routes.profile.generate);

app.get('/profile', routes.profile.get);
app.post('/profile', routes.profile.post);
app.get('/profile/:id', routes.profile.getById);
app.post('/profile/:id', routes.profile.postById);

app.get('/groups', routes.group.list);

http.createServer(app).listen(app.get('port'), function(){
	console.log("Express server listening on port " + app.get('port'));
});
