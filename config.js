var _ = require('underscore');
var cache = {};

var defaults = {
	pointsToInvest: 1,
	startingPoints: 0,
	minimumNumberOfGroups: 2,
	minimumGroupSize: 3,
	defaultAction: 'freeload',
	walkawayEnabled: true,
	moocherPenaltyEnabled: false
};

module.exports = function(property, experimonthID, defaultValue, toBoolean){
	if(experimonthID){
		experimonthID = experimonthID.toString(); // Verify this is a string and not an ObjectID
	}else{
		experimonthID = 'none';
	}
	// console.log('checking cache for:', property, experimonthID, cache);
	if(!cache[experimonthID]){
		cache[experimonthID] = {};
	}
	var value = cache[experimonthID][property];
	// console.log('got value:', value);
	if(!value){
		// console.log('checking for config:', process.env, 'config_'+experimonthID+'_'+property, 'config_'+property);
		// Check for the value in the process config that's specific to this EM
		if(process.env['config_'+experimonthID+'_'+property]){
			value = process.env['config_'+experimonthID+'_'+property];
			// console.log('got value:', value, 'config_'+experimonthID+'_'+property);
		}else if(process.env['config_'+property]){
			// Check for the value in the process config as a global default
			value = process.env['config_'+property];
			// console.log('got value:', value, 'config_'+property);
		}
	}
	if(!value && defaultValue){
		// No value, so use the code-supplied default
		value = defaultValue;
		// console.log('sending default:', defaultValue);
	}
	// Check for absolute defaults here in this file:
	if(!value && defaults[property]){
		value = defaults[property];
		// console.log('using defaults', value);
	}
	if(value){
		// Found a value, so cache it
		cache[experimonthID][property] = value;
		// console.log('caching!');
	}
	if(toBoolean){
		return value && (_.isBoolean(value) || (_.isString(value) && value.toLowerCase() === 'true'));
	}
	return value;
};