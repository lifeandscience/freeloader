var moment = require('moment')

exports.staticHelpers = {
};

exports.dynamicHelpers = {
	errorMessages: function(req, res){
		
	},
	flashMessages: function(app) {
		var html = '';
		['error', 'question', 'info', 'success'].forEach(function(type) {
			var messages = app.req.flash(type);
			if (messages.length > 0) {
				messages.forEach(function(message){
					html += '<div class="alert alert-block alert-'+(type == 'info' ? 'warning' : (type == 'question' ? 'error' : type))+' fade in"><a class="close" data-dismiss="alert" href="#">×</a>'+message+'</div>';
				});
			}
		});
		return html;
	}
  , user: function(app, minimumState){
		if(minimumState == undefined){
			minimumState = 0
		}
		if(app.req.user && app.req.user.state >= minimumState){
			return app.req.user;
		}
		return null;

		console.log(arguments);
		return app.req.user;
	}
  , authServer: function(){
		return process.env.AUTH_SERVER || 'http://app.dev:8000';
	}
/*   , moment: moment */
};
