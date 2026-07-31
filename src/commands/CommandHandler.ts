// src/commands/CommandHandler.ts

import { RoomInstance } from '../core/RoomInstance';
import { pose } from './list/pose';
import { sair } from './list/sair';
import { msg } from './list/msg';
import { interacao } from './list/interacao';
import { acao } from './list/acao'; 
import { CONFIG } from '../config'; 
import { geminiService } from '../services/GeminiService';
import { radioService } from '../services/RadioService';
import { mongoManager } from '../database/MongoManager';

export class CommandHandler {
    // CIRURGIA 1: Adicionado comandos de controle corporal e mental do bot
    private comandosAdmin: string[] = ['ir', 'sair', 'msg', 'tocar', 'add', 'limpar', 'parar', 'pular', 'bater', 'ia', 'danca', 'senta', 'silencio', 'fala'];
    private comandosPublicos: string[] = ['pose', 'fila', 'abracar', 'abraçar', 'acao', 'animar', 'a'];

    public processar(texto: string, senderName: string, senderId: string, room: RoomInstance) {
        
        if (texto.startsWith(CONFIG.PREFIXO)) {
            const isBot = senderName.toLowerCase() === CONFIG.BOT_USER.toLowerCase();
            
            const isAdmin = room.cliente.admins.includes(senderId) || room.cliente.dono.toLowerCase() === senderName.toLowerCase();

            radioService.setSala(room);

            const args = texto.slice(1).trim().split(/ +/);
            const comando = args.shift()?.toLowerCase();

            if (!comando) return;

            if (this.comandosAdmin.includes(comando) && !isAdmin && !isBot) {
                room.enviarMensagem(`🚫 @${senderName}, você não tem passe VIP pra mandar em mim aqui não.`);
                return; 
            }

            if (!this.comandosAdmin.includes(comando) && !this.comandosPublicos.includes(comando)) return; 

            switch (comando) {
                case 'pose': pose(args, senderId, room); break;
                case 'sair': sair(args, room); break;
                case 'msg': msg(args, room); break;
                case 'abracar':
                case 'abraçar': interacao(args, room, 'hug'); break;
                case 'bater': interacao(args, room, 'punch'); break;
                case 'a':
                case 'acao':
                case 'animar': acao(args, room); break;

                // --- NOVOS COMANDOS DE DONO (CONTROLE DIRETO) ---
                case 'danca':
                    room.ws?.send(JSON.stringify({ record: 'msg_c2g_room_trigger', trigger: 'Breakdance' }));
                    room.enviarMensagem("Solta o som chefe, tô no pique! 💃");
                    break;
                case 'senta':
                    room.ws?.send(JSON.stringify({ record: 'msg_c2g_room_move', node_id: '0' }));
                    room.enviarMensagem("Tô indo sentar, preguiça bateu...");
                    break;
                case 'silencio':
                    room.iaAtiva = false;
                    room.enviarMensagem("🤐 Modo avião ativado. Pode falar à vontade que eu fico na minha.");
                    break;
                case 'fala':
                    room.iaAtiva = true;
                    room.enviarMensagem("✨ Voltei pro jogo! Quem tava com saudade?");
                    break;
                // ------------------------------------------------

                case 'ir':
                    if (args.length === 0) {
                        room.enviarMensagem("Me manda o ID da sala, pô!");
                        break;
                    } 
                    
                    const destino = args[0].replace('room-', '').trim();

                    if (room.verificarColisao && room.verificarColisao(destino)) {
                        room.enviarMensagem(`⛔ Chefe, já tem uma cópia minha trabalhando nessa sala agora.`);
                        break;
                    }

                    room.obterNomeSala(destino).then((nomeDaSala) => {
                        room.enviarMensagem(`Deixa comigo. Tô arrumando as malas pra ${nomeDaSala} ! ✈️`);
                        
                        setTimeout(() => {
                            if (room.onMoveRoom) {
                                room.desconectar();
                                room.onMoveRoom(destino);
                            }
                        }, 1500);
                    });
                    break;

                case 'tocar':
                    if (args.length === 0) { room.enviarMensagem("Qual a música? Manda o nome pra eu soltar o grave! 🎶"); break; }
                    if (radioService.isProcessing) { room.enviarMensagem("⏳ Segura a emoção! O motor já tá processando um som."); break; }
                    const musica = args.join(' ');
                    room.enviarMensagem(`🔎 Pesquisando: ${musica}...`);
                    radioService.tocar(musica); 
                    break;
                case 'add':
                    if (args.length === 0) { room.enviarMensagem("⚠️ Digite o nome da música!"); break; }
                    const musicaFila = args.join(' ');
                    radioService.fila.push(musicaFila);
                    if (!radioService.isProcessing && !radioService.isTocando()) {
                        room.enviarMensagem(`✅ Som na caixa: ${musicaFila}`);
                        radioService.tocarProxima();
                    } else {
                        room.enviarMensagem(`✅ Som engatilhado (Posição: ${radioService.fila.length})`);
                    }
                    break;
                case 'fila':
                    if (radioService.fila.length === 0) { room.enviarMensagem("📭 A fila tá vazia."); break; }
                    let msgFila = "🎶 Fila:\n";
                    radioService.fila.forEach((m, index) => { msgFila += `${index + 1}. ${m}\n`; });
                    room.enviarMensagem(msgFila);
                    break;
                case 'limpar': radioService.fila = []; room.enviarMensagem("🗑️ Fila limpa!"); break;
                case 'parar': radioService.pararAtual(); radioService.fila = []; room.enviarMensagem("🛑 Som pausado."); break;
                case 'pular':
                    if (radioService.fila.length === 0) room.enviarMensagem("⚠️ Não tem próxima música!");
                    else { radioService.pararAtual(); radioService.tocarProxima(); }
                    break;

                case 'ia':
                    const estado = args[0]?.toLowerCase();
                    if (estado === 'off') { room.iaAtiva = false; room.enviarMensagem("🤖 Cérebro desativado."); } 
                    else if (estado === 'on') { room.iaAtiva = true; room.enviarMensagem("🧠 Cérebro online."); }
                    break;
            }
            return;
        }

        if (senderName.toLowerCase() === CONFIG.BOT_USER.toLowerCase() || !room.iaAtiva) return;

        const textoMinusculo = texto.toLowerCase();
        
        const chamouBot = textoMinusculo.includes('isis') || textoMinusculo.includes('ísi');
        const tempoDesdeBotFalou = Date.now() - room.ultimaVezQueAIsisFalou;
        const mensagemCurta = texto.split(' ').length <= 12;
        const foiIndireta = !chamouBot && (tempoDesdeBotFalou <= 8000) && mensagemCurta;

        if (!chamouBot && tempoDesdeBotFalou < 2000) return;

        if (chamouBot || foiIndireta) {
            room.ultimaVezQueAIsisFalou = Date.now(); 

            geminiService.pensar(texto, senderName, room.cliente, room.historicoChat, room.perfisUsuario).then((resposta) => {
                
                const nomeAlvo = senderName.toLowerCase();
                const perfilAtual = room.perfisUsuario.get(nomeAlvo) || { pontos: 0, fofoca: "" };

                const afinidadeMatch = resposta.match(/<<AFFINITY:([+-]?\d+)>>/i);
                if (afinidadeMatch) {
                    perfilAtual.pontos += parseInt(afinidadeMatch[1]);
                    room.perfisUsuario.set(nomeAlvo, perfilAtual); 
                    mongoManager.salvarAfinidade(room.cliente.id, nomeAlvo, perfilAtual.pontos);
                    resposta = resposta.replace(/<<AFFINITY:[+-]?\d+>>/gi, '').trim();
                }

                const memoMatch = resposta.match(/<<MEMO:\s*([a-zA-Z0-9_]+)\s*\|\s*(.*?)>>/i);
                if (memoMatch) {
                    const alvoFofoca = memoMatch[1].toLowerCase().replace(/^guest_/, '');
                    const anotacao = memoMatch[2].trim();
                    const perfilAlvo = room.perfisUsuario.get(alvoFofoca) || { pontos: 0, fofoca: "" };
                    
                    if (anotacao.toUpperCase() === 'VAZIO' || anotacao.toUpperCase() === 'NENHUMA') {
                        perfilAlvo.fofoca = ""; 
                        console.log(`\x1b[33m[-] FOFOCA APAGADA DA NUVEM! Alvo: ${alvoFofoca}\x1b[0m`);
                    } else {
                        perfilAlvo.fofoca = anotacao; 
                        console.log(`\x1b[32m[+] FOFOCA GRAVADA! Alvo: ${alvoFofoca} | Memória: ${anotacao}\x1b[0m`);
                    }
                    
                    room.perfisUsuario.set(alvoFofoca, perfilAlvo);
                    mongoManager.salvarFofoca(room.cliente.id, alvoFofoca, perfilAlvo.fofoca); 
                    resposta = resposta.replace(/<<MEMO:\s*[a-zA-Z0-9_]+\s*\|.*?>>/gi, '').trim();
                }

                this.processarIA(resposta, room, senderName); 
            });
        }
    }

    public processarIA(resposta: string, room: RoomInstance, senderName: string) {
        const isAdmin = room.cliente.admins.includes(room.getUserIdByName(senderName) || '') || room.cliente.dono.toLowerCase() === senderName.toLowerCase();

        const actMatch = resposta.match(/<<ACT:(.+?)>>/gi);
        const hugMatch = resposta.match(/<<HUG:(.+?)>>/gi);
        const punchMatch = resposta.match(/<<PUNCH:(.+?)>>/gi);
        const sitMatch = resposta.match(/<<SIT:(.+?)>>/gi);
        const randomPoseMatch = resposta.match(/<<RANDOM_POSE>>/gi);
        
        // CIRURGIA 2: Extrator de ações nativas (emotes, moods, etc)
        const nativeMatch = resposta.match(/<<NATIVE:(.+?)>>/gi);

        let falaLimpa = resposta.replace(/<<[^>]+>>/g, '').trim();

        if (falaLimpa.length > 0) room.enviarMensagem(falaLimpa);

        setTimeout(() => {
            // Dispara ações nativas do IMVU usando o Dicionário Tradutor
            if (nativeMatch) {
                // Pegamos o nome da ação e passamos para minúsculo para garantir que vai achar no dicionário
                const acaoNome = nativeMatch[0].replace(/<<NATIVE:(.+?)>>/gi, '$1').trim().toLowerCase();
                
                // Mapeamento que você hackeou do servidor do IMVU Next
                const dicionarioAnimacoes: Record<string, string> = {
                    'clap': '2080',
                    'nod': '2092',
                    'yay': '2064',
                    'smile': '2087',
                    'nope': '2091',
                    'breakdance': '2071',
                    'kick': '2069',
                    'sleep': '2096'
                };

                const idAnimacao = dicionarioAnimacoes[acaoNome];

                // CIRURGIA: Bypass na engine de sala. Enviamos direto pro chat como um macro do IMVU.
                if (room.ws) {
                    if (idAnimacao) {
                        // Se achou a palavra no dicionário, manda o ID numérico oculto
                        room.enviarMensagem(`*use ${idAnimacao}`);
                        console.log(`\x1b[35m[Ação Nativa] Avatar animado: *use ${idAnimacao} (${acaoNome})\x1b[0m`);
                    } else {
                        // Fallback de segurança: Se a IA inventar uma palavra nova, manda ela crua
                        room.enviarMensagem(`*use ${acaoNome}`);
                        console.log(`\x1b[35m[Ação Nativa] Avatar animado (Fallback): *use ${acaoNome}\x1b[0m`);
                    }
                }
            }

            if (actMatch) acao([actMatch[0].replace(/<<ACT:(.+?)>>/gi, '$1').trim()], room);
            if (hugMatch) interacao([hugMatch[0].replace(/<<HUG:(.+?)>>/gi, '$1').trim()], room, 'hug');
            
            if (punchMatch && (isAdmin || senderName.toLowerCase() === CONFIG.BOT_USER.toLowerCase())) {
                interacao([punchMatch[0].replace(/<<PUNCH:(.+?)>>/gi, '$1').trim()], room, 'punch');
            }

            if (sitMatch) {
                const targetName = sitMatch[0].replace(/<<SIT:(.+?)>>/gi, '$1').trim();
                const targetId = room.getUserIdByName(targetName);
                
                if (targetId && room.userSeats.has(targetId)) {
                    const seatData = room.userSeats.get(targetId)!;
                    
                    // Tenta sentar no próximo nó disponível do móvel
                    const nextNode = parseInt(seatData.node) + 1; 
                    
                    // CIRURGIA: Cancela animações antes de mover
                    room.enviarMensagemOculta("*use 0");
                    room.moverParaPose(String(nextNode), seatData.furniId);
                }
            }

            if (randomPoseMatch) {
                const assentosConhecidos = Array.from(room.knownValidSeats);
                if (assentosConhecidos.length > 0) {
                    const sorteado = assentosConhecidos[Math.floor(Math.random() * assentosConhecidos.length)];
                    const [node, furniId] = sorteado.split('|');
                    room.moverParaPose(node, furniId);
                } else {
                    room.moverParaPose(String(Math.floor(Math.random() * 12) + 1), "0");
                }
            }
        }, 300);
    }
}
