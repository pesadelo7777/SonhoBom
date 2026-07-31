// src/commands/list/interacao.ts
import { RoomInstance } from '../../core/RoomInstance';
import { CONFIG } from '../../config';

const loopsAtivos = new Map<string, NodeJS.Timeout>();

export function interacao(args: string[], room: RoomInstance, tipo: string) {
    const input = args[0];
    const modificador = args[1]?.toLowerCase();

    // Falha silenciosa se não houver alvo
    if (!input) return;

    const alvoId = room.getUserIdByName(input);
    if (!alvoId || alvoId === room.roomId) return;

    const acao = tipo === 'hug' ? '/hug' : '/punch';
    
    // A SINTAXE EXATA CAPTURADA NO F12
    const payloadMsg = `*msg TwoPartyAction:${acao} 1 ${CONFIG.AVATAR_ID} 2 ${alvoId}`;
    const loopKey = `${room.roomId}-${alvoId}-${tipo}`;

    // ==========================================
    // PARAR LOOP
    // ==========================================
    if (modificador === 'stop' || modificador === 'parar') {
        if (loopsAtivos.has(loopKey)) {
            clearInterval(loopsAtivos.get(loopKey)!);
            loopsAtivos.delete(loopKey);
            console.log(`\x1b[31m[Comando] Loop de ${tipo} em ${alvoId} INTERROMPIDO.\x1b[0m`);
        }
        return;
    }

    // ==========================================
    // INICIAR LOOP
    // ==========================================
    if (modificador === 'loop') {
        if (loopsAtivos.has(loopKey)) return;

        room.enviarMensagem(payloadMsg);

        const interval = setInterval(() => {
            room.enviarMensagem(payloadMsg);
        }, 4000); 

        loopsAtivos.set(loopKey, interval);
        console.log(`\x1b[35m[Comando] Loop de ${acao} INICIADO no alvo ${alvoId}\x1b[0m`);
        return;
    }

    // ==========================================
    // EXECUÇÃO ÚNICA (SILENCIOSA NO CÓDIGO)
    // ==========================================
    room.enviarMensagem(payloadMsg);
    
    console.log(`\x1b[35m[Comando] Executando TwoPartyAction (F12): ${acao} no alvo ${alvoId}\x1b[0m`);
}