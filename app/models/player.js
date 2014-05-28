var mongoose = require('mongoose');
var util = require('util');
var auth = require('../../auth');
var Schema = mongoose.Schema;

var PlayerSchema = new Schema({
	active: {type: Boolean, default: true},
	name: String,
	remote_user: String,
	experimonth: String, // An ID from the auth server of an Experimonth
	experimonthName: String,
	balance: {type: Number, default: 0},
	lastModified: {type: Date, default: function(){ return Date.now(); }},
	group: {type: Schema.ObjectId, ref: 'Group'},
	defaultAction: String,
	lastAction: String,
	todaysAction: String
});

PlayerSchema.method('notify', function(type, format, subject, text, callback){
	if(!type){
		type = 'warning';
	}
	if(!format || format.length == 0){
		format = ['web'];
	}
	if(!text){
		return callback(new Error('Can\'t notify without a message!'));
	}
	auth.doAuthServerClientRequest('POST', '/api/1/notifications', {
		type: type
	  , format: format
	  , subject: subject
	  , text: text
	  , user: this.remote_user
	}, function(err, body){
		callback(err, body);
	});
});

PlayerSchema.methods.notifyOfEarnedAmount = function(earnedAmount, newBalance, callback) {
	var title = "Today's Earned Amount";
	var text = " You have earned $" + earnedAmount.toFixed(2) + " today. Your new balance is: $" + newBalance.toFixed(2);	
	this.notify("info", ['web', 'email'], title, text, callback);
};

var Player = mongoose.model('Player', PlayerSchema);
module.exports = Player;