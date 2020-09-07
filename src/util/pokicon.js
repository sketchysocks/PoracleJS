const axios = require('axios')
const { Sema } = require('async-sema')

const sema = new Sema(1)
let availablePokemon = {}

function resolvePokemonIcon(availablePokemon, pokemonId, form = 0, evolution = 0, gender = 0, costume = 0,
                            shiny = false) {
    const evolutionSuffixes = evolution ? ['-e' + evolution, ''] : ['']
    const formSuffixes = form ? ['-f' + form, ''] : ['']
    const costumeSuffixes = costume ? ['-c' + costume, ''] : ['']
    const genderSuffixes = gender ? ['-g' + gender, ''] : ['']
    const shinySuffixes = shiny ? ['-shiny', ''] : ['']
    for (const evolutionSuffix of evolutionSuffixes) {
    for (const formSuffix of formSuffixes) {
    for (const costumeSuffix of costumeSuffixes) {
    for (const genderSuffix of genderSuffixes) {
    for (const shinySuffix of shinySuffixes) {
        const result = `${pokemonId}${evolutionSuffix}${formSuffix}${costumeSuffix}${genderSuffix}${shinySuffix}`
        if (availablePokemon.has(result)) return result
    }
    }
    }
    }
    }
    return '0'  // substitute
}

async function pokicon(baseUrl, pokemonId, form = 0, evolution = 0, female = false, costume = 0,
                       shiny = false) {
    await sema.acquire()
    try {
        if (availablePokemon[baseUrl] === undefined) {
            availablePokemon[baseUrl] = new Set(await axios.get(`${baseUrl}/index.json`).data)
        }
    } finally {
        sema.release()
    }
    return `${baseUrl}/${resolvePokemonIcon(availablePokemon[baseUrl], pokemonId, form, evolution, female, costume, shiny)}.png`
}

module.exports = pokicon;
