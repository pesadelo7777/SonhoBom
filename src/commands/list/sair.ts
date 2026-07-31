// src/commands/list/sair.ts

import { RoomInstance } from '../../core/RoomInstance';

export const sair = (args: string[], room: RoomInstance) => {
    
    // Se a sala atual for DIFERENTE da sala base (Ou seja, ela está viajando)
    if (room.roomId !== room.cliente.salaBase) {
        room.enviarMensagem("Meu tempo de visita acabou, tô voltando pra minha base. Fui! ✌️");
        
        setTimeout(() => {
            room.desconectar(); // Retira o corpo e a mente da sala visitada
            if (room.onMoveRoom) {
                room.onMoveRoom(room.cliente.salaBase); // Manda de volta pro QG
            }
        }, 1500);
    } 
    // Se ela já estiver na Sala Base
    else {
        room.enviarMensagem("Sair pra onde, tá maluco? Eu já tô em casa! Quer que eu durma na rua? 😂");
        // O bot NÃO desconecta aqui. Ele continua ativo na sala base.
    }
};