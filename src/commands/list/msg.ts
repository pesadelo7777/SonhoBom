// src/commands/list/msg.ts

import { RoomInstance } from '../../core/RoomInstance';

export const msg = (args: string[], room: RoomInstance) => {
    if (args.length === 0) {
        room.enviarMensagem("⚠️ O que você quer que eu repita? Use: !msg [sua mensagem]");
        return;
    }
    
    // Junta as palavras e faz o bot falar apenas na sala do cliente atual
    const texto = args.join(' ');
    room.enviarMensagem(texto);
};