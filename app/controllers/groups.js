var mongoose = require('mongoose');
var Group = mongoose.model('Group');
var auth = require('./auth');

app.get('/groups/list', auth.authorize(2, 10), function(req, res){
	Group.find().populate('players').exec(function(err, groups){
		if(err){
			req.flash('error', 'Error retrieving groups: '+err);
			return res.redirect('/');
		}
		res.render('groups/list', { title: 'All Groups', groups: groups });
	});
});
