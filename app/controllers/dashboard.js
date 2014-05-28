var mongoose = require('mongoose');
var auth = require('./auth');
var _ = require('underscore');
var moment = require('moment');
var config = require('./config');  
var Player = mongoose.model('Player');


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
		isDebug: config.isDebug,
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
				req.flash('info', 'Thank you for enrolling in this experimonth. The game will begin tomorrow.');
				res.render('dashboard', args);
			}
			else {
				currentPlayer = players[0];
				args.currentPlayer = currentPlayer;
				args.pointsToInvest = config.pointsToInvest;
				args.numPlayers = players.length;
				
				res.render('dashboard', args);
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
		}
	}
	
	if(userId && currentExperimonthId) {		
		Player.find({ remote_user: userId,  experimonth: currentExperimonthId }).exec(function(err, players){
			if(!players || !players.length) {
				console.log("Error: No player exists for remote_user: " + userId + " (New registration, probably)");
				req.flash('info', 'Thank you for enrolling in this experimonth. The game will begin tomorrow.');
				res.redirect('/');
			}
			else {
				currentPlayer = players[0];
				currentPlayer.todaysAction = req.body.action || null;
				currentPlayer.defaultAction = req.body.makeDefault ? req.body.action : null;
				
				if(req.body.action == 'invest' && currentPlayer.balance < config.pointsToInvest){
					req.flash('error', 'You don\'t have enough points to invest. <p>You must have at least ' + config.pointsToInvest + ' points to invest. You have ' + currentPlayer.balance + ' points.</p>');
					res.redirect('/');
				}
				else {
					currentPlayer.save(function(err){
						if(err){
							console.log("Error: Unable to save action for remove_user: " + userId + " (Error: " + err + ")");
							req.flash('error', 'An error occurred while trying to save your action. Please try again.');
						} else {
							req.flash('success', 'Your choice was saved successfully!');
						}
						res.redirect('/');
					});	
				}
			}
		});
	}
	else {
		//No Experimonth (or no userId)
		res.redirect('/');
	}
	
});

