var mongoose = require('mongoose');
var Group = mongoose.model('Group');
var auth = require('./auth');
var _ = require('underscore');

app.get('/groups', auth.authorize(2, 10), function(req, res){
	
	var months = {};
	auth.doAuthServerClientRequest('GET', '/api/1/experimonths/activeByKind/'+auth.clientID, null, function(err, experimonths){

		_.each(experimonths, function(experimonth) {
			experimonth.groups = [];
			months[experimonth._id] = experimonth;

		});
		
		Group.find().exec(function(err, groups){
			if(err){
				req.flash('error', 'Error retrieving groups: '+err);
				return res.redirect('/');
			}
			_.each(groups, function(group) {
				if(months[group.experimonth] && months[group.experimonth].groups) {
					months[group.experimonth].groups.push(group);	
				}
			});
			res.render('groups', { title: 'All Groups', experimonths: months, num_groups: groups.length });
		});
	});
});


// SIMULATE GROUP STUFF  ---  TESTING ONLY!


app.get('/groups/simulate/deleteall/:experimonth_id', auth.authorize(2, 10), function(req, res){
	if(!req.param('experimonth_id')){
		req.flash('error', 'You must specify an experimonth in order to delete all groups.');
		res.redirect('back');
		return;
	}
	
	Group.find({ experimonth: req.params.experimonth_id }).exec(function(err, groups){
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
	res.redirect('/groups');

});