var _ = require('underscore')
  , mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , db = process.env.MONGOHQ_URL || 'mongodb://localhost/freeloader_dev'
  , config = require('../../config');
db = mongoose.connect(db);

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
