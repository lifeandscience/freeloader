var mongoose = require('mongoose');
var Player = mongoose.model('Player');

app.get('/', function(req, res){
	Player.count(function(err, numPlayers){
		res.render('index', { title: 'Freeloader', player: req.player, numPlayers: numPlayers, pointsToInvest: config.pointsToInvest });
	});
});

app.post('/', function(req, res){
		// handle the post
		if(!req.player){
			console.log("ERROR: Unable to save user's choice because req.player is null");
			return res.redirect('/login');
		}

		req.player.todaysAction = req.body.action || null;
		req.player.defaultAction = req.body.makeDefault ? req.body.action : null;
		
		if(req.body.action == 'invest' && req.player.balance < config.pointsToInvest){
			req.flash('error', 'You don\'t have enough points to invest. <p>You must have at least ' + config.pointsToInvest + ' points to invest. \
						You have ' + req.player.balance + ' points.</p>');
			return res.redirect('/');
		}
		
		req.player.save(function(err){
			if(err){
				req.flash('error', err);
			} else {
				req.flash('success', 'Your choice was saved successfully!');
			}
			res.redirect('/');
		});
});