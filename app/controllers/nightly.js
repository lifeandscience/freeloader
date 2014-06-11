var mongoose = require('mongoose');
var Group = mongoose.model('Group');
var auth = require('./auth');

app.get('/nightly', auth.authorize(2, 10), function(req, res){
	Group.doNightly(function(){
		res.redirect('/groups');
	});
});






