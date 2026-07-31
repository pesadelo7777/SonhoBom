// src/index.ts

import { BotManager } from './BotManager';

// Instancia o Maestro do sistema
const botManager = new BotManager();

// Inicia o processo de login e entrada na primeira sala
botManager.iniciar().catch(err => {
    console.error("Erro crítico na inicialização do sistema:", err);
});
