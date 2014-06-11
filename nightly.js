var mongoose = require('mongoose'),
	db = require('./db'),
	fs = require('fs'),
	util = require('util'),
	auth = require('./auth');

// Models
var dir = __dirname + '/app/models';
// grab a list of our route files
fs.readdirSync(dir).forEach(function(file){
	require('./app/models/'+file);
});


var Group = mongoose.model('Group');
Group.doNightly(function(){
	// Wait 10s just to make sure everything has saved
	setTimeout(function(){
		process.exit(0);
	}, 10000);
});