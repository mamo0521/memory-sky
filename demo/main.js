import {createMemorySky} from '../src/index.js';
import {data} from './memories.js';
import './demo.css';
createMemorySky(document.querySelector('#sky'),{data,title:'Memory Sky / 记忆星穹'});
