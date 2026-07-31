import { RoomInstance } from '../../core/RoomInstance';

export const pose = (args: string[], senderId: string, room: RoomInstance) => {
    // 1. Consulta o radar para saber EXATAMENTE onde o usuário está agora
    const posicaoUsuario = room.userSeats.get(senderId);

    // 2. Trava de Segurança: Se não achou, não vai pro limbo
    if (!posicaoUsuario) {
        room.enviarMensagem("Não tô te achando no radar! Levanta e senta de novo pra eu ver sua pose.");
        return;
    }

    room.enviarMensagem("Indo para a pose em 3 segundos... sai dai! ⏳");

    setTimeout(() => {
        // 3. O Choque Físico: Cancela qualquer animação presa que impeça ela de sentar
        room.enviarMensagemOculta("*use 0");

        // 4. Atira pro nó exato do sofá/chão
        room.moverParaPose(posicaoUsuario.node, posicaoUsuario.furniId);
        console.log(`\x1b[35m[Comando] Bot assumiu a pose do usuário ${senderId}.\x1b[0m`);
    }, 3000);
}