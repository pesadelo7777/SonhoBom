// src/core/RoomInstance.ts

import axios from 'axios';
const WebSocket = require('ws');
import { mongoManager } from '../database/MongoManager';
import { CONFIG, ClienteConfig } from '../config';
import { b64Encode, b64Decode, Color } from '../utils/helpers';
import { CommandHandler } from '../commands/CommandHandler';
import { geminiService } from '../services/GeminiService';

export class RoomInstance {
    public cliente: ClienteConfig; 
    public roomId: string;
    
    public ws: any = null;
    private op_id: number = 1;
    private isInitializing: boolean = true;
    
    private heartbeatInterval: any = null;      
    private httpPresenceInterval: any = null;   
    
    private osid: string;
    private osCsid: string;
    private sauce: string;
    private outfitString: string;
    private postHeaders: any;
    
    public currentQueue: string = '';
    public currentMount: string = '';
    public iaAtiva: boolean = true; 
    public knownValidSeats: Set<string> = new Set(); 

    // --- NOVAS VARIÁVEIS DE CONSCIÊNCIA ---
    public historicoChat: string[] = [];
    public ultimaVezQueAIsisFalou: number = 0;
    public tempoDeEntrada: number = Date.now();

    // Substitua a linha antiga de afinidades por esta:
    public perfisUsuario = new Map<string, { pontos: number, fofoca: string }>();

    // --- VARIÁVEIS DE TÉDIO (PROATIVIDADE) ---
    public ultimaAtividadeChat: number = Date.now();
    private intervaloDeTedio: any = null;
    
    private conexaoEncerradaPropositalmente: boolean = false;
    private commandHandler = new CommandHandler();
    private tentandoVoltar: boolean = false; // <-- NOVA VARIÁVEL DE CONTROLE
    
    // As 3 funções de Callback
    public onLeaveRoom?: (intencional: boolean) => void;
    public onMoveRoom?: (novaSalaId: string) => void;
    public verificarColisao?: (roomId: string) => boolean;

    public roomName: string = 'Carregando...';
    public participantCount: number = 0;
    private currentParticipants: Set<string> = new Set();
    private userCache: Map<string, string> = new Map(); 
    private nameToIdCache: Map<string, string> = new Map(); 
    public userSeats: Map<string, { node: string, furniId: string }> = new Map(); 


    // O CONTRATO ATUALIZADO: Agora ele aceita o verificarColisao como 8º parâmetro
    constructor(
        cliente: ClienteConfig, 
        osid: string, 
        osCsid: string, 
        sauce: string, 
        outfitString: string, 
        onLeaveRoom?: (intencional: boolean) => void, 
        onMoveRoom?: (novaSalaId: string) => void, 
        verificarColisao?: (roomId: string) => boolean
    ) {        
        this.cliente = cliente;
        this.roomId = cliente.salaAtual; 
        this.osid = osid;
        this.osCsid = osCsid;
        this.sauce = sauce;
        this.outfitString = outfitString || "*use 191 80 85"; 
        
        this.onLeaveRoom = onLeaveRoom; 
        this.onMoveRoom = onMoveRoom;
        this.verificarColisao = verificarColisao; // Associa a função recebida
        
        this.isInitializing = true;

        this.postHeaders = {
            'Cookie': `osid=${this.osid}; osCsid=${this.osCsid};`,
            'X-Imvu-Application': 'next_desktop/1',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Origin': 'https://www.imvu.com',
            'Referer': 'https://www.imvu.com/'
        };
        if (this.sauce) this.postHeaders['X-Imvu-Sauce'] = this.sauce;
        this.userCache.set(String(CONFIG.AVATAR_ID), CONFIG.BOT_USER);

        // CIRURGIA: Puxa a memória do disco assim que o bot liga
        mongoManager.carregarPerfis(this.cliente.id).then(mapa => {
            this.perfisUsuario = mapa;
            console.log(`${Color.Green}[+] Memória de Perfis e Fofocas sincronizada!${Color.Reset}`);
        });
    }

    public gerarOpId() { return this.op_id++; }

    private async obterNomeUsuario(userId: string): Promise<string> {
        if (this.userCache.has(userId)) return this.userCache.get(userId)!;
        try {
            const res = await axios.get(`https://api.imvu.com/user/user-${userId}`, { headers: this.postHeaders });
            const data = res.data.denormalized[`https://api.imvu.com/user/user-${userId}`]?.data;
            const nomeReal = data?.username || data?.avatarname || `User-${userId}`;
            this.userCache.set(userId, nomeReal);
            this.nameToIdCache.set(nomeReal.toLowerCase(), userId);
            return nomeReal;
        } catch {
            return `User-${userId}`;
        }
    }

    public getUserIdByName(input: string): string | null {
        if (/^\d+$/.test(input)) return input;
        const cleanInput = input.replace('@', '').toLowerCase();
        for (const [name, id] of this.nameToIdCache.entries()) {
            const nameSemGuest = name.replace('guest_', '');
            if (nameSemGuest.includes(cleanInput)) return id;
        }
        return null;
    }

    public async obterNomeSala(targetRoomId: string): Promise<string> {
        try {
            const res = await axios.get(`https://api.imvu.com/room/room-${targetRoomId}`, { headers: this.postHeaders });
            const data = res.data.denormalized[`https://api.imvu.com/room/room-${targetRoomId}`]?.data;
            return data?.name || targetRoomId;
        } catch (e) {
            return targetRoomId;
        }
    }

    public conectar() {
        this.conexaoEncerradaPropositalmente = false;
        this.tempoDeEntrada = Date.now(); // CIRURGIA: Zera o cronômetro ao conectar
        console.log(`${Color.Yellow}[*] [Cliente: ${this.cliente.id} | Room-${this.roomId}] Estabelecendo túnel...${Color.Reset}`);
        
        this.ws = new WebSocket('wss://imq.imvu.com:444/streaming/imvu_pre', {
            headers: { 'Cookie': `osCsid=${this.osCsid};`, 'User-Agent': 'Mozilla/5.0' },
            rejectUnauthorized: false
        });

        setTimeout(() => {
            this.isInitializing = false;
            // Passa o cliente para a IA saber qual persona usar
            geminiService.chegarNaSala(this.cliente).then((fraseDeChegada) => {
                this.commandHandler.processarIA(fraseDeChegada, this, CONFIG.BOT_USER);
            });
        }, 5000);

        this.ws.on('open', () => {
            this.ws.send(JSON.stringify({ record: "msg_c2g_connect", user_id: String(CONFIG.AVATAR_ID), cookie: b64Encode(this.osCsid), metadata: [], op_id: this.gerarOpId() }));
        });

        this.ws.on('message', async (raw: any) => {
            try {
                const msg = JSON.parse(raw.toString());
                if (msg.record === 'msg_g2c_pong') return;
                if (msg.record === 'msg_g2c_ping') {
                    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ record: "msg_c2g_pong" }));
                    return;
                }

                if (msg.record === 'msg_g2c_joined_queue' && msg.queue && msg.queue.includes('/chat/')) {
                    const joinedId = String(msg.user_id).trim();
    
                    if (joinedId && joinedId !== String(CONFIG.AVATAR_ID) && !this.currentParticipants.has(joinedId)) {
                        this.currentParticipants.add(joinedId);
                        this.participantCount = this.currentParticipants.size;
                        const nome = await this.obterNomeUsuario(joinedId);
                        console.log(`${Color.Green}[+] @${nome} entrou na sala do cliente [${this.cliente.id}].${Color.Reset}`);
        
                        // CIRURGIA: A trava temporal de 20 segundos que barra os "fantasmas"
                        const tempoNaSala = Date.now() - this.tempoDeEntrada;
        
                        if (tempoNaSala > 20000) {
                            // Limpa o nome na hora de buscar para garantir que "Guest_Valmont" puxe a fofoca de "valmont"
                            const nomeBase = nome.toLowerCase().replace(/^guest_/, '');
                            const memoria = this.perfisUsuario.get(nomeBase) || this.perfisUsuario.get(nome.toLowerCase()); 
                            
                            geminiService.saudarUsuario(nome, this.cliente, memoria).then((saudacao) => {
                                if (this.ws && this.ws.readyState === WebSocket.OPEN) this.enviarMensagem(saudacao);
                            });
                        }
                    }
                    return;
                }

                if (msg.record === 'msg_g2c_left_queue' && msg.queue && msg.queue.includes('/chat/')) {
                    const leftId = String(msg.user_id).trim();
                    if (leftId && this.currentParticipants.has(leftId)) {
                        this.currentParticipants.delete(leftId);
                        this.participantCount = this.currentParticipants.size;
                        this.userSeats.delete(leftId);
                    }
                    return;
                }

                if (msg.record === 'msg_g2c_result' && msg.status === 0 && msg.op_id === 1) await this.processarEntradaFisica();

                if (msg.record === 'msg_g2c_create_mount' && msg.type === 1) {
                    if (msg.queue.includes('/chat/') && (msg.mount === 'web_msg' || msg.mount === 'messages')) {
                        this.currentQueue = msg.queue;
                        this.currentMount = msg.mount;
                        console.log(`${Color.Green}[+] [${this.cliente.id}] Radar Ativo! Online com ${this.participantCount} jogadores.${Color.Reset}`);
                        this.injetarRenderizacao();
                    }
                }

                if (msg.record === 'msg_g2c_send_message') {
                    const senderIdLimpo = b64Decode(msg.user_id).replace('user-', '').trim();
                    const decodedMsg = b64Decode(msg.message);

                    let rawText = '';
                    try { rawText = JSON.parse(decodedMsg).message || ''; } catch { rawText = decodedMsg; }

                    if (rawText.startsWith('*msg SeatAssignment')) {
                        const parts = rawText.trim().split(/\s+/);
                        let userId, node, furniId;
                        
                        if (parts.length >= 6) { userId = parts[3]; node = parts[4]; furniId = parts[5]; } 
                        else if (parts.length === 5) { userId = parts[2]; node = parts[3]; furniId = parts[4]; }
                        
                        if (userId && node && furniId) {
                            // CIRURGIA: Ela ignora a própria ID para não bugar o rastreio
                            if (userId !== String(CONFIG.AVATAR_ID)) {
                                this.userSeats.set(userId, { node: node, furniId: furniId });
                                this.knownValidSeats.add(`${node}|${furniId}`);
                               //  console.log(`\x1b[36m[Radar de Poses] @${userId} mapeado no nó ${node} (Móvel: ${furniId})\x1b[0m`);
                            }
                        }
                    }

                    const textoPuro = this.extrairTextoDaMensagem(decodedMsg);
                    if (textoPuro) {
                        // CIRURGIA TÉDIO: Alguém falou! Zera o relógio de inatividade da sala.
                        this.ultimaAtividadeChat = Date.now();

                        const senderName = await this.obterNomeUsuario(senderIdLimpo);
                        const tagSala = `${this.cliente.id} (${this.participantCount})`;

                        // CIRURGIA: Grava a fala no histórico (Mantém só as últimas 20)
                        this.historicoChat.push(`${senderName}: ${textoPuro}`);
                        if (this.historicoChat.length > 13) this.historicoChat.shift();

                        if (senderIdLimpo === String(CONFIG.AVATAR_ID)) {
                            console.log(`${Color.Cyan}[Bot | ${tagSala}] >>${Color.Reset} ${textoPuro}`);
                            // CIRURGIA: Registra o momento exato que ela falou
                            this.ultimaVezQueAIsisFalou = Date.now(); 
                        } else {
                            console.log(`${Color.Gray}[Chat | ${tagSala} | @${senderName}] >>${Color.Reset} ${textoPuro}`);
                        }
                        
                        this.commandHandler.processar(textoPuro, senderName, senderIdLimpo, this);
                    }
                }
            // ==========================================
                // 🏦 INJEÇÃO: DETECTOR DE CARTEIRA NA SALA
                // ==========================================
                if (msg.record === 'updateCreditBalances' || msg.record === 'messageReceived' || msg.record === 'private_invalidation') {
                    console.log(`${Color.Cyan}[FINANCEIRO - SALA] Evento detectado na rede (${msg.record})! Acionando radar mestre em 3s...${Color.Reset}`);
                    
                    setTimeout(async () => {
                        try {
                            // Como o radar mestre (BotManager) tem acesso ao Supabase, vamos apenas simular 
                            // a leitura do extrato direto daqui de forma assíncrona, usando a mesma lógica!
                            const { data: { default: axios } } = await import('axios');
                            
                            const msgRes = await axios.get('https://api.imvu.com/message/message', {
                                headers: this.postHeaders,
                                params: { limit: 5 }
                            });

                            const messages = msgRes.data.denormalized;
                            if (!messages) return;

                            for (const key in messages) {
                                const msgInbox = messages[key].data;
                                if (msgInbox && msgInbox.unread && msgInbox.sender === "http://api.imvu.com/user/user-1") {
                                    const corpo = msgInbox.message.toLowerCase();

                                    if (corpo.includes("credits from") || corpo.includes("créditos de")) {
                                        const valorMatch = msgInbox.message.match(/(\d+)\s*credits/i) || msgInbox.message.match(/(\d+)\s*créditos/i);
                                        const remetenteMatch = msgInbox.message.match(/from\s+([a-zA-Z0-9_-]+)/i) || msgInbox.message.match(/de\s+([a-zA-Z0-9_-]+)/i);

                                        if (valorMatch && remetenteMatch) {
                                            const creditos = parseInt(valorMatch[1].replace(/[.,]/g, ''));
                                            const nickPagador = remetenteMatch[1].toLowerCase();

                                            console.log(`\x1b[32m[PAGAMENTO DIRETO] ${creditos} Créditos de @${nickPagador}\x1b[0m`);

                                            await axios.post(`https://api.imvu.com/message/message-${msgInbox.id}`, { unread: false }, { headers: this.postHeaders });

                                            // Re-cria a instância local do banco
                                            const supabase = require('@supabase/supabase-js').createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
                                            const { data: userData } = await supabase.from('profiles').select('*').ilike('imvu_account', nickPagador).single();

                                            if (userData) {
                                                if (creditos === 20000) {
                                                    await supabase.from('profiles').update({ plano: 'VIP 15 Dias' }).eq('id', userData.id);
                                                } else if (creditos === 35000) {
                                                    await supabase.from('profiles').update({ plano: 'VIP 30 Dias' }).eq('id', userData.id);
                                                } else {
                                                    const moedas = Math.floor(creditos / 200);
                                                    if (moedas > 0) {
                                                        await supabase.from('profiles').update({ moedas_avulsas: (userData.moedas_avulsas || 0) + moedas }).eq('id', userData.id);
                                                    }
                                                }
                                                console.log(`\x1b[32m[SISTEMA - SALA] Conta de @${nickPagador} carregada!\x1b[0m`);
                                            } else {
                                                console.log(`\x1b[31m[ALERTA] @${nickPagador} pagou, mas não tem conta LifeVU!\x1b[0m`);
                                            }
                                        }
                                    }
                                }
                            }
                        } catch (err) {
                            // Silencia erro para não quebrar a sala
                        }
                    }, 3000);
                }
                
            } catch (e) {}
        });

        this.ws.on('close', (code: number) => {
            this.limparIntervalos();
            if (this.conexaoEncerradaPropositalmente) {
                console.log(`${Color.Yellow}[-] [${this.cliente.id}] Túnel encerrado com sucesso.${Color.Reset}`);
                if (this.onLeaveRoom) this.onLeaveRoom(true); 
            } else {
                console.log(`${Color.Red}[!] [${this.cliente.id}] Queda Inesperada (Cod: ${code})! Iniciando resgate...${Color.Reset}`);
                // CIRURGIA: Em vez de desistir, aciona o loop de desconexão
                this.forcarRetornoBase('desconexao'); 
            }
        });
        this.iniciarMotoresDeResiliencia();
    }

    private async processarEntradaFisica() {
        try {
            // Tenta colocar o corpo na sala. Aqui é onde a API avisa se estamos expulsos ou se a sala tá cheia.
            await axios.post(`https://api.imvu.com/chat/chat-${this.roomId}/participants`, {}, { headers: this.postHeaders });
            
            try { await axios.post(`https://api.imvu.com/scene/scene-${this.roomId}/participants`, {}, { headers: this.postHeaders }); } catch {}

            let chatQ = "", roomQ = "", sceneQ = "";
            try {
                const roomRes = await axios.get(`https://api.imvu.com/room/room-${this.roomId}`, { headers: this.postHeaders });
                this.roomName = roomRes.data.denormalized[`https://api.imvu.com/room/room-${this.roomId}`]?.data?.name || this.roomId;
                const chatRes = await axios.get(`https://api.imvu.com/chat/chat-${this.roomId}`, { headers: this.postHeaders });
                const chatData = chatRes.data.denormalized[`https://api.imvu.com/chat/chat-${this.roomId}`]?.data;
                if (chatData && chatData.participants) {
                    this.currentParticipants = new Set(chatData.participants.map((p: any) => p.replace('http://api.imvu.com/user/user-', '')));
                    this.participantCount = this.currentParticipants.size;
                }
                chatQ = chatData?.imq_queue;
                roomQ = roomRes.data.denormalized[`https://api.imvu.com/room/room-${this.roomId}`]?.data?.imq_queue;
                const sceneRes = await axios.get(`https://api.imvu.com/scene/scene-${this.roomId}`, { headers: this.postHeaders });
                sceneQ = sceneRes.data.denormalized[`https://api.imvu.com/scene/scene-${this.roomId}`]?.data?.imq_queue;
            } catch {}

            this.ws.send(JSON.stringify({ record: "msg_c2g_open_floodgates" }));
            const assinaturas = [];
            if (chatQ) assinaturas.push({ record: "subscription", name: chatQ, op_id: this.gerarOpId() });
            if (roomQ) assinaturas.push({ record: "subscription", name: roomQ, op_id: this.gerarOpId() });
            if (sceneQ) assinaturas.push({ record: "subscription", name: sceneQ, op_id: this.gerarOpId() });
            this.ws.send(JSON.stringify({ queues_with_results: assinaturas, record: "msg_c2g_subscribe" }));
            
        } catch (error: any) {
            // CIRURGIA: Interceptador de Bloqueios da API
            const statusCode = error.response?.status;
            
            if (statusCode === 401 || statusCode === 403) {
                // 401/403 = Access Denied (Banido da sala, expulso ou restrito)
                this.forcarRetornoBase('expulso');
            } else {
                // Outros erros (geralmente 400 ou 409) indicam Room Full (Sala Cheia)
                this.forcarRetornoBase('cheia');
            }
        }
    }

    private injetarRenderizacao() {
        setTimeout(() => this.moverParaPose("1", "0"), 2000);
        setTimeout(() => this.enviarMensagemOculta(this.outfitString), 3000);
    }

    public enviarMensagem(texto: string) {
        if (this.ws && this.currentQueue && this.currentMount) {
            const chatIdNum = parseInt(this.currentQueue.split('/').pop() || '0');
            const textoLimpo = texto.replace(/<<[^>]+>>/g, '').trim();
            const payload = JSON.stringify({ to: 0, message: textoLimpo, userId: parseInt(String(CONFIG.AVATAR_ID)), chatId: chatIdNum });
            this.ws.send(JSON.stringify({ record: "msg_c2g_send_message", queue: this.currentQueue, mount: this.currentMount, message: b64Encode(payload), op_id: this.gerarOpId() }));
        }
    }

    public enviarMensagemOculta(comandoStr: string) {
        if (this.ws && this.currentQueue && this.currentMount) {
            const chatIdNum = parseInt(this.currentQueue.split('/').pop() || '0');
            const payload = JSON.stringify({ to: 0, message: comandoStr, userId: parseInt(String(CONFIG.AVATAR_ID)), chatId: chatIdNum });
            this.ws.send(JSON.stringify({ record: "msg_c2g_send_message", queue: this.currentQueue, mount: this.currentMount, message: b64Encode(payload), op_id: this.gerarOpId() }));
        }
    }

    private extrairTextoDaMensagem(mensagemDecodificada: string): string | null {
        try {
            const obj = JSON.parse(mensagemDecodificada);
            if (obj.message && !obj.message.startsWith('*')) return obj.message;
            return null;
        } catch {
            if (mensagemDecodificada.startsWith('*')) return null;
            return mensagemDecodificada;
        }
    }

    public async moverParaPose(node: string, furniId: string) {
        if (!this.ws || !this.currentQueue || !this.currentMount) return;
        
        const avatarIdNum = parseInt(String(CONFIG.AVATAR_ID));
        const nodeNum = parseInt(node);
        const furniIdStr = String(furniId);

        // console.log(`\x1b[36m[Motor Físico] Tentando mover para Nó: ${nodeNum} | Móvel: ${furniIdStr}\x1b[0m`);

        // 1. Comando Legado (IMVU Classic)
        this.enviarMensagemOculta(`*msg SeatAssignment 1 ${avatarIdNum} ${nodeNum} ${furniIdStr}`);
        
        // 2. Persistência na API (O "Pulo do Gato": o Next prioriza a API para móveis)
        try {
            await axios.post(`https://api.imvu.com/chat/chat-${this.roomId}/participants/user-${avatarIdNum}`, { 
                seat_furni_id: furniIdStr, 
                seat_number: nodeNum 
            }, { headers: this.postHeaders });
        } catch (e) {
            console.error("[Motor Físico] Erro ao sentar via API:", e);
        }
    }

    private iniciarMotoresDeResiliencia() {
        this.heartbeatInterval = setInterval(() => { if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ record: "msg_c2g_ping" })); }, 15000); 
        this.httpPresenceInterval = setInterval(async () => {
            try {
                await axios.post(`https://api.imvu.com/chat/chat-${this.roomId}/participants/user-${CONFIG.AVATAR_ID}`, {}, { headers: this.postHeaders });
                await axios.get(`https://api.imvu.com/user/user-${CONFIG.AVATAR_ID}`, { headers: this.postHeaders });
            } catch {}
        }, 45000); 

        // CIRURGIA TÉDIO E INQUIETAÇÃO FÍSICA
        this.intervaloDeTedio = setInterval(async () => {
            if (!this.iaAtiva || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

            const tempoSemFalar = Date.now() - this.ultimaAtividadeChat;
            const LIMITE_TEDIO = 7 * 60 * 1000; // 5 minutos (altere para 1 * 60 * 1000 para testar rápido)

            // Se a sala morreu de tédio
            if (tempoSemFalar >= LIMITE_TEDIO && this.participantCount > 0) {
                
                // 1. INQUIETAÇÃO ESPACIAL: Ela muda de cadeira sozinha
                if (this.knownValidSeats && this.knownValidSeats.size > 0) {
                    const cadeiras = Array.from(this.knownValidSeats);
                    // Escolhe um node/assento aleatório que ela já mapeou na sala
                    const cadeiraAleatoria = cadeiras[Math.floor(Math.random() * cadeiras.length)];
                    
                    // Dispara o payload nativo do IMVU para mover o avatar
                    this.ws.send(JSON.stringify({
                        record: 'msg_c2g_room_move',
                        node_id: cadeiraAleatoria
                    }));
                    console.log(`\x1b[35m[*] Inquietação Física: Isis levantou e mudou para o assento ${cadeiraAleatoria}\x1b[0m`);
                }

                // 2. TÉDIO VERBAL: Ela puxa assunto no chat
                const nomesPresentes = [];
                for (const id of Array.from(this.currentParticipants).slice(0, 5)) {
                    nomesPresentes.push(await this.obterNomeUsuario(id));
                }

                const contextoOculto = `[SISTEMA INFORMA]: O chat está em silêncio absoluto há um tempo. Você acabou de levantar e trocar de lugar na sala porque estava entediada. Os usuários presentes agora são: ${nomesPresentes.join(', ')}. Reclame do tédio, faça uma pergunta ou zoe alguém da lista para quebrar o gelo.`;

                this.ultimaAtividadeChat = Date.now(); 
                this.ultimaVezQueAIsisFalou = Date.now();

                geminiService.pensar(contextoOculto, "Consciencia", this.cliente, this.historicoChat, this.perfisUsuario).then((resposta) => {
                    this.commandHandler.processarIA(resposta, this, "Consciencia");
                });
            }
        }, 60000); // O motor avalia o tédio a cada 1 minuto
    }

    private limparIntervalos() {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        if (this.httpPresenceInterval) clearInterval(this.httpPresenceInterval);
        if (this.intervaloDeTedio) clearInterval(this.intervaloDeTedio); // Limpa o tédio ao sair
    }


    // ==========================================
    // 🛡️ MOTOR DE RESILIÊNCIA (AUTO-REJOIN)
    // ==========================================
    public async forcarRetornoBase(motivo: 'expulso' | 'cheia' | 'desconexao') {
        if (this.tentandoVoltar) return; // Evita loop duplo
        this.tentandoVoltar = true;
        
        // Puxa a sala oficial do cliente configurada no seu JSON
        const salaAlvo = this.cliente.salaBase; 

        let tempoEsperaMs = 60000; // Padrão: 1 minuto
        if (motivo === 'expulso') {
            console.log(`${Color.Yellow}[!] [${this.cliente.id}] Fomos expulsos ou bloqueados da sala. Cooldown de 20 mins ativado...${Color.Reset}`);
            tempoEsperaMs = 20 * 60 * 1000;
        } else if (motivo === 'cheia') {
            console.log(`${Color.Yellow}[!] [${this.cliente.id}] A sala ${salaAlvo} está lotada. Aguardando na fila (1 min)...${Color.Reset}`);
        } else {
            console.log(`${Color.Yellow}[!] [${this.cliente.id}] Queda de rede detectada. Reconectando em 1 min...${Color.Reset}`);
        }

        // Corta a conexão atual para o bot não ficar como "zumbi" no servidor
        if (this.ws) {
            this.ws.removeAllListeners();
            this.ws.close();
            this.limparIntervalos();
        }

        // O Despertador
        setTimeout(() => {
            console.log(`${Color.Cyan}[*] [${this.cliente.id}] Acordando do Auto-Rejoin. Retornando para a base: ${salaAlvo}...${Color.Reset}`);
            this.tentandoVoltar = false;
            
            // Avisa o BotManager para criar uma nova instância limpa apontando para a base
            if (this.onMoveRoom) {
                this.onMoveRoom(salaAlvo); 
            }
        }, tempoEsperaMs);
    }

    public async desconectar() {
        this.conexaoEncerradaPropositalmente = true;
        
        // 1. O CORPO: Retira fisicamente o avatar 3D da sala
        try {
            const leaveUrl = `https://api.imvu.com/chat/chat-${this.roomId}/participants/user-${CONFIG.AVATAR_ID}`;
            await axios.delete(leaveUrl, { headers: this.postHeaders });
            console.log(`${Color.Yellow}[-] Corpo 3D removido da sala ${this.roomId}.${Color.Reset}`);
        } catch (e) {}

        // 2. A MENTE: Fecha o túnel de chat e limpa a memória
        if (this.ws) {
            this.ws.removeAllListeners();
            this.ws.close();
            this.limparIntervalos();
        }
    }
}
