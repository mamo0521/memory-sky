import {createMemorySky} from '../src/index.js';
import {data} from './memories.js';
import './demo.css';
// 地址栏可带 ?look=print&core=gyro 直接开成指定外观和核心；不带就是星穹。
// 控制台里也能切：sky.setLook('print')、sky.setCore('cube')、sky.setShape('ring')。
const params=new URLSearchParams(location.search);
window.sky=createMemorySky(document.querySelector('#sky'),{data,title:'Memory Sky / 记忆星穹',look:params.get('look')||'sky',core:params.get('core')||'ripple'});
