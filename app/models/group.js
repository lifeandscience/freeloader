var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var GroupSchema = new Schema({
	experimonth: String, // An ID from the auth server of an Experimonth
	num_players: { type: Number, default: 0 }
});

var Group = mongoose.model('Group', GroupSchema);
module.exports = Group;