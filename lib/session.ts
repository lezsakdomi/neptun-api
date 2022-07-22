import {KnownLanguage, Language} from './language.ts'
import {APIEndpoint, IPaginatedRequest, EmptyPagination} from './network.ts'
import {LeafTermType, RegisterTerm, TakenTerm, Term, TermWithValue} from './term.ts'

export async function listInstitutions(options = {}) {
    const server = new APIEndpoint(new URL("https://mobilecloudservice.sdainformatika.hu/MobileServiceLib/MobileCloudService.svc"), options)

    const resp = await server.pureRequest("GetAllNeptunMobileUrls", {}) as {
        Languages: string,
        Name: string,
        NeptunMobileServiceVersion: number,
        OMCode: string,
        Url: string | null,
    }[]
    return resp.map(data => new Institution(data))
}

export class Institution {
    readonly languages: readonly Language[]
    readonly name: string
    readonly neptunMobileServiceVersion: number
    readonly omCode: string
    readonly server?: APIEndpoint

    constructor({Languages, Name, NeptunMobileServiceVersion, OMCode, Url}: {
        Languages: string,
        Name: string,
        NeptunMobileServiceVersion: number,
        OMCode: string,
        Url: string | null,
    }) {
        this.languages = Languages.split(/,/).map(code => Language.fromCode(code))
        this.name = Name
        this.neptunMobileServiceVersion = NeptunMobileServiceVersion
        this.omCode = OMCode
        if (Url) {
            this.server = new APIEndpoint(new URL(Url))
        }
    }

    get isCompatible() {
        return !(this.neptunMobileServiceVersion != 0 || !this.server)
    }

    async fetchPrivacyStatementUrl(): Promise<URL | undefined> {
        if (!this.isCompatible) return

        const {URL: url} = await (this.server as APIEndpoint).pureRequest('GetPrivacyStatement', null) as {
            URL: string | null
        }
        if (url) {
            return new URL(url)
        } else {
            return undefined
        }
    }

    async login(neptunCode: string, password: string, options: { language: KnownLanguage }): Promise<Session> {
        if (!this.isCompatible) {
            throw new Error("Institution has no compatible service")
        } else {
            const session = new Session({
                url: (this.server as APIEndpoint).url,
                neptunCode, password,
                language: options.language,
            }, options)
            await session.login()
            return session
        }
    }
}

interface ISessionOptions {
    training?: Training,
}

export class Session {
    readonly server: APIEndpoint
    #initialized: boolean = false
    #loginDetails: { password: string; language: KnownLanguage; neptunCode: string }
    #neptunCodeReceivedFromServer?: string
    training?: Training

    get #bodyBase(): {
        CurrentPage: 0,
        ErrorMessage: null,
        ExceptionsEnum: 0,
        LCID: number,
        MobileServiceVersion: 0,
        MobileVersion: "1.5.2",
        NeptunCode: string | null,
        OnlyLogin: false,
        Password: string,
        StudentTrainingID: number | null,
        TotalRowCount: -1,
        UserLogin: string
        [key: string]: any
    } {
        return {
            CurrentPage: 0,
            ErrorMessage: null,
            ExceptionsEnum: 0,
            LCID: this.#loginDetails.language.lcid,
            MobileServiceVersion: 0,
            MobileVersion: "1.5.2",
            NeptunCode: this.#neptunCodeReceivedFromServer || null,
            OnlyLogin: false, // even on login
            Password: this.#loginDetails.password,
            StudentTrainingID: this.training ? this.training.id : null,
            TotalRowCount: -1,
            UserLogin: this.#loginDetails.neptunCode,
        }
    }

    async #request(url: string, body = {}, options: ISessionOptions = {}) {
        return await this.server.request(url, {
            ...this.#bodyBase,
            ...body,
            ...options.training && {StudentTrainingID: options.training.id},
        }, options)
    }

    #requestPaginated<ItemT, ResponseT>(url: string, itemKey: string, itemClass: new(data: ResponseT) => ItemT, body = {}, options: ISessionOptions = {}) {
        return this.server.requestPaginated<ItemT, ResponseT>(url, itemKey, itemClass, {
            ...this.#bodyBase,
            ...body,
            ...options.training && {StudentTrainingID: options.training.id},
        }, options)
    }

    constructor({url, neptunCode, password, language}: {
        url: URL,
        neptunCode: string,
        password: string,
        language: KnownLanguage,
    }, options = {}) {
        this.server = new APIEndpoint(url, options)
        this.#loginDetails = {neptunCode, password, language}
    }

    async login(options = {}) {
        const {TrainingList} = await this.#request('GetTrainings', {}, options) as {
            TrainingList: {
                Code: string,
                Description: string,
                Id: number,
            }[]
        }
        this.training = new Training(TrainingList[0])
        this.#initialized = true
    }

    async logout(options = {}) {
        await this.#request('SignOut', {}, options)
    }

    async getTrainings({} = {}) {
        const {TrainingList} = await this.#request('GetTrainings') as {
            TrainingList: {
                Code: string,
                Description: string,
                Id: number,
            }[]
        }

        return TrainingList.map(data => new Training(data))
    }

    getSubjects(scope: {
        sort?: { by: 'name', order: 'asc' | 'desc' },
    } & ({
        filter: {
            name?: string,
            code?: string,
            lecturer?: string,
            curriculum?: Curriculum,
            courseCode?: string, // todo
            relevance?: 'curriculum' | 'elective' | 'unrelated'
                | ('curriculum' | 'elective' | 'unrelated')[],
            term: RegisterTerm,
        },
    } | {
        filter: {
            name: undefined,
            code: undefined,
            lecturer: undefined,
            curriculum: undefined,
            courseCode: undefined,
            relevance: 'taken',
            term?: TakenTerm,
        },
    }), options = {}): IPaginatedRequest<Subject, {
        Completed: boolean,
        Credit: number,
        CurriculumTemplateID: null | number,
        CurriculumTemplatelineID: null | number,
        IsOnSubject: boolean,
        SubjectCode: string,
        SubjectId: number,
        SubjectName: number,
        SubjectRequirement: string,
        SubjectSignupType: string,
        TermID: number,
    }> {
        const {
            sort: {order: sortOrder} = {by: 'name', order: 'asc'},
            filter: {name, code, lecturer, curriculum, courseCode, relevance = ['curriculum', 'elective', 'unrelated'], term},
        } = scope

        if (relevance === 'taken') {
            if (term === undefined || term instanceof TakenTerm) {
                throw new NotImplementedError
            } else {
                throw new ArgumentError("Unexpected term type: When listing taken subjects, only TakenTerm instances are accepted")
            }
        } else if (Array.isArray(relevance)) {
            if (term instanceof RegisterTerm) {
                // @ts-ignore
                return relevance.reduce((a, relevance) => a.concat(this.getSubjects({...scope, filter: {...scope.filter, relevance}})), new EmptyPagination)
            } else {
                throw new ArgumentError("Unexpected term and relevance combination: When omitting relevance or specifying it as an array, only RegisterTerm instances are accepted")
            }
        } else if (['curriculum', 'elective', 'unrelated'].includes(relevance)) {
            if (term instanceof RegisterTerm) {
                return this.#requestPaginated('GetSubjects', 'SubjectList', Subject, {
                    SubjectSortEnum: {
                        'asc': 0,
                        'desc': 1,
                    }[sortOrder],
                    filter: {
                        CourseCode: courseCode || null,
                        CourseTutor: lecturer || null,
                        CurriculumID: curriculum ? curriculum.id : null,
                        SubjectCode: code || null,
                        SubjectName: name || null,
                        SubjectType: {
                            'curriculum': 0,
                            'elective': 1,
                            'unrelated': 2,
                        }[relevance],
                        TermID: term.id,
                    },
                }, options)
            } else {
                throw new ArgumentError("Unexpected term type, expecting RegisterTerm when listing unrelated courses or from the curriculum")
            }
        } else {
            throw new ArgumentError("Unexpected relevance setting")
        }
    }

    async getCurriculums({term, relevance}: {
        term: Term,
        relevance: 'curriculum' | 'elective' | 'unrelated',
    }, options: ISessionOptions = {}) {
        const {CurriculumList} = await this.#request('GetCurriculums', {
            TermID: term.id,
            SubjectType: {
                'curriculum': 0,
                'elective': 1,
                'unrelated': 2,
            }[relevance],
        }) as {
            CurriculumList: {
                CurriculumName: string,
                ID: number,
            }[]
        }
        // todo doesn't it return multi-page data?

        return CurriculumList.map(data => new Curriculum(data))
    }

    async getTerms<T extends LeafTermType>(klass: T & ({ apiPath: string, itemKey: string, termsForEnumValue?: number } & (
        { new(data: { ID: number, Name: string, Value: number }): TermWithValue }
        | { new(data: { Id: number, TermName: string }): Term }
        )), options = {}): Promise<InstanceType<T>[]> {
        const res = await this.#request(klass.apiPath, {
            Terms: typeof klass.termsForEnumValue === 'number' ? klass.termsForEnumValue : undefined,
        }, options)
        // @ts-ignore
        const list = res[klass.itemKey]
        // @ts-ignore
        return list.map(data => new klass(data)) // todo
    }
}

export class ArgumentError extends TypeError {

}

class NotImplementedError extends Error {
    constructor() {
        super("Not implemented")
    }
}

export class Training {
    readonly code: string
    readonly description: string
    readonly id: number

    constructor({Code, Description, Id}: {
        Code: string,
        Description: string,
        Id: number,
    }) {
        this.code = Code
        this.description = Description
        this.id = Id
    }
}

export class Curriculum {
    readonly name: string
    readonly id: number

    constructor({CurriculumName, ID}: {
        CurriculumName: string,
        ID: number,
    }) {
        this.name = CurriculumName
        this.id = ID
    }
}

export class Subject {
    readonly id: number
    readonly name: number
    readonly code: string
    readonly taken: boolean
    readonly completed: boolean
    readonly totalCredits: number
    readonly assessmentType?: string
    readonly gradeGrades: number
    readonly termId: number
    readonly curriculumId?: number

    constructor(data: {
        Completed: boolean,
        Credit: number,
        CurriculumTemplateID: null | number,
        // todo CurriculumTemplatelineID: null | number,
        IsOnSubject: boolean,
        SubjectCode: string,
        SubjectId: number,
        SubjectName: number,
        SubjectRequirement: string,
        // todo SubjectSignupType: string,
        TermID: number,
    }) {
        this.id = data.SubjectId
        this.name = data.SubjectName
        this.code = data.SubjectCode
        this.taken = data.IsOnSubject
        this.completed = data.Completed
        this.totalCredits = data.Credit
        const match = /^(.*) \((\d+)\)$/.exec(data.SubjectRequirement)
        this.assessmentType = match ? match[1] : undefined
        this.gradeGrades = match ? parseInt(match[2]) : 5
        this.termId = data.TermID
        this.curriculumId = data.CurriculumTemplateID === null ? undefined : data.CurriculumTemplateID
    }
}
