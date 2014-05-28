var async = require('async')
  , util = require('util')
  , sockets = [];

module.exports = {

  checkAdmin: function(req, res, next){
		if(req.loggedIn && req.user && req.user.role == 10){
			// Check if they're an admin!
			next();
			return;
		}
		req.flash('error', 'You are not authorized to view that resource!');
		res.redirect('/');
	}
  , addSocket: function(socket){
		sockets.push(socket);
	}
  , removeSocket: function(socket){
		var idx = sockets.indexOf(socket);
		if(idx != -1){
			sockets.splice(idx, 1);
		}
	}
  , getSockets: function(){
		return sockets;
	}
};