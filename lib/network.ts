export class APIEndpoint {
    readonly url: URL
    readonly #cookies: { [key: string]: string; }

    constructor(url: URL, options = {}) {
        this.url = url
        this.#cookies = {}
    }

    generateFullUrl(path: string): string {
        const url = new URL(this.url.toString())
        url.pathname += '/'
        return (new URL(path, url)).toString()
    }

    async pureRequest(url: string, body: any = {}, options = {}): Promise<any> {
        const res = await fetch(this.generateFullUrl(url), {
            method: 'POST',
            body: JSON.stringify(body),
            headers: {
                'Content-Type': 'application/json',
                'Cookie': Object.getOwnPropertyNames(this.#cookies).length
                    ? Object.getOwnPropertyNames(this.#cookies).reduce((a, v) => [
                        ...a,
                        `${encodeURI(v)}=${this.#cookies[v]}`,
                    ], ([] as string[])).join("; ")
                    : "",
            },
        })

        const cookieHeader = res.headers.get('Set-Cookie')
        if (cookieHeader) {
            for (const cookieDecl of cookieHeader.split(/\s*,\s*/g)) {
                const match = cookieDecl.match(/^([^=;]*)=([^;]*)(?:;.*)?/)
                if (match) {
                    const [, name, value] = match
                    this.#cookies[name] = value
                }
            }
        }

        // return await res.json()

        const resText = await res.text()
        try {
            return JSON.parse(resText)
        } catch (e) {
            console.debug(resText)
            throw e
        }
    }

    async request<ResponseDetails extends {},
        PageT extends 0 | number,
        NeptunCodeT extends null | string,
        TrainingIdT extends null | number,
        >(url: string, body: {
        CurrentPage: PageT | null,
        ErrorMessage: null,
        ExceptionsEnum: 0,
        LCID: number,
        MobileServiceVersion: 0,
        MobileVersion: "1.5.2",
        NeptunCode: NeptunCodeT,
        OnlyLogin: false,
        Password: string,
        StudentTrainingID: TrainingIdT,
        TotalRowCount: -1,
        UserLogin: string
        [key: string]: any
    }, options = {}): Promise<{ CurrentPage: PageT; ErrorMessage: string | null; ExceptionData: null; ExceptionsEnum: number; LCID: number; MobileServiceVersion: number; MobileVersion: string; NeptunCode: NeptunCodeT; Password: any; StudentTrainingID: TrainingIdT; TotalRowCount: number; UserLogin: string } | ResponseDetails> {
        const res = await this.pureRequest(url, body, options) as {
            CurrentPage: PageT,
            ErrorMessage: string | null,
            ExceptionData: null,
            ExceptionsEnum: number,
            LCID: number,
            MobileServiceVersion: number,
            MobileVersion: string,
            NeptunCode: NeptunCodeT,
            Password: (typeof body.password),
            StudentTrainingID: TrainingIdT,
            TotalRowCount: number,
            UserLogin: string,
        }

        if (res.ExceptionsEnum !== 0) {
            throw new APIError(res)
        } else {
            return res
        }
    }

    requestPaginated<ItemType,
        ResponseType extends {},
        NeptunCodeT extends null | string = null | string,
        TrainingIdT extends null | number = null | number,
        >(url: string, itemKey: string, itemClass: new(data: ResponseType) => ItemType, body: {
        ErrorMessage: null,
        ExceptionsEnum: 0,
        LCID: number,
        MobileServiceVersion: 0,
        MobileVersion: "1.5.2",
        NeptunCode: NeptunCodeT,
        OnlyLogin: false,
        Password: string,
        StudentTrainingID: TrainingIdT,
        TotalRowCount: -1,
        UserLogin: string
        [key: string]: any
    }, options = {}): PaginatedRequest<ItemType, ResponseType, NeptunCodeT, TrainingIdT> {
        return new PaginatedRequest(this, url, itemKey, itemClass, body, options)
    }
}

export class PaginatedRequest<ItemType,
    ResponseType extends {},
    NeptunCodeT extends null | string = null | string,
    TrainingIdT extends null | number = null | number,
    >
    implements IPaginatedRequest<ItemType, ResponseType, NeptunCodeT, TrainingIdT> {
    readonly server: APIEndpoint
    readonly url: string
    readonly itemKey: string
    readonly itemClass: new(data: ResponseType) => ItemType
    #options: {}

    #lastBody: {
        CurrentPage: number,
        ErrorMessage: null,
        ExceptionsEnum: 0,
        LCID: number,
        MobileServiceVersion: 0,
        MobileVersion: "1.5.2",
        NeptunCode: NeptunCodeT,
        OnlyLogin: false,
        Password: string,
        StudentTrainingID: TrainingIdT,
        TotalRowCount: -1,
        UserLogin: string
    } // & RequestDetails

    get currentPage(): number | undefined {
        if (this.#lastBody.CurrentPage > 0) {
            return this.#lastBody.CurrentPage - 1
        } else {
            return undefined
        }
    }

    constructor(server: APIEndpoint, url: string, itemKey: string, itemClass: new(data: ResponseType) => ItemType, body: {
                    ErrorMessage: null,
                    ExceptionsEnum: 0,
                    LCID: number,
                    MobileServiceVersion: 0,
                    MobileVersion: "1.5.2",
                    NeptunCode: NeptunCodeT,
                    OnlyLogin: false,
                    Password: string,
                    StudentTrainingID: TrainingIdT,
                    TotalRowCount: -1,
                    UserLogin: string
                } // & RequestDetails
        , options = {}) {
        this.server = server
        this.url = url
        this.itemKey = itemKey
        this.itemClass = itemClass
        this.#lastBody = {
            ...body,
            CurrentPage: 0,
        }
        this.#options = {}
    }

    readonly #responses: unknown[] = []
    #loadedAll: boolean = false
    #loadedPages: ItemType[][] = []

    get loadedItems(): ItemType[] {
        return this.loadedPages.reduce((a, v) => [...a, ...v], [])
    }

    get loadedPages(): ItemType[][] {
        return [...this.#loadedPages]
    }

    get length(): number | undefined {
        if (this.#responses.length) {
            // @ts-ignore
            return this.#responses[this.#responses.length - 1].TotalRowCount
        } else {
            return undefined
        }
    }

    get loadedAll(): boolean {
        return this.#loadedAll
    }

    async loadLength() {
        await this.loadMore()
        return this.length as number
    }

    async loadMore() {
        if (this.loadedAll) return null

        this.#lastBody.CurrentPage++
        const res = await this.server.request(this.url, this.#lastBody, this.#options) as {
            CurrentPage: number,
            TotalRowCount: number,
            // [key: ItemKey]: ItemType,
        }

        this.#responses.push(res)

        if (this.loadedItems.length >= res.TotalRowCount) {
            this.#loadedAll = true
        }

        // @ts-ignore
        const objects = res[this.itemKey].map(data => new this.itemClass(data))
        this.#loadedPages.push(objects)
        return [...objects]
    }

    async* [Symbol.asyncIterator]() {
        for (let items: ItemType[] | null = this.loadedItems; items; items = await this.loadMore()) {
            for (const item of items) {
                yield item
            }
        }
    }

    concat(other: IPaginatedRequest<ItemType, ResponseType, NeptunCodeT, TrainingIdT>):
        IPaginatedRequest<ItemType, ResponseType, NeptunCodeT, TrainingIdT> {
        return new ConcatenatedPagination<ItemType, ResponseType, NeptunCodeT, TrainingIdT>(this, other) as
            IPaginatedRequest<ItemType, ResponseType, NeptunCodeT, TrainingIdT>
    }
}

export interface IPaginatedRequest<ItemType, ResponseType,
    NeptunCodeT extends null | string = null | string,
    TrainingIdT extends null | number = null | number>
    extends AsyncIterable<ItemType> {
    get currentPage(): number | undefined

    get length(): number | undefined

    loadMore(): Promise<ItemType[] | null>

    get loadedAll(): boolean

    get loadedItems(): ItemType[]

    get loadedPages(): ItemType[][]

    concat(other: IPaginatedRequest<ItemType, ResponseType, NeptunCodeT, TrainingIdT>): IPaginatedRequest<ItemType, ResponseType, NeptunCodeT, TrainingIdT>

    loadLength(): Promise<number>
}

class ConcatenatedPagination<ItemType, ResponseType, NeptunCodeT extends null | string, TrainingIdT extends null | number>
    implements IPaginatedRequest<ItemType, ResponseType, NeptunCodeT, TrainingIdT> {

    readonly #left: IPaginatedRequest<ItemType, ResponseType, NeptunCodeT, TrainingIdT>
    readonly #right: IPaginatedRequest<ItemType, ResponseType, NeptunCodeT, TrainingIdT>

    constructor(
        left: IPaginatedRequest<ItemType, ResponseType, NeptunCodeT, TrainingIdT>,
        right: IPaginatedRequest<ItemType, ResponseType, NeptunCodeT, TrainingIdT>) {
        this.#left = left
        this.#right = right
    }

    async* [Symbol.asyncIterator]() {
        for await (const item of this.#left) {
            yield item
        }

        for await (const item of this.#right) {
            yield item
        }
    }

    get currentPage(): number | undefined {
        if (!this.#left.loadedAll) return this.#left.currentPage;
        if (!this.#right.loadedAll) return this.#right.currentPage;
    }

    concat(other: PaginatedRequest<ItemType, ResponseType, NeptunCodeT, TrainingIdT>): ConcatenatedPagination<ItemType, ResponseType, NeptunCodeT, TrainingIdT> {
        return new ConcatenatedPagination<ItemType, ResponseType, NeptunCodeT, TrainingIdT>(this, other)
    }

    get length(): number | undefined {
        if (this.#left.length && this.#right.length) {
            return this.#left.length + this.#right.length
        }
    }

    async loadLength() {
        await this.#left.loadLength()
        await this.#right.loadLength()
        return this.length as number
    }

    async loadMore() {
        if (!this.#left.loadedAll) {
            return await this.#left.loadMore()
        } else if (!this.#right.loadedAll) {
            return await this.#right.loadMore()
        } else {
            return null
        }
    }

    get loadedAll(): boolean {
        return this.#left.loadedAll && this.#right.loadedAll
    }

    get loadedItems(): ItemType[] {
        return [...this.#left.loadedItems, ...this.#right.loadedItems]
    }

    get loadedPages(): ItemType[][] {
        return [...this.#left.loadedPages, ...this.#right.loadedPages]
    }
}

export class APIError extends Error {
    readonly humanMessage?
    readonly code?
        // : 'NO_ERROR'
        : 'USER_NOTFOUND'
        | 'PASSWORD_EXPIRED'
        | 'UNHANDLED_EXCEPTION'
        | 'SERVICE_TIEMOUT'
        | 'DEVELOPER_GENERATED'
        | 'SERVER_FULL'
        | 'SERVICE_NOTFOUND'
        | 'INVALIDSESSION'
        | 'WRONGVERSION_HIGHER'
        | 'WRONGVERSION_LOWER'
        | 'NO_NETWORK_CONNECTION'
        | 'UNACCEPTEDGDPRPRIVACYSTATEMENT'

    constructor(response: {
        ErrorMessage: string | null,
        ExceptionData: null,
        ExceptionsEnum: number,
    }) {
        const code = [
            'NO_ERROR',
            'USER_NOTFOUND',
            'PASSWORD_EXPIRED',
            'UNHANDLED_EXCEPTION',
            'SERVICE_TIEMOUT',
            'DEVELOPER_GENERATED',
            'SERVER_FULL',
            'SERVICE_NOTFOUND',
            'INVALIDSESSION',
            'WRONGVERSION_HIGHER',
            'WRONGVERSION_LOWER',
            'NO_NETWORK_CONNECTION',
            'UNACCEPTEDGDPRPRIVACYSTATEMENT',
        ][response.ExceptionsEnum]

        super(`Remote API responded with ${code} error`)

        // @ts-ignore
        this.code = code
        this.humanMessage = response.ErrorMessage || ""
    }
}

export class EmptyPagination<ItemT, ResT,
    NeptunCodeT extends null | string = null | string,
    TrainingIdT extends null | number = null | number>
    implements IPaginatedRequest<ItemT, ResT, NeptunCodeT, TrainingIdT> {

    concat(other: IPaginatedRequest<ItemT, ResT, NeptunCodeT, TrainingIdT>): IPaginatedRequest<ItemT, ResT, NeptunCodeT, TrainingIdT> {
        return other;
    }

    get currentPage(): number | undefined {
        return undefined;
    }

    get length(): number | undefined {
        return 0;
    }

    loadLength(): Promise<number> {
        return Promise.resolve(0);
    }

    loadMore(): Promise<ItemT[] | null> {
        return Promise.resolve(null);
    }

    get loadedAll(): boolean {
        return true;
    }

    get loadedItems(): ItemT[] {
        return [];
    }

    get loadedPages(): ItemT[][] {
        return [];
    }

    async *[Symbol.asyncIterator]() {
        // noop
    }
}
