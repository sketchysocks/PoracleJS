module.exports = (client) => {
	client.log.info(`Commando "${client.user.tag}" awaiting for orders!`)
	client.user.setPresence({
		activity: {
			name: 'Pokemon GO',
			type: 'PLAYING',
		},
	})
}
