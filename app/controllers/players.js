var mongoose = require('mongoose');
var Player = mongoose.model('Player');
var auth = require('./auth');



app.get('/players/edit', auth.authorize(2, 10), function(req, res){
	res.render('players/edit', {title: 'Edit Player', util: util});
});


app.get('/players/list', auth.authorize(2, 10), function(req, res){
	Player.find().exec(function(err, players){
		res.render('players/list', { title: 'All Players', players: players });
	});
});
