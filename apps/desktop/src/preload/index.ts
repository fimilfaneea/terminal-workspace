import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('terminal', {});
contextBridge.exposeInMainWorld('shell', {});
contextBridge.exposeInMainWorld('clipboard', {});
