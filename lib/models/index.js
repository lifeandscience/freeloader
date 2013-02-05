var _ = require('underscore')
  , mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , db = process.env.MONGOHQ_URL || 'mongodb://localhost/freeloader_dev'
  , config = require('../../config');
db = mongoose.connect(db);

var CSS_COLOR_NAMES = ["AliceBlue","AntiqueWhite","Aqua","Aquamarine","Azure","Beige","Bisque","Black","BlanchedAlmond","Blue","BlueViolet","Brown","BurlyWood","CadetBlue","Chartreuse","Chocolate","Coral","CornflowerBlue","Cornsilk","Crimson","Cyan","DarkBlue","DarkCyan","DarkGoldenRod","DarkGray","DarkGrey","DarkGreen","DarkKhaki","DarkMagenta","DarkOliveGreen","Darkorange","DarkOrchid","DarkRed","DarkSalmon","DarkSeaGreen","DarkSlateBlue","DarkSlateGray","DarkSlateGrey","DarkTurquoise","DarkViolet","DeepPink","DeepSkyBlue","DimGray","DimGrey","DodgerBlue","FireBrick","FloralWhite","ForestGreen","Fuchsia","Gainsboro","GhostWhite","Gold","GoldenRod","Gray","Grey","Green","GreenYellow","HoneyDew","HotPink","IndianRed","Indigo","Ivory","Khaki","Lavender","LavenderBlush","LawnGreen","LemonChiffon","LightBlue","LightCoral","LightCyan","LightGoldenRodYellow","LightGray","LightGrey","LightGreen","LightPink","LightSalmon","LightSeaGreen","LightSkyBlue","LightSlateGray","LightSlateGrey","LightSteelBlue","LightYellow","Lime","LimeGreen","Linen","Magenta","Maroon","MediumAquaMarine","MediumBlue","MediumOrchid","MediumPurple","MediumSeaGreen","MediumSlateBlue","MediumSpringGreen","MediumTurquoise","MediumVioletRed","MidnightBlue","MintCream","MistyRose","Moccasin","NavajoWhite","Navy","OldLace","Olive","OliveDrab","Orange","OrangeRed","Orchid","PaleGoldenRod","PaleGreen","PaleTurquoise","PaleVioletRed","PapayaWhip","PeachPuff","Peru","Pink","Plum","PowderBlue","Purple","Red","RosyBrown","RoyalBlue","SaddleBrown","Salmon","SandyBrown","SeaGreen","SeaShell","Sienna","Silver","SkyBlue","SlateBlue","SlateGray","SlateGrey","Snow","SpringGreen","SteelBlue","Tan","Teal","Thistle","Tomato","Turquoise","Violet","Wheat","White","WhiteSmoke","Yellow","YellowGreen"];

var LogSchema = new Schema({
	model: String
  , type: String
  , changed: Schema.Types.Mixed
  , id: Schema.ObjectId
  , data: Schema.Types.Mixed
  , timestamp: {type: Date, default: function(){
		return new Date();
	}}
});
var Log = mongoose.model('Log', LogSchema);

var logTransactionsOnSchema = function(schema){
	schema.pre('save', function (next) {
		this._changed = this.modifiedPaths();
		this._isNew = this.isNew;
		next();
	});
	
	schema.post('save', function() {
		var model = this.model(this.constructor.modelName);
		if(this._changed) {
			(new Log({
				modelName: this.constructor.modelName
			  , type: 'update'
			  , changed: this._changed
			  , id: this._id
			  , data: this.toObject()
			})).save();
			delete this._changed;
		}
		if (this._isNew) {
			(new Log({
				modelName: this.constructor.modelName
			  , type: 'create'
			  , id: this._id
			  , data: this.toObject()
			})).save();
			delete this._isNew;
		}
	});
	
	schema.post('remove', function() {
		(new Log({
			modelName: this.constructor.modelName
		  , type: 'delete'
		  , id: this._id
		  , data: this.toObject()
		})).save();
	});
	
	return schema;
};

// Users:

var UserSchema = logTransactionsOnSchema(new Schema({
	name: {type: String}
  , email: {type: String}
  , gender: {type: String}
  , defaultAction: {type: String, default: 'invest'}
  , todaysAction: {type: String}
  , lastAction: {type: String}
  , points: {type: Number, default: config.startingPoints}
	// TODO: Add a group relationship
	// Make default a function to randomly assign a new user to a group
  , group: {type: Schema.ObjectId, ref: 'Group'}
	
  , '_fbid': {type: String}//,
//	'_twid': {type: String}
}));

var GroupSchema = logTransactionsOnSchema(new Schema({
	users: [{type: Schema.ObjectId, ref: 'User'}]
  , color: {type: String, default: function(){
		var idx = Math.floor(Math.random() * CSS_COLOR_NAMES.length);
		return CSS_COLOR_NAMES[idx];
	}}
}));

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

UserSchema.statics.findOrCreateFromFacebook = function(profile, callback){
	var User = mongoose.model('User');
	User.find({'_fbid': profile.id}).exec(function(err, result){
		if(!err && result && result.length > 0){
			// Found!
			return callback(null, result[0]);
		}
		// Create!
		User.create({
			'_fbid': profile.id
		  , name: profile.displayName
		  , gender: profile.gender
		}, function(err, user){
			if(err){
				return callback(err, null);
			}
			return callback(null, user);
		});
	});
}

var User = mongoose.model('User', UserSchema)
  , Group = mongoose.model('Group', GroupSchema);
module.exports = {
	User: User
  , Group: Group
}