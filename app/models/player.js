var mongoose = require('mongoose');
var util = require('util');
var auth = require('../../auth');
var config = require('../../config');
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
	lastTake: {type: Number, default: 0},
	lastAction: String,
	todaysAction: String
});

PlayerSchema.method('notify', function(type, format, subject, text, callback){
	if(!type){
		type = 'warning';
	}
	if(!format || format.length === 0){
		format = ['web'];
	}
	if(!text){
		return callback(new Error('Can\'t notify without a message!'));
	}
	auth.doAuthServerClientRequest('POST', '/api/1/notifications', {
		type: type,
		format: format,
		subject: subject,
		text: text,
		user: this.remote_user
	}, function(err, body){
		callback(err, body);
	});
});


PlayerSchema.methods.notifyOfFreeload = function(amountEarned, callback) {
	var url = process.env.BASEURL + '/play';
	var title = 'Today You Freeloaded';
	var text = ' You chose to freeload today. You earned $' + amountEarned.toFixed(2) + ' and your new balance is $' + this.balance.toFixed(2)+'. Make a decision for today at\n\n'+url;
	this.notify("info", ['web', 'email'], title, text, callback);
};
PlayerSchema.methods.notifyOfInvestment = function(amountEarned, callback) {
	var url = process.env.BASEURL + '/play';
	var title = 'Today You Invested';
	var text = ' You chose to invest today. You earned $' + amountEarned.toFixed(2) + ' and your new balance is $' + this.balance.toFixed(2)+'. Make a decision for today at\n\n'+url;
	this.notify("info", ['web', 'email'], title, text, callback);
};
PlayerSchema.methods.notifyOfNewGroupDueToAbandonment = function(callback) {
	var url = process.env.BASEURL + '/play';
	var title = 'You were assigned to a new group because your old group was disbanded.';
	var text = ' The group you were in grew too small, so your group was disbanded. You are now in a group identified as ' + this.group + '. Make a decision for today at\n\n'+url;
	this.notify("info", ['web', 'email'], title, text, callback);
};
PlayerSchema.methods.notifyOfNewGroupDueToWalkaway = function(callback) {
	var url = process.env.BASEURL + '/play';
	var title = 'You were assigned to a new group because you walked away from your old group.';
	var text = ' You walked away. So, you were placed in a new group identified as ' + this.group + '. Make a decision for today at\n\n'+url;
	this.notify("info", ['web', 'email'], title, text, callback);
};
PlayerSchema.methods.notifyOfNewGroupDueToNewbie = function(callback) {
	var url = process.env.BASEURL + '/play';
	var title = 'You have been assigned to a group. Play now!';
	var text = ' You were placed in a new group identified as ' + this.group + '. Make a decision for today at\n\n'+url;
	this.notify("info", ['web', 'email'], title, text, callback);
};
PlayerSchema.methods.notifyOfDesertion = function(callback) {
	var title = 'You have left your spot in Freeloader';
	var text = ' You were unenrolled from Freeloader. Your balance has been reset and you\'ll no longer be prompted to play unless you re-enroll.';
	this.notify("info", ['web', 'email'], title, text, callback);
};
PlayerSchema.methods.notifyOfMooching = function(callback) {
	var title = 'You and all the members of your group chose to Freeload.';
	var text = ' Because you and all of your peers chose to Freeload, your group has been disbanded, you\'ve been un-enrolled from this Experimonth, and your balance has been reset to zero. You\'ll no longer be prompted to play unless you re-enroll.';
	this.notify("info", ['web', 'email'], title, text, callback);
};
// notifyOfFreeload(amountEarned, callback)
// notifyOfInvestment(amountEarned, callback)
// notifyOfNewGroupDueToAbandonment(callback)
// notifyOfNewGroupDueToWalkaway(callback)
// notifyOfNewGroupDueToNewbie(callback)
// notifyOfDesertion(callback)
// notifyOfMooching(callback)

PlayerSchema.methods.notifyOfEarnedAmount = function(earnedAmount, newBalance, callback) {
	var title = "Today's Earned Amount";
	var text = " You have earned $" + earnedAmount.toFixed(2) + " today. Your new balance is: $" + newBalance.toFixed(2);	
	this.notify("info", ['web', 'email'], title, text, callback);
};

PlayerSchema.methods.getDefaultAction = function(callback){
	var t = this;
	var conditionID = config('defaultChoiceProfileQuestion', this.experimonth, null);
	if(!conditionID){
		return callback(config('defaultAction', this.experimonth), false);
	}
	// console.log('asking auth server for default based on ', conditionID, this.remote_user);
	return auth.doAuthServerClientRequest('GET', '/api/1/profile/answerForUserAndQuestion/'+this.remote_user+'/'+conditionID, null, function(err, data){
		// console.log('result: ', err, answer);
		var changeable = true;
		var value = data && data.value ? data.value : null;
		if(value && ['keep', 'invest'].indexOf(value.toLowerCase()) !== -1){
			value = t.convertAction(value.toLowerCase(), true);
		}else{
			value = null;
		}
		if(!value){
			// The value wasn't found or isn't a valid choice
			value = config('defaultAction', this.experimonth);
			changeable = false;
		}
		callback(value, changeable);
	});
};

PlayerSchema.methods.convertAction = function(action, inwards){
	if(action){
		if(inwards){
			if(action == 'leave'){
				return 'walkaway';
			}
			if(action == 'keep'){
				return 'freeload';
			}
			if(action == 'invest' || action == 'freeload'){
				return action;
			}
		}else{
			if(action == 'walkaway'){
				return 'leave';
			}
			// if(action == 'freeload'){
			// 	return 'keep';
			// }
			if(action == 'invest' || action == 'freeload'){
				return action;
			}
		}
	}
	return '';
}

PlayerSchema.methods.setAction = function(action){
	action = action ? action.toLowerCase() : '';
	if(action == 'freeload' || action == 'invest'){
		this.todaysAction = action;
	}else if(action == 'keep'){
		this.todaysAction = 'freeload'
	}else if(config('walkawayEnabled', this.remote_user, false, true) && action == 'leave'){
		this.todaysAction = 'walkaway';
	}else{
		this.todaysAction = null;
	}
	return;
}

var Player = mongoose.model('Player', PlayerSchema);
module.exports = Player;