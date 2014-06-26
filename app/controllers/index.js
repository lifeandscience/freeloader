var mongoose = require('mongoose');
var auth = require('./auth');
var Group = mongoose.model('Group');
var Player = mongoose.model('Player');

var appTitle = "Freeloader";

app.get('/', auth.authorize(), function(req, res){
	if(req.user && req.user.active){
		if(req.user.experimonths){
			for(var i = 0; i < req.user.experimonths.length; i++){
				if(req.user.experimonths[i].kind.toString() == auth.clientID){
					// Found that the user is in an Experimonth with this Kind
					return res.redirect('/play');
				}
			}
		}
	}
	res.render('index', { title: appTitle });
});

app.get('/faq', function(req, res){
	res.render('faq', { title: appTitle });
});

app.post('/setExperimonth', function(req, res){
	if(req.body && req.body.experimonth) {
		req.session.experimonth.current = req.body.experimonth;
	}
	res.redirect('/');	
});

app.get('/error', function(req, res){
	var userId = null;
	if(req && req.session) {
		userId = req.user ? req.user._id : null;
	}
	res.render('index', { title: appTitle, remote_user: userId, hasError: true });
});

app.get('/reset', function(req, res){
	Group.remove(function(err){
		if(err){
			req.flash('error', 'Error removing all groups!');
			res.redirect('/');
			return;
		}
		Player.remove(function(err){
			if(err){
				req.flash('error', 'Error removing all players!');
				res.redirect('/');
				return;
			}
			req.flash('error', 'Successfully reset!');
			res.redirect('/');
		});
	});
});
