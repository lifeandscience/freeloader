
app.get('/', function(req, res){
	res.render('index', { title: 'Freeloader', player: req.player, pointsToInvest: config.pointsToInvest });
});

app.post('/', function(req, res){
		// handle the post
		if(!req.player){
			console.log("ERROR: Unable to save user's choice because req.player is null");
			return res.redirect('/login');
		}
		if(req.body.action){
			if(req.body.action == 'last-action'){
				req.player.todaysAction = req.player.lastAction;
			}else{
				req.player.todaysAction = req.body.action;
			}
		}
		console.log("You've chosen: " + req.player.todaysAction);
		
		if(req.body.makeDefault){
			req.player.defaultAction = req.body.action;
		}
		if(req.body.action == 'invest' && req.player.balance < config.pointsToInvest){
			req.flash('error', 'You don\'t have enough points to invest. <p>You must have at least ' + config.pointsToInvest + ' points to invest. \
						You have ' + req.player.balance + ' points.</p>');
			return res.redirect('/');
		}
		
		req.player.save(function(err){
			if(err){
				req.flash('error', err);
			}else{
				req.flash('success', 'Your choice was saved successfully!');
			}
			res.redirect('/');
		});
});