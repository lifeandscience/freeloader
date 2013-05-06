var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var auth = require('../../auth');

var GroupSchema = new Schema({
	experimonth: String, // An ID from the auth server of an Experimonth
	num_players: { type: Number, default: 0 }
});

GroupSchema.statics.startGroup = function(req, cb) {
	auth.doAuthServerClientRequest('GET', '/api/1/experimonths/activeByKind/'+auth.clientID, null, function(err, experimonths){
	
		console.log(experimonths);
	
	});
};


var Group = mongoose.model('Group', GroupSchema);
module.exports = Group;