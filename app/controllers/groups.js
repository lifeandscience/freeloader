var mongoose = require('mongoose');
var Group = mongoose.model('Group');
var auth = require('./auth');
var _ = require('underscore');

app.get('/groups/list', auth.authorize(2, 10), function(req, res){
	Group.find().exec(function(err, groups){
		if(err){
			req.flash('error', 'Error retrieving groups: '+err);
			return res.redirect('/');
		}
		res.render('groups/list', { title: 'All Groups', groups: groups });
	});
});


app.get('/groups/start', auth.authorize(2, 10), function(req, res){
	Group.startGroup(req, function(){
	//	req.flash('info', 'Day started successfully!');
	//	res.redirect('/games');
	});
});




// SIMULATE GROUP STUFF  ---  TESTING ONLY!


app.get('/groups/simulate/deleteall', auth.authorize(2, 10), function(req, res){
	Group.find().exec(function(err, groups){
		_.each(groups, function(group) {
			if(group) {
				group.remove(function(err){
					if(err){
						req.flash('error', 'Error while deleting group: ' + err);
					}
				});
			}
		});
	});
	res.redirect('/');

});