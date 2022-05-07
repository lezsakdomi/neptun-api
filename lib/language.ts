export class LanguageCodeError extends Error {
    constructor(message: string) {
        super(message)
    }
}

export class Language {
    readonly code: string

    constructor({TwoCharCode}: { TwoCharCode: string }) {
        this.code = TwoCharCode
    }

    static fromCode(code: string) {
        try {
            return KnownLanguage.fromCode(code)
        } catch (e) {
            if (e instanceof LanguageCodeError) {
                return new Language({TwoCharCode: code})
            } else {
                throw e
            }
        }
    }
}

export class KnownLanguage extends Language {
    readonly lcid: number
    readonly name: string

    constructor({Name, TwoCharCode, LCID}: { Name: string, TwoCharCode: string, LCID: number }) {
        super({TwoCharCode})
        this.name = Name
        this.lcid = LCID
    }

    static fromCode(code: string) {
        switch (code.toLowerCase()) {
            case "hu":
                return new KnownLanguage({
                    LCID: 1038,
                    TwoCharCode: "hu",
                    Name: "Magyar",
                })

            case "en":
                return new KnownLanguage({
                    LCID: 1033,
                    TwoCharCode: "en",
                    Name: "English",
                })

            case "de":
                return new KnownLanguage({
                    LCID: 1031,
                    TwoCharCode: "de",
                    Name: "Deutsch",
                })

            default:
                throw new LanguageCodeError(`Unexpected language code: ${JSON.stringify(code)}`)
        }
    }
}
