var mongoose = require('mongoose');
var Player = mongoose.model('Player');
var auth = require('./auth');
var _ = require('underscore');


app.get('/players/edit', auth.authorize(2, 10), function(req, res){
	res.render('players/edit', {title: 'Edit Player', util: util});
});


app.get('/players/list', auth.authorize(2, 10), function(req, res){
	Player.find().exec(function(err, players){
	console.log(players);
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
	var actions = [ "invest", "freeload", "freeload" ]; //  "leavegroup"
	for(x=0; x < req.params.num_players; x++) {
		var initial_balance = Math.floor((Math.random()*30));	//Pick a random number of points between 0-30
		var player = new Player();
		player.balance = initial_balance;
		player.todaysAction = actions[initial_balance % 3];
		player.save(function(err, player){
			if(err){
				console.log('error saving player: ', err);
				return next(err);
			}
		});
		initial_balance ++;
	}
	res.redirect('/players/list');
	
});

app.get('/players/simulate/deleteall', auth.authorize(2, 10), function(req, res){
	Player.find().exec(function(err, players){
		_.each(players, function(player) {
			
			if(player && player.remote_user == null) {
				//delete this simulated player
				player.remove(function(err){
					if(err){
						req.flash('error', 'Error while deleting player: ' + err);
					}
				});
			}
		});
	});
	res.redirect('/players/list');

});

//This re-runs the random decision/action picker and assigns a new todaysAction for each player.
app.get('/players/simulate/newactions', auth.authorize(2, 10), function(req, res){
	Player.find().exec(function(err, players){
		var actions = [ "invest", "freeload", "freeload" ]; //  "leavegroup"
		_.each(players, function(player) {
			player.todaysAction = actions[Math.floor((Math.random()*100)) % 3];
			player.save(function(err, player){
				if(err){
					console.log('error saving player: ', err);
					return next(err);
				}
			});
		});
	});
	res.redirect('/players/list');

});