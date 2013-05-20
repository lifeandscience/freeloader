var mongoose = require('mongoose');
var util = require('util');
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

PlayerSchema.methods.getAccountBalance = function() {
	return "Your account balance is: " + this.balance;
};

var Player = mongoose.model('Player', PlayerSchema);
module.exports = Player;