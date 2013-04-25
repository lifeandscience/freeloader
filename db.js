var mongoose = require('mongoose');

// Database
var db = process.env.MONGOHQ_URL || 'mongodb://localhost/freeloader_dev'
module.exports = mongoose.connect(db);