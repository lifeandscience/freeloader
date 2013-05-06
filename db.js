var mongoose = require('mongoose');

// Database
var db = process.env.MONGOHQ_URL || 'mongodb://localhost/freeloader'
module.exports = mongoose.connect(db);