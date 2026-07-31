// src/commands/list/ir.ts

import { RoomInstance } from '../../core/RoomInstance';

export const ir = (args: string[], room: RoomInstance) => {
    if (args.length === 0) {
        room.enviarMensagem("Me manda o ID da sala, pô!");
        return;
    } 
    
    const destino = args[0].replace('room-', '').trim();

    // 1. CHECAGEM DE CONFLITO BLINDADA (Radar)
    if (room.verificarColisao && room.verificarColisao(destino)) {
        room.enviarMensagem(`⛔ Chefe, já tem uma cópia minha trabalhando nessa sala agora.`);
        return;
    }

    // 2. CAPTURA O NOME DA SALA E AVISA NO CHAT
    room.obterNomeSala(destino).then((nomeDaSala) => {
        room.enviarMensagem(`Deixa comigo. Tô arrumando as malas pra ${nomeDaSala} ! ✈️`);
        
        // 3. AGUARDA A MENSAGEM SAIR, DESCONECTA E VIAJA
        setTimeout(() => {
            if (room.onMoveRoom) {
                room.desconectar();
                room.onMoveRoom(destino);
            }
        }, 1500);
    });
};