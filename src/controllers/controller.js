/* eslint class-methods-use-this: ["error", { "exceptMethods": ["getGeocoder"] }] */

const inside = require('point-in-polygon')
const path = require('path')
const NodeGeocoder = require('node-geocoder')

const pcache = require('flat-cache')

const geoCache = pcache.load('.geoCache', path.resolve(`${__dirname}../../../`))


// const ivColorData = config.discord.iv_colors
// const baseStats = require('../util/base_stats')
// const cpMultipliers = require('../util/cp-multipliers')
const emojiFlags = require('emoji-flags')

const log = require('../lib/logger')


// setup geocoding cache

class Controller {
	constructor(db, config, dts, geofence, monsterData, discordCache) {
		this.db = db
		this.config = config
		this.log = log
		this.dts = dts
		this.geofence = geofence
		this.monsterData = monsterData
		this.discordCache = discordCache
		this.utilData = require(path.join(__dirname, '../util/util'))
		this.mustache = require('handlebars')
	}

	getDistance(start, end) {
		if (typeof (Number.prototype.toRad) === 'undefined') {
			Number.prototype.toRad = function () {
				return this * Math.PI / 180
			}
		}
		const earthRadius = 6371 * 1000 // m
		let lat1 = parseFloat(start.lat)
		let lat2 = parseFloat(end.lat)
		const lon1 = parseFloat(start.lon)
		const lon2 = parseFloat(end.lon)

		const dLat = (lat2 - lat1).toRad()
		const dLon = (lon2 - lon1).toRad()
		lat1 = lat1.toRad()
		lat2 = lat2.toRad()

		const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
				+ Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2)
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
		const d = earthRadius * c
		return Math.ceil(d)
	}

	getGeocoder() {
		switch (this.config.geocoding.provider.toLowerCase()) {
			case 'google': {
				return NodeGeocoder({
					provider: 'google',
					httpAdapter: 'https',
					apiKey: this.config.geocoding.geocodingKey[Math.floor(Math.random() * this.config.geocoding.geocodingKey.length)],
				})
			}
			default:
			{
				return NodeGeocoder({
					provider: 'openstreetmap',
					formatterPattern: this.config.locale.addressformat,
				})
			}
		}
	}

	getDiscordCache(id) {
		let ch = this.discordCache.get(id)
		if (ch === undefined) {
			this.discordCache.set(id, {count: 1})
			ch = {count: 1}
		}
		return ch
	}

	addDiscordCache(id) {
		let ch = this.discordCache.get(id)
		if (ch === undefined) {
			this.discordCache.set(id, {count: 1})
			ch = {count: 1}
		}
		const ttl = this.discordCache.getTtl(id)
		this.discordCache.set(id, {count: ch.count + 1}, ttl)
		return true
	}

	async geolocate(locationString) {
		try {
			const geocoder = this.getGeocoder()
			return await geocoder.geocode(locationString)
		} catch (err) {
			throw { source: 'geolocate', err }
		}
	}

	async getAddress(locationObject) {
		const cacheKey = `${String(+locationObject.lat.toFixed(3))}-${String(+locationObject.lon.toFixed(3))}`
		let result = geoCache.getKey(cacheKey)
		if (result) return result

		try {
			const geocoder = this.getGeocoder()
			result = (await geocoder.reverse(locationObject))[0]
			const flag = emojiFlags[`${result.countryCode}`]
			const addressDts = this.mustache.compile(this.config.locale.addressFormat)
			result.addr = addressDts(result)
			result.flag = flag ? flag.emoji : ''
			geoCache.setKey(cacheKey, result)
			geoCache.save(true)
			return result
		} catch (err) {
			throw { source: 'getAddress', error: err }
		}
	}

	async pointInArea(point) {
		if (!this.geofence.length) return []
		const confAreas = this.geofence.map(area => area.name.toLowerCase())
		const matchAreas = []

		for (const area of confAreas) {
			const areaObj = this.geofence.find(p => p.name.toLowerCase() === area)
			if (inside(point, areaObj.path)) matchAreas.push(area)
		}
		return matchAreas
	}


	// database methods below

	async selectOneQuery(table, conditions) {
		try {
			const result = this.db.select('*').from(table).where(conditions).first()
			return this.returnByDatabaseType(result)
		} catch (err) {
			throw { source: 'slectOneQuery', error: err }
		}
	}

	async updateQuery(table, values, conditions) {
		try {
			return this.db(table).update(values).where(conditions)
		} catch (err) {
			throw { source: 'updateQuery', error: err }
		}
	}

	async countQuery(table, conditions) {
		try {
			const result = await this.db.select().from(table).where(conditions).count()
				.first()
			return +(Object.values(result)[0])
		} catch (err) {
			throw { source: 'countQuery', error: err }
		}
	}

	async insertQuery(table, values) {
		try {
			return await this.db.insert(values).into(table)
		} catch (err) {
			throw { source: 'insertQuery', error: err }
		}
	}

	async deleteWhereInQuery(table, id, values, valuesColumn) {
		try {
			return this.db.whereIn(valuesColumn, values).where({ id }).from(table).del()
		} catch (err) {
			throw { source: 'deleteWhereInQuery unhappy', error: err }
		}
	}

	async insertOrUpdateQuery(table, values) {
		try {
			switch (this.config.database.client) {
				case 'pg': {
					const firstData = values[0] ? values[0] : values
					const query = `${this.db(table).insert(values).toQuery()} ON CONFLICT ON CONSTRAINT ${table}_tracking DO UPDATE SET ${
						Object.keys(firstData).map(field => `${field}=EXCLUDED.${field}`).join(', ')}`
					const result = await this.db.raw(query)
					return result.rowCount ? [0] : []
				}
				case 'mysql': {
					const firstData = values[0] ? values[0] : values
					const query = `${this.db(table).insert(values).toQuery()} ON DUPLICATE KEY UPDATE ${
						Object.keys(firstData).map(field => `\`${field}\`=VALUES(\`${field}\`)`).join(', ')}`
					const result = await this.db.raw(query)
					return result
				}
				default: {
					const constraints = {
						humans: 'id',
						monsters: 'monsters.id, monsters.pokemon_id, monsters.min_iv, monsters.max_iv, monsters.min_level, monsters.max_level, monsters.atk, monsters.def, monsters.sta, monsters.min_weight, monsters.max_weight, monsters.form, monsters.max_atk, monsters.max_def, monsters.max_sta, monsters.gender',
						raid: 'raid.id, raid.pokemon_id, raid.exclusive, raid.level, raid.team',
						egg: 'egg.id, egg.team, egg.exclusive, egg.level',
						quest: 'quest.id, quest.reward_type, quest.reward',
					}
					const firstData = values[0] ? values[0] : values
					const insertValues = values.map(o => `(${Object.values(o).join(', ')})`).join()
					const query = `INSERT INTO ${table} (${Object.keys(firstData)}) VALUES ${insertValues} ON CONFLICT (${constraints[table]}) DO UPDATE SET ${
						Object.keys(firstData).map(field => `${field}=EXCLUDED.${field}`).join(', ')}`
					const result = await this.db.raw(query)
					return this.returnByDatabaseType(result)
				}
			}
		} catch (err) {
			throw err
			// throw { source: 'insertOrUpdateQuery', error: err }
		}
	}


	async deleteQuery(table, values) {
		try {
			return await this.db(table).where(values).del()
		} catch (err) {
			throw { source: 'deleteQuery', error: err }
		}
	}

	returnByDatabaseType (data) {
		switch (this.config.database.client) {
			case 'pg': {
				return data.rows
			}
			case 'mysql': {
				return data[0]
			}
			default:{
				return data
			}
		}
	}
	

	findIvColor(iv) {
		// it must be perfect if none of the ifs kick in
		// orange / legendary
		let colorIdx = 5

		if (iv < 25) colorIdx = 0 // gray / trash / missing
		else if (iv < 50) colorIdx = 1 // white / common
		else if (iv < 82) colorIdx = 2 // green / uncommon
		else if (iv < 90) colorIdx = 3 // blue / rare
		else if (iv < 100) colorIdx = 4 // purple epic

		return parseInt(this.config.discord.ivColors[colorIdx].replace(/^#/, ''), 16)
	}
}


module.exports = Controller