var mongoose = require('mongoose');
var util = require('util');
var Schema = mongoose.Schema;

var PlayerSchema = new Schema({
	active: {type: Boolean, default: true},
	remote_user: String,
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


/* // MIGHT BE USEFUL STILL - FROM OLD CODE

UserSchema.pre('save', function(next){
	// If this user doesn't have a group, we need to add them to one!
	if(this.group != null){
		// They already belong to a group, so continue!
		return next();
	}

	var t = this;
	// Check how many Users exist
	User.count().exec(function(err, numUsers){
		// And note the number of Groups
		Group.count().exec(function(err, numGroups){
			// OK. we want 2 groups for 10 folks
			if(numUsers / 5 > numGroups || numGroups == 0){
				Group.create({
					users: (t.isNew ? [t] : [])
				}, function(err, group){
					if(err){
						// There was an error creating the new group!
						return next(err);
					}
					t.group = group;
					next();
				});
			}else{
				// Pick an existing group to add this user to
				Group.find().exec(function(err, groups){
					if(err || !groups || groups.length == 0){
						return next(new Error('error finding groups'));
					}
					// Pick a group at random
					// TODO: Make this smarter? Evenly balance groups? We could conceivably end up with a group of one person
					// OR maybe we'll just handle this at the change of days, when we automatically even up the groups?
					var group = groups[Math.floor(Math.random() * groups.length)];
					group.users.push(t);
					group.save(function(err){
						if(err){
							return next(err);
						}
						t.group = group;
						next();
					});
				});
			}
		});
	});
	return;
});


*/


var Player = mongoose.model('Player', PlayerSchema);
module.exports = Player;