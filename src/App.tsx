import {contentView, NavigationView} from 'tabris'
import {LoginPage} from './LoginPage'
import 'core-js/modules/web.url.js'

export class App {

  public start() {
    contentView.append(
        <NavigationView stretch>
            <LoginPage/>
        </NavigationView>
    );
  }

}
