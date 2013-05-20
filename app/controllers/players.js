var mongoose = require('mongoose');
var Player = mongoose.model('Player');
var auth = require('./auth');
var _ = require('underscore');
var async = require('async');
var config = require('./config');


app.get('/players/edit/:player_id', auth.authorize(2, 10), function(req, res){
	if(!req.param('player_id')){
		req.flash('error', 'You must specify the player id to edit.');
		res.redirect('back');
		return;
	}
	Player.find({ _id: req.params.player_id }).exec(function(err, players){
		if(players && players.length > 0) {
			res.render('players/edit', {title: 'Edit Player', util: util, player: players[0] });
		}	
	});
});

app.post('/players/edit/:player_id', auth.authorize(2, 10), function(req, res){
	if(!req.param('player_id')){
		req.flash('error', 'You must specify the player id to edit.');
		res.redirect('back');
		return;
	}
	Player.find({ _id: req.params.player_id }).exec(function(err, players){
		if(players && players.length > 0) {
			var player = players[0];
			_.each(['balance','todaysAction', 'defaultAction'], function(key, index){
				if(req.body[key]){
					player[key] = req.body[key];
				}
			});
			player.save(function(){
				req.flash('success', 'Player updated!');
				res.redirect('/players/list');
			});
		}
	});
});

app.get('/players/list', auth.authorize(2, 10), function(req, res){
	Player.find().sort({balance: 'desc'}).exec(function(err, players){
		res.render('players/list', { title: 'All Players', players: players });
	});
});


// SIMULATE PLAYER CREATION  ---  TESTING ONLY!

app.get('/players/simulate/create/:num_players', auth.authorize(2, 10), function(req, res){
	if(!req.param('num_players')){
		req.flash('error', 'You must specify a number of players to create for simulation.');
		res.redirect('back');
		return;
	}
	//Just simulate players in the first experimonth.
	auth.doAuthServerClientRequest('GET', '/api/1/experimonths/activeByKind/'+auth.clientID, null, function(err, experimonths){
		if(experimonths && experimonths.length) {
			var experimonth = experimonths[0]; //change this index if you want to populate other months.
			
			Player.find({ experimonth: experimonth._id }).exec(function(err, players){
				var existing_count = players.length;
				var new_count = existing_count + req.params.num_players;
				var actions = [ "invest", "freeload", null ];
				if(new_count > 15) {
					actions.push("leavegroup");
				}
				for(x=0; x < req.params.num_players; x++) {
					var initial_balance = Math.floor((Math.random()*10));	//Pick a random number of points between 0-10 to append to default starting points
					var player = new Player();
					player.balance = config.startingPoints + initial_balance;
					player.todaysAction = actions[initial_balance % actions.length];
					player.experimonth = experimonth._id;
					player.save(function(err, player){
						if(err){
							console.log('error saving player: ', err);
						}
					});
					initial_balance ++;
				}
				res.redirect('/players/list');
			
			});
		
		}
	});
});

app.get('/players/simulate/deleteall', auth.authorize(2, 10), function(req, res){
	Player.find().exec(function(err, players){
		_.each(players, function(player) {
			player && player.remove(function(err){
				if(err){
					req.flash('error', 'Error while deleting player: ' + err);
				}
			});
		});
	});
	res.redirect('/players/list');

});

//This re-runs the random decision/action picker and assigns a new todaysAction for each player.
app.get('/players/simulate/newactions', auth.authorize(2, 10), function(req, res){
	auth.doAuthServerClientRequest('GET', '/api/1/experimonths/activeByKind/'+auth.clientID, null, function(err, experimonths){
		async.eachLimit(experimonths, 5, function(experimonth, nextMonth) {
			Player.find({ experimonth: experimonth._id }).exec(function(err, players){
				var actions = [ "invest", "freeload", null ];
				if(players.length > 15) {
					actions.push("leavegroup");
				}
				async.eachLimit(players, 5, function(player, nextPlayer) {
					player.todaysAction = actions[Math.floor((Math.random()*100)) % actions.length];
					player.save(function(err, player){
						if(err){
							console.log('error saving player: ', err);
						}
						nextPlayer();
					});
				}, function(err) {
			        nextMonth();
			    });	    
			});
		}, function(err) {
		     res.redirect('/players/list');
	    });	
	});
});



