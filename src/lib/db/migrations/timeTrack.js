const { log } = require('../../logger')
const config = require('config')

exports.up = async function migrationUp(knex) {

	// monsters_tracking key: removed: max_weight, max_atk, max_def, max_sta; added: ^ 4 cols above
	await knex.schema.alterTable('monsters', (table) => {
		table.integer('timer').notNullable().defaultTo(0)
	})
	log.info('timer migration applied')
}

exports.down = async function migrationDown(knex) {
	log.info(knex)
} 
