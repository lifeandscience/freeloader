var mongoose = require('mongoose');
var auth = require('./auth');
var _ = require('underscore');
var moment = require('moment');
var config = require('./config');  
var Player = mongoose.model('Player');
var Group = mongoose.model('Group');


var appTitle = "Freeloader";

app.get('/play', auth.authorize(1, 0, null, true), function(req, res){

	if(!req.user){
		res.redirect('/');
		return;
	}

	var userId = req.user._id;
	var currentPlayer = null;
	var currentExperimonthId = req.session.experimonth ? req.session.experimonth.current : null;
	
	var args = {
		title: appTitle, 
		remote_user: userId,
		isDebug: config('isDebug', currentExperimonthId),
		moment: moment
	};
	
	if(req.session.experimonth && req.session.experimonth.memberships && req.session.experimonth.memberships.length > 1) {
		args.memberships = req.session.experimonth.memberships;
		if(!currentExperimonthId) {
			res.render('dashboard', args);
		}
	}
	
	if(userId && currentExperimonthId) {		
		Player.find({ remote_user: userId,  experimonth: currentExperimonthId }).exec(function(err, players){
			if(!players || !players.length) {
				console.log("Error: No player exists for remote_user: " + userId + " (New registration, probably)");
				req.flash('info', 'Thank you for enrolling in this Expermonth. You will be notified by email when the game begins.');
				res.render('dashboard', args);
			}else{
				currentPlayer = players[0];
				args.currentExperimonthId = currentExperimonthId;
				args.currentPlayer = currentPlayer;
				args.pointsToInvest = config('pointsToInvest', currentExperimonthId);
				args.walkawayEnabled = config('walkawayEnabled', currentExperimonthId, false, true);

				Player.find({group: currentPlayer.group}).exec(function(err, players){
					var groups = _.groupBy(players, function(player){
						return player.lastAction;
					});
					args.groupBalance = 0;
					_.each(players, function(player){
						args.groupBalance += player.balance;
					});
					args.numPlayers = players.length;
					args.investors = groups.invest || [];
					args.freeloaders = groups.freeload || [];

					currentPlayer.getDefaultAction(function(defaultAction, isChangeable){
						args.defaultAction = defaultAction;
						args.isChangeable = isChangeable;
						
						Group.findById(currentPlayer.group).exec(function(err, group){
							args.group = group;
							res.render('dashboard', args);
						});
					});
				});
			}
		});
	}
	else {
		//No Experimonth (or no userId)
		res.render('dashboard', args);
	}

});


app.post('/play', auth.authorize(1, 0, null, true), function(req, res){
		
	if(!req.user){
		res.redirect('/');
		return;
	}
	
	var userId = req.user._id;
	var currentPlayer = null;
	var currentExperimonthId = req.session.experimonth ? req.session.experimonth.current : null;
	
	if(req.session.experimonth && req.session.experimonth.memberships && req.session.experimonth.memberships.length > 1) {
		args.memberships = req.session.experimonth.memberships;
		if(!currentExperimonthId) {
			res.render('dashboard', args);
			return;
		}
	}
	
	if(userId && currentExperimonthId) {		
		Player.find({ remote_user: userId,  experimonth: currentExperimonthId }).exec(function(err, players){
			if(!players || !players.length) {
				console.log("Error: No player exists for remote_user: " + userId + " (New registration, probably)");
				req.flash('info', 'Thank you for enrolling in this Expermonth. You will be notified by email when the game begins.');
				return res.redirect('/');
			}
			currentPlayer = players[0];
			Group.findById(currentPlayer.group).exec(function(err, group){
				if(err || !group){
					console.log('Error finding this player\'s group!', player._id, player.group, err);
					req.flash('info', 'There was an error finding your group.');
					return res.redirect('/');
				}

				if(!moment().isBefore(group.deadline)){
					req.flash('info', 'You cannot change your answer after the deadline!');
					return res.redirect('/');
				}
				// if(!currentPlayer.canSetAction(req.body.action || null)){
				// 	req.flash('error', 'You cannot ');
				// 	return;
				// }
				currentPlayer.setAction(req.body.action || null);
				currentPlayer.save(function(err){
					if(err){
						console.log("Error: Unable to save action for remove_user: " + userId + " (Error: " + err + ")");
						req.flash('error', 'An error occurred while trying to save your action. Please try again.');
					}else if(!currentPlayer.todaysAction){
						if(config('walkawayEnabled', currentPlayer.experimonth, false, true)){
							req.flash('info', 'That choice wasn\'t recognized. Please type "invest", "keep", or "leave".');
						}else{
							req.flash('info', 'That choice wasn\'t recognized. Please type "invest" or "keep".');
						}
					}else{
						// Tell the auth server about this user changing their vote
						auth.doAuthServerClientRequest('POST', '/api/1/events', {
							user: currentPlayer.remote_user,
							experimonth: currentExperimonthId,
							client_id: process.env.CLIENT_ID,
							name: 'freeloader:setAction',
							value: currentPlayer.todaysAction
						}, function(err, body){
							req.flash('success', 'Your choice was saved successfully!');
							res.redirect('/');
						});
						return;
					}
					res.redirect('/');
				});
			});
		});
	}
	else {
		//No Experimonth (or no userId)
		res.redirect('/');
	}
	
});

