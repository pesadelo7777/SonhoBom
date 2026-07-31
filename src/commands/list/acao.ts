// src/commands/list/acao.ts
import { RoomInstance } from '../../core/RoomInstance';

export function acao(args: string[], room: RoomInstance) {
    const input = args[0];

    // Falha silenciosa se não digitar a ação
    if (!input) return;

    // Tira a barra caso alguém digite !a /meme2
    const acaoName = input.replace('/', '');

    // O CÓDIGO RASTREADO NO F12! 
    // O Next reconhece o "*imvu:trigger" e engatilha a malha 3D.
    const payloadMsg = `*imvu:trigger ${acaoName}`;
    
    room.enviarMensagem(payloadMsg);
    
    console.log(`\x1b[35m[Comando] Executando Trigger (F12): ${acaoName}\x1b[0m`);
}