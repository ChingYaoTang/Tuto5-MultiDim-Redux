import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import store from './store';
import { Provider } from 'react-redux';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    // Provider makes the Redux store available to all nested components.
    <Provider store={store}>
      <App />
    </Provider>
);
