import { contextBridge } from 'electron';
import { clipboardApi } from './clipboardApi';
import { shellApi } from './shellApi';
import { terminalApi } from './terminalApi';

contextBridge.exposeInMainWorld('terminal', terminalApi);
contextBridge.exposeInMainWorld('shell', shellApi);
contextBridge.exposeInMainWorld('clipboard', clipboardApi);
