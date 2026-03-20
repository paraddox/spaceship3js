import './styles.css';
import { App } from './app/App';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) {
  throw new Error('Missing #app root');
}

new App(root);
