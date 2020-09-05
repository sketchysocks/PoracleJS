const axios = require('axios')
const { Sema } = require('async-sema')

const sema = new Sema(1)
let availablePokemon = undefined

function resolvePokemonIcon(pokemonId, pokemonForm = 0, evolutionId = 0, female = false, costumeId = 0, shiny = false) {
    const pokeId = pokemonId.padStart(3, '0')
    const costumeSuffix = costumeId ? `_${costumeId}` : ''
    const shinySuffix = shiny ? '_shiny' : ''
    if (evolutionId) {
        let pokemonIdString = `${pokeId}_v${evolutionId}${costumeSuffix}${shinySuffix}`
        if (availablePokemon.has(pokemonIdString)) return pokemonIdString
        pokemonIdString = `${pokeId}_v${evolutionId}${shinySuffix}`
        if (availablePokemon.has(pokemonIdString)) return pokemonIdString
    }
    const femaleSuffix = female ? '_female' : ''
    if (pokemonForm) {
        let pokemonIdString = `${pokeId}_${pokemonForm}${femaleSuffix}${costumeSuffix}${shinySuffix}`
        if (availablePokemon.has(pokemonIdString)) return pokemonIdString
        pokemonIdString = `${pokeId}_${pokemonForm}${costumeSuffix}${shinySuffix}`
        if (availablePokemon.has(pokemonIdString)) return pokemonIdString
        pokemonIdString = `${pokeId}_${pokemonForm}${femaleSuffix}${shinySuffix}`
        if (availablePokemon.has(pokemonIdString)) return pokemonIdString
        pokemonIdString = `${pokeId}_${pokemonForm}${shinySuffix}`
        if (availablePokemon.has(pokemonIdString)) return pokemonIdString
    }
    let pokemonIdString = `${pokeId}_00${femaleSuffix}${costumeSuffix}${shinySuffix}`
    if (availablePokemon.has(pokemonIdString)) return pokemonIdString
    pokemonIdString = `${pokeId}_00${costumeSuffix}${shinySuffix}`
    if (availablePokemon.has(pokemonIdString)) return pokemonIdString
    pokemonIdString = `${pokeId}_00${femaleSuffix}${shinySuffix}`
    if (availablePokemon.has(pokemonIdString)) return pokemonIdString
    pokemonIdString = `${pokeId}_00${shinySuffix}`
    if (availablePokemon.has(pokemonIdString)) return pokemonIdString
    return '000'	// substitute
}

async function pokicon(baseUrl, pokemonId, pokemonForm = 0, evolutionId = 0, female = false, costumeId = 0,
                       shiny = false) {
    await sema.acquire()
    try {
        if (availablePokemon === undefined) {
            availablePokemon = await axios.get(`${baseUrl}index.json`)
        }
    } finally {
        sema.release()
    }
    return `${baseUrl}pokemon_icon_${resolvePokemonIcon(pokemonId, pokemonForm, evolutionId, female, costumeId, shiny)}.png`
}

module.exports = pokicon;
