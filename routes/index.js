
/*
 * GET home page.
 */
var _ = require('underscore')
  , passport = require('passport')
  , mongoose = require('mongoose')
  , User = mongoose.model('User')
  , Group = mongoose.model('Group')
  , Log = mongoose.model('Log')
  , config = require('../config');

module.exports = {
	clr: function(req, res){
		mongoose.model('User').collection.drop();
		mongoose.model('Group').collection.drop();
		mongoose.model('Log').collection.drop();

		req.session.destroy();
		res.redirect('/');
	},
	doDay: function(req, res){
		// TODO:
		// For each group:
			// For each player in the group
				// Sum up the number of investing users
			// For each player in the group
				// Add to their points an equal portion of the above sum
				// Set lastAction to todaysAction
				// Set todaysAction to null
				// Save the user
		// TODO: Should we force a rebalance of groups at this piont, in case we have a group that's too small?
		Log.create({
			type: 'simulate-day'
		});
		Group.find().populate('users').exec(function(err, groups){
			if(err){
				req.flash('error', 'Error finding groups');
				return res.redirect('/');
			}
			var numUsersToSave = 0
			  , done = function(){
					if(--numUsersToSave == 0){
						// Finished!
						console.log('done?!');
						req.flash('success', 'Day Change simulated successfully!');
						res.redirect('/');
					}
				}
			_.each(groups, function(group){
				var numInvestors = 0
				  , numUsers = 0;
				numUsersToSave += group.users.length;
				_.each(group.users, function(user){
					// If this user has selected 'invest' for today, or
					//	this user hasn't selected an action for today and their defaultAction is 'invest', or
					//	this user hasn't selected an action for today, their defaultAction is 'last-action', and their lastAction is 'invest'
					// Also, they must have enough points to invest, else their assumed to freeload
					if((
							user.todaysAction == 'invest' || 
							(!user.todaysAction && user.defaultAction == 'invest') || 
							(!user.todaysAction && user.defaultAction == 'last-action' && user.lastAction == 'invest')
						) && user.points > config.pointsToInvest){
						user.todaysAction = 'invest';
						user.points -= config.pointsToInvest
						numInvestors++;
					}else{
						user.todaysAction = 'freeload';
					}
					numUsers++;
				});
				var profit = Math.floor(((numInvestors * config.pointsToInvest) * 2) / numUsers);
				_.each(group.users, function(user){
					user.points += profit;
					user.lastAction = user.todaysAction;
					user.todaysAction = null;
					user.save(function(err, user){
						if(err){
							req.flash('error', 'Error saving user! '+err);
						}
						done();
					});
				});
			});
		});
	},
	index: function(req, res){
		res.render('index', { title: 'Express' });
	},
	post: function(req, res){
		// handle the post
		if(!req.user){
			return res.redirect('/');
		}
		if(req.body.action){
			if(req.body.action == 'last-action'){
				req.user.todaysAction = req.user.lastAction;
			}else{
				req.user.todaysAction = req.body.action;
			}
		}
		if(req.body.makeDefault){
			req.user.defaultAction = req.body.action;
		}
		if(req.user.action == 'invest' && req.user.points < config.pointsToInvest){
			req.flash('<strong>You don\'t have enough points to invest!</strong><p>You must have at least '+config.pointsToInvest+' points to invest!</p><p>Your action for today has been set to \'Freeload\'</p>');
			return res.redirect('/');
		}
		req.user.save(function(err){
			if(err){
				req.flash('error', err);
			}else{
				req.flash('success', 'Your choice was updated successfully!');
			}
			res.redirect('/');
		})
	},
	auth: {
		index: function(req, res){
			res.render('auth', {title: 'Login'});
		},
		facebook: {
			index: passport.authenticate('facebook', {scope: 'email'}),
			callback: passport.authenticate('facebook', {
				scope: 'email'
			  , failureRedirect: '/'
			  , successRedirect: '/profile'
			})
		}
	},
	profile: {
		generate: function(req, res){
			var user = new User();
			user.save(function(err, user){
				user.name = user._id.toString();
				user.save(function(err, user){
					req.flash('success', 'User generated successfully!');
					res.redirect('/profile/list');
				});
			});
		},
		list: function(req, res){
			User.find().exec(function(err, users){
				if(err || !users){
					req.flash('error', 'No users found.');
					res.redirect('/');
					return;
				}
				res.render('profile/list', { title: 'All Users', users: users || [] });
			});
		},
		get: function(req, res){
			if(!req.user){
				return res.redirect('/');
			}
			res.render('profile', {title: 'Profile', user: req.user});
		},
		getById: function(req, res){
			if(!req.params.id){
				return res.redirect('/');
			}
			User.findById(req.params.id).exec(function(err, user){
				if(err || !user){
					req.flash('error', 'User not found.');
					res.redirect('/');
					return;
				}
				res.render('profile', {title: 'Profile', user: user});
			});
		},
		post: function(req, res){
			if(!req.user){
				return res.redirect('/');
			}
			_.each(['name', 'email', 'gender', 'todaysAction', 'defaultAction'], function(key, index){
				console.log('key: ', key, req.body[key]);
				if(req.body[key]){
					req.user[key] = req.body[key];
				}
			});
			req.user.save(function(){
				req.flash('success', 'Profile updated!');
				// Handle the post
				res.redirect('/profile');
			});
		},
		postById: function(req, res){
			if(!req.params.id){
				return res.redirect('/');
			}
			User.findById(req.params.id).exec(function(err, user){
				_.each(['name', 'email', 'gender', 'todaysAction', 'defaultAction'], function(key, index){
					if(req.body[key]){
						user[key] = req.body[key];
					}
				});
				user.save(function(){
					req.flash('success', 'Profile updated!');
					// Handle the post
					res.redirect('/profile');
				});
			});
		},
		del: function(req, res){
			if(!req.user){
				return res.redirect('/');
			}
			req.user.remove(function(){
				req.session.destroy();
				res.redirect('/');
			});
		}
	},
	group: {
		list: function(req, res){
			Group.find().populate('users').exec(function(err, groups){
				if(err){
					req.flash('error', 'Error retrieving groups: '+err);
					return res.redirect('/');
				}
				res.render('group/list', {title: 'All Groups', groups: groups});
			});
		}
	}
};