import {createMemorySky} from '../src/index.js';
import {data} from './memories.js';
document.body.style.margin='0';document.querySelector('#sky').style.height='100dvh';
createMemorySky(document.querySelector('#sky'),{data,title:'Memory Sky / 记忆星穹'});
