var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var GroupSchema = new Schema({
	players: [ {type: Schema.ObjectId, ref: 'Player'} ]
});

var Group = mongoose.model('Group', GroupSchema);
module.exports = Group;