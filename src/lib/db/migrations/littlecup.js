const { log } = require('../../logger')

exports.up = async function migrationUp(knex) {
	await knex.schema.alterTable('monsters', (table) => {
		table.integer('little_league_ranking').notNullable().defaultTo(4096)
		table.integer('little_league_ranking_min_cp').notNullable().defaultTo(4096)
		table.dropUnique(null, 'monsters_tracking')
		table.unique([
			'id', 'pokemon_id', 'min_iv', 'max_iv', 'min_level', 'max_level', 'atk', 'def', 'sta', 'form', 'gender',
			'great_league_ranking', 'ultra_league_ranking', 'timer', 'little_league_ranking',
		], 'monsters_tracking')
	})
	log.info('Little Migration Applied')
}

exports.down = async function migrationDown(knex) {
	log.info(knex)
}
