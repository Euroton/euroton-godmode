import { render } from 'preact';
import { App } from './App';

const root = document.getElementById('app');
if (root === null) {
    throw new Error('missing #app mount');
}
render(<App />, root);
