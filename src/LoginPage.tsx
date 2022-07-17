import 'core-js/stable'
import {ActivityIndicator, Button, Page, TextInput, StackLayout, Composite} from 'tabris'
import {ItemPicker, List} from 'tabris-decorators'
// noinspection ES6PreferShortImport
import {Institution, listInstitutions} from '../lib/session'
// noinspection ES6PreferShortImport
import {KnownLanguage} from '../lib/language'

export function LoginPage() {
    let selectedInstitution: Institution | undefined
    const loginInput = <TextInput message="Neptun code"/>
    const passwordInput = <TextInput message="Neptun password" type="password"/>
    const loginButton = (
<Button enabled={false} onSelect={() => {
        selectedInstitution.login(loginInput.text, passwordInput.text, {
            language: KnownLanguage.fromCode('hu'),
        }).then(console.log, console.error)
    }}>Login</Button>
)
    return (
        <Page layout={new StackLayout({alignment: 'stretchX', spacing: 16})}>
            <InstitutionPicker onSelect={institution => {
                selectedInstitution = institution
                loginButton.enabled = institution && institution.isCompatible
            }}/>
            {loginInput}
            {passwordInput}
            {loginButton}
        </Page>
    )
}

function InstitutionPicker({onSelect}: { onSelect: (institution: Institution) => void }) {
    const activityIndicator = (<ActivityIndicator stretch/>)

    const picker = (
<ItemPicker
    stretchX message="Institution" visible={false}
    items={new List<Institution>()} textSource="name"
    onItemSelect={({item}) => onSelect(item as Institution)}
    />
)

    listInstitutions().then(institutions => {
        activityIndicator.visible = false
        picker.items = institutions
        picker.selectionIndex = -1
        picker.visible = true
    }, e => console.error(e))

    return (
<Composite stretchX>
        {activityIndicator}
        {picker}
    </Composite>
)
}
