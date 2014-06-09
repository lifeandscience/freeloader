module.exports = {
	pointsToInvest: process.env.POINTS_TO_INVEST || 1,
	startingPoints: process.env.STARTING_POINTS || 0,
	minimumNumberOfGroups: process.env.MINIMUM_NUMBER_OF_GROUPS || 2,
	minimumGroupSize: process.env.MINIMUM_GROUP_SIZE || 3,
	defaultAction: 'freeload'
}