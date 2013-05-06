var mongoose = require('mongoose');
var Player = mongoose.model('Player');
var Group = mongoose.model('Group');
var auth = require('./auth');
var _ = require('underscore');

app.get('/nightly/:experimonth_id', auth.authorize(2, 10), function(req, res){
	
	if(!req.param('experimonth_id')){
		req.flash('error', 'You must specify an experimonth.');
		res.redirect('back');
		return;
	}
		
	//CONSTANTS
	var MAX_PLAYERS_PER_GROUP = 10;
	var AMOUNT_TO_INVEST = 1; //amount given to each user each day.
	var DEFAULT_ACTION_IF_NOT_SET = "freeload";
	
	
/* ============ STEP 1: Perform Group Assignments for new users or users leaving groups =================================== */	
	
	//Get a list of all of the existing groups
	Group.find().exec(function(err, groups){
	
		var num_groups = 0;
		_.each(groups, function(group) {
			num_groups++;
		});
		console.log("NUM GROUPS IS: " + num_groups);

	
		Player.find().populate('group').exec(function(err, players){
		
			var num_players = 0;
			
			var new_players = []; //Players added today, not assigned a group yet.
			var players_leaving_group = [];
			_.each(players, function(player) {
				num_players++;
				// Find all new players without a group.
				if(!player.group) {
					new_players.push(player);
				}
				// Find all existing players who are leaving their group.
				if(player.group && player.todaysAction == "leavegroup") {
					players_leaving_group.push(player);
				}
			});
			console.log("NUM PLAYERS IS: " + num_players);
			
			// Compute the total number of groups we need.
			var num_groups_needed = Math.ceil(num_players / MAX_PLAYERS_PER_GROUP);


			//Create more group(s) if needed
			if(num_groups_needed > num_groups) {
				for(var x=num_groups; x < num_groups_needed; x++) {
					var group = new Group();
					group.experimonth = req.params.experimonth_id;
					group.save(function(err, group){
						if(err){
							console.log('error saving group: ', err);
							return next(err);
						}
					});	
					//Manually add our group the the groups array
					groups.push(group);
					num_groups++;
				}
			}
			
			console.log("NUM PLAYERS NEEDING GROUP: " + new_players.length);
			console.log("NUM PLAYERS LEAVING GROUPS: " + players_leaving_group.length);
			
			//TODO: Seems like we could get stuck here if we only have 1 group and a player tries to leave!!!!!!!!!!!!!!!!!!!!!!!!
			//TODO: DEADLOCK - 2 groups where 1 is full and the other group has 2 members who want to leave.
			while(new_players.length > 0 || players_leaving_group.length > 0) {
				
				_.each(groups, function(group) {
				//	console.log("NUM PLAYERS *TRYING* to leave groups: " + players_leaving_group.length);
					if(group.num_players < MAX_PLAYERS_PER_GROUP) {
						//Try to add a new player to this group
						if(new_players.length > 0) {
							var p = new_players.pop();
							p.group = group;
							group.num_players++;
						} else if(players_leaving_group.length > 0) {
						
							//No new players, try an existing player
							var p = players_leaving_group.pop();
							//Check to make sure this player isn't trying to leave this group.
							if(p.group.equals(group)) {
								//Uh oh, push this player back onto the array since this is the same group
								console.log("Uh oh, push this player back onto the array since this is the same group");
								players_leaving_group.push(p);
							} else {
								//We're good. Update player counts and associate new group to player
								p.group.num_players--; //user leaves old group
								p.group = group;
								group.num_players++; //user joins new group
							}
						}
					}
					
					//Save group (TODO: handle errors)
					group.save();
					
					//Save the player if neccessary
					p && p.save(function(err, group){
						if(err){
							console.log('error saving player: ', err);
						}
					});
					
				});
				
			}
			
			console.log(groups);
			
			
/* ============ STEP 2: Calculate the totals for the day and add this to player balances =================================== */
		
			_.each(groups, function(group) {
			
				var eligiblePlayers = [];
				var dailyTotal = 0;
				
				_.each(players, function(player) {
					//Only focus on players that are a member of this group.
					console.log(player.group);
					console.log(group);
					if((player.group).equals(group)) {	//TODO: THIS IS BROKEN WHEN MORE THAN 1 GROUP!!
						
						//If the player doesnt have an action for today, check for a default or else set to freeload.
						if(!player.todaysAction) {
							player.todaysAction = player.defaultAction ? player.defaultAction : DEFAULT_ACTION_IF_NOT_SET;
						}
						if(player.todaysAction == "invest") {
							dailyTotal += AMOUNT_TO_INVEST;
							eligiblePlayers.push(player);
						} 
						else if(player.todaysAction == "freeload") {
							eligiblePlayers.push(player);
							player.balance += AMOUNT_TO_INVEST; //freeloaders bank this amount.
						}
					}
				});
				
				//Now that all group members have been processed, double the total and compute all eligible players' shares.
				dailyTotal = dailyTotal * 2;
				var earnedAmount = dailyTotal / eligiblePlayers.length;
				
				//Loop players again to update their balance w/ the earned amount from investing
				_.each(players, function(player) {
					//Only focus on players that are a member of this group.
					if(player.group.equals(group)) {
						player.balance += earnedAmount;
						//TODO: Log this event!!
						player.lastAction = player.todaysAction;
						player.todaysAction = null;
						player.save(); //TODO: handle error case
					}
				});
				
			
			});
		
		
			// FINISH!
			
			res.redirect('/');
			
			
			
		}); //end Player.find();

	
	}); //end Group.find();



});

/*


	(A) Put users without a group into a new group.
x		1) Find all new players without a group.
x		2) Find all current players with todaysAction=leavegroup (Take note of their current group)
x		3) Compute total number of groups (ceiling[# players / 10])
		4) Distribute all players from #1/#2 into groups. 
			- make sure not to put player into group he was just in.
			- Need to create a new group if the results from #3 > current_num_groups
			- TODO: Probably need to spend some time thinking about this algorithm.
			- Minimum group size = 3 players
		5) Check all groups again to make sure no groups have < 3 members. If they do, need to reassign these users and delete group.
		6) Notify users that they have been (re)assigned to a new group.
		7) TODO: Push some sort of events to the Auth Server and log?
	
	(B) For each group, loop through all players and look at their todayAction. 
		Keep count of total group $ invested. Also, keep temporary array of eligiblePlayers
x		0) If player.todaysAction=null, check for defaultAction. If no default, set todaysAction=freeload (TODO: is this correct?).
x		1) If they invest, add $1 to the group dailyTally. Push player to eligiblePlayers.
x		2) If they freeload, push player to eligiblePlayers and increase balance by $1.
x		3) If they leave, do nothing. (costs $1 to leave)
x		4) After all players have been processed, Take the total $ in dailyTally and double it.
x		5) Loop all players again and Take dailyTally/eligiblePlayers.length and add this money to each eligiblePlayer's balance.
		6) Log {Player/ExpID/GroupID/Date/Action/NewBalance} so we can track this stuff historically.
x		7) Copy player.todaysAction to player.lastAction.
x		8) Reset player.todaysAction => null
x		9) Save player !
		
*/