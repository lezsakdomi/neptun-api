import * as Neptun from './index.ts'

// There is a central list of all Neptun deployments
const institutions = await Neptun.listInstitutions() as Neptun.Institution[]
// Not all of them has a mobile interface. We could've also filtered based on university name
const elte = institutions.find(inst => inst.server?.url.toString().match('elte.hu'))

if (!elte) {
    console.log(institutions)
    throw new Error("ELTE Neptun mobile service not found - can't continue")
}

// Always store credentials securely
const neptunCode = Deno.env.get('NEPTUN_CODE')
const password = Deno.env.get('NEPTUN_PASSWORD')

// Saving sessions is not implemented in this version yet
if (!neptunCode || !password) {
    console.log(elte)
    throw new Error("Please provide credentials")
}

// You can iterate over Institution.prototype.languages, or hardcode Hungarian
const session = await elte.login(neptunCode, password, {
    language: Neptun.KnownLanguage.fromCode('hu'),
})

// Neptun has different lists for terms based on usage
const terms = await session.getTerms(Neptun.termTypes.RegisterSubjectTerm)
const term = terms[0]

// Either a single relevance or an array of relevances can be specified, defaults to all
let relevance = undefined as undefined | 'curriculum' | 'elective' | 'unrelated' | ('curriculum' | 'elective' | 'unrelated')[]
relevance = ['curriculum', 'unrelated']

// Note: Passing a curriculum is optional, all curriculums are considered otherwise
const curriculums = await session.getCurriculums({term, relevance: 'curriculum'})
const curriculum = curriculums[0]

// Using some subject name filter
let name = undefined
// Don't list all subjects from 'unrelated', as it puts a high load on Neptun servers
if (relevance === undefined || (relevance as unknown) === 'unrelated' || relevance.includes('unrelated')) {
    name = "Logika"
}

const subjects = await session.getSubjects({
    // You can perform some server-side sorting here
    sort: {by: 'name', order: 'asc'},
    // You can also filter by code, courseCode, lecturer
    filter: {relevance, curriculum, term, name: "Logika"},
})

await subjects.loadLength()
console.log(`\x1b[1mListing ${subjects.length} ${relevance} subjects from ${curriculum?.name || 'everywhere'} (${term.name})\x1b[0m`)
console.log()
for await (const subject of subjects) {
    console.log(subject)
}

await session.logout()
