export abstract class Term {
    readonly id
    readonly name

    static apiPath: string
    static itemKey: string

    constructor({id, name}: {
        id: number,
        name: string,
    }) {
        this.id = id
        this.name = name
    }
}

export abstract class TermWithValue extends Term {
    readonly value

    static termsForEnumValue: number
    static apiPath = 'GetTermData'
    static itemKey = 'Terms'

    constructor(props: { id: number; name: string, value: number }) {
        super(props)

        this.value = props.value
    }
}

export abstract class RegisterTerm extends TermWithValue {
    static termsForEnumValue = 0 // SubjectSignIn
}

export abstract class TakenTerm extends TermWithValue {
    static termsForEnumValue = 1 // Casual
}

export class RegisterSubjectTerm extends RegisterTerm {
    constructor({ID, Name, Value}: { ID: number; Name: string; Value: number; }) {
        super({id: ID, name: Name, value: Value})
    }
}

export class RegisterExamTerm extends RegisterTerm {
    constructor({ID, Name, Value}: { ID: number; Name: string; Value: number; }) {
        super({id: ID, name: Name, value: Value})
    }
}

export class TakenSubjectTerm extends TakenTerm {
    constructor({ID, Name, Value}: { ID: number; Name: string; Value: number; }) {
        super({id: ID, name: Name, value: Value})
    }
}

export class TakenExamTerm extends TakenTerm {
    constructor({ID, Name, Value}: { ID: number; Name: string; Value: number; }) {
        super({id: ID, name: Name, value: Value})
    }
}

export class PeriodTerm extends Term {
    static apiPath = 'GetPeriodTerms'
    static itemKey = 'PeriodTermList'

    constructor({Id, TermName}: { Id: number; TermName: string }) {
        super({id: Id, name: TermName})
    }
}

export class MarkbookTerm extends TakenTerm {
    static apiPath = 'GetMarkbookTermData'
}

export type LeafTermType
    = typeof RegisterSubjectTerm
    | typeof TakenSubjectTerm
    | typeof RegisterExamTerm
    | typeof TakenExamTerm
    | typeof PeriodTerm
    | typeof MarkbookTerm
