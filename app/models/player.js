var mongoose = require('mongoose');
var util = require('util');
var auth = require('../../auth');
var Schema = mongoose.Schema;

var PlayerSchema = new Schema({
	active: {type: Boolean, default: true},
	remote_user: String,
	experimonth: String, // An ID from the auth server of an Experimonth
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
		return callback(new Error('Can\t notify without a message!'));
	}
	auth.doAuthServerClientRequest('POST', '/api/1/notifications', {
		type: type
	  , format: format
	  , subject: subject
	  , text: text
	  , user: this.remote_user
	}, function(err, body){
		// TODO: Do something with the result? Or maybe not?
		console.log('did notification! err: ', err);
		console.log('body: ', body);
		callback(err, body);
	});
});

PlayerSchema.methods.notifyOfEarnedAmount = function(earnedAmount, newBalance, callback) {
	var title = "Today's Earned Amount";
	var text = " You have earned $" + earnedAmount + " today. Your new balance is: $" + newBalance;	
	this.notify("info", ['web', 'email'], title, text, callback);
};

PlayerSchema.methods.getAccountBalance = function() {
	return "Your account balance is: " + this.balance;
};

var Player = mongoose.model('Player', PlayerSchema);
module.exports = Player;