import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent 同时处理 Expo Go 与原生构建的 AppRegistry 注册
registerRootComponent(App);
