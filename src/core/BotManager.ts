// src/core/BotManager.ts

import axios from 'axios';
import { CONFIG, ClienteConfig } from '../config';
import { Color } from '../utils/helpers';
import { RoomInstance } from './RoomInstance';
import { createClient } from '@supabase/supabase-js';
const WebSocket = require('ws');

export class BotManager {
    private osid: string = '';
    private osCsid: string = '';
    private sauce: string = '';
    private outfitString: string = '*use 191 80 85'; 
    private postHeaders: any = {};
    
    private supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
    public clientesAtivos: Map<string, RoomInstance> = new Map();
    // Guarda os cronômetros de cada cliente para a visita de 1 hora
    private temporizadoresDeVisita: Map<string, NodeJS.Timeout> = new Map();

    public async iniciar() {
        console.log(`${Color.Red}============================================================${Color.Reset}`);
        console.log(`${Color.Red}   [+] MOTOR DEUS-SEVEN (SAAS MULTI-TENANT) INICIADO [+]    ${Color.Reset}`);
        console.log(`${Color.Red}============================================================${Color.Reset}`);
        
        const autenticado = await this.autenticar();
        if (!autenticado) return;

        await this.carregarGuardaRoupa();

        for (const [clientId, clienteData] of Object.entries(CONFIG.CLIENTES)) {
            this.iniciarSessaoCliente(clienteData);
        }

        // INJEÇÃO: Liga o radar silencioso após criar as salas
        this.iniciarRadarFinanceiro();
    }

    private async autenticar(): Promise<boolean> {
        console.log(`${Color.Yellow}[*] Conectando aos servidores centrais...${Color.Reset}`);
        try {
            const loginRes = await axios.post('https://api.imvu.com/login', { 
                username: CONFIG.BOT_USER, password: CONFIG.BOT_PASS 
            }, { headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' } });

            if (loginRes.data.status !== 'success') return false;

            const match = JSON.stringify(loginRes.data).match(/"sauce":"([^"]+)"/);
            if (match) this.sauce = match[1];

            const cookies = loginRes.headers['set-cookie'];
            if (cookies) {
                cookies.forEach((c: string) => {
                    if (c.startsWith('osid=')) this.osid = c.split(';')[0].replace('osid=', '');
                    if (c.startsWith('osCsid=')) this.osCsid = c.split(';')[0].replace('osCsid=', '');
                });
            }

            this.postHeaders = { 'Cookie': `osid=${this.osid}; osCsid=${this.osCsid};`, 'X-Imvu-Application': 'next_desktop/1', 'User-Agent': 'Mozilla/5.0' };
            if (this.sauce) this.postHeaders['X-Imvu-Sauce'] = this.sauce;

            console.log(`${Color.Green}[+] Autenticação Mestre concluída.${Color.Reset}`);
            return true;
        } catch (e: any) {
            return false;
        }
    }

    private async carregarGuardaRoupa() {
        try {
            const avRes = await axios.get(`https://api.imvu.com/avatar/avatar-${CONFIG.AVATAR_ID}`, { headers: this.postHeaders });
            const productMatches = JSON.stringify(avRes.data).match(/product-(\d+)/g);
            if (productMatches) {
                const uniqueIds = [...new Set(productMatches.map(p => p.replace('product-', '')))];
                this.outfitString = `*use ${uniqueIds.join(' ')}`;
            }
        } catch (e) {}
    }

    public iniciarSessaoCliente(cliente: ClienteConfig, atrasoMs: number = 0) {
        setTimeout(() => {
            if (this.clientesAtivos.has(cliente.id)) return;

            // O RADAR DE COLISÃO DO MULTI-VERSO
            const verificarColisao = (targetRoomId: string): boolean => {
                for (const [id, inst] of this.clientesAtivos.entries()) {
                    if (inst.roomId === targetRoomId) return true;
                }
                return false;
            };

            const novaSala = new RoomInstance(
                cliente, 
                this.osid, 
                this.osCsid, 
                this.sauce, 
                this.outfitString,
                
                (intencional: boolean) => {
                    this.clientesAtivos.delete(cliente.id);
                    if (!intencional) {
                        console.log(`${Color.Red}[!] Cliente [${cliente.id}] caiu. Proteção de 20 min ativada.${Color.Reset}`);
                        this.iniciarSessaoCliente(cliente, 20 * 60 * 1000); 
                    }
                },
                
                (novaSalaId: string) => {
                    console.log(`${Color.Yellow}[*] Movimentando cliente [${cliente.id}] para a sala ${novaSalaId}.${Color.Reset}`);
                    this.clientesAtivos.delete(cliente.id);
                    cliente.salaAtual = novaSalaId; 
                    
                    if (this.temporizadoresDeVisita.has(cliente.id)) {
                        clearTimeout(this.temporizadoresDeVisita.get(cliente.id));
                        this.temporizadoresDeVisita.delete(cliente.id);
                    }

                    if (novaSalaId !== cliente.salaBase) {
                        console.log(`${Color.Yellow}[*] Cronômetro de 1 hora ativado para [${cliente.id}].${Color.Reset}`);
                        
                        const timer = setTimeout(() => {
                            console.log(`${Color.Cyan}[*] Tempo esgotado. Retornando [${cliente.id}] para a Base.${Color.Reset}`);
                            const salaViva = this.clientesAtivos.get(cliente.id);
                            
                            if (salaViva) {
                                salaViva.enviarMensagem("Tempo de visita esgotado, rapaziada. Tô voltando pra minha base, flw! ✌️");
                                
                                // USA A MESMA ROTA BLINDADA DO COMANDO !SAIR
                                setTimeout(() => {
                                    if (salaViva.onMoveRoom) {
                                        salaViva.desconectar();
                                        salaViva.onMoveRoom(cliente.salaBase);
                                    }
                                }, 1500);
                            }
                        }, 60 * 60 * 1000); 
                        
                        this.temporizadoresDeVisita.set(cliente.id, timer);
                    }
                    
                    // IMPORTANTE: Certifique-se de que a linha abaixo (que inicia a sessão) 
                    // continue existindo LOGO APÓS o fechamento do 'if' acima.
                    this.iniciarSessaoCliente(cliente, 3000); 
                },
                verificarColisao // <-- Passamos o radar pra dentro da sala
            );
            
            this.clientesAtivos.set(cliente.id, novaSala);
            novaSala.conectar();

        }, atrasoMs);
    }

    // ============================================================
    // 🏦 MOTOR FINANCEIRO (ESCUTA DE SOCKET DA CARTEIRA)
    // ============================================================
    private iniciarRadarFinanceiro() {
        const bot = this; // <-- ÂNCORA ABSOLUTA: O Node nunca mais vai perder o contexto

        console.log(`${Color.Yellow}[*] Inicializando Radar Financeiro (Socket da Carteira)...${Color.Reset}`);

        const ws = new WebSocket('wss://imq.imvu.com:444/streaming/imvu_pre', {
            headers: { 'Cookie': `osCsid=${bot.osCsid};`, 'User-Agent': 'Mozilla/5.0' },
            rejectUnauthorized: false
        });

        let heartbeat: NodeJS.Timeout;

        ws.on('open', () => {
            // Autentica o socket com a sessão mestre usando a âncora 'bot'
            ws.send(JSON.stringify({ 
                record: "msg_c2g_connect", 
                user_id: String(CONFIG.AVATAR_ID), 
                cookie: Buffer.from(bot.osCsid).toString('base64'), 
                metadata: [], 
                op_id: 1 
            }));

            // INJEÇÃO DEFINITIVA: Manda um PING em formato JSON a cada 20s para o IMVU não cortar
            heartbeat = setInterval(() => {
                if (ws.readyState === ws.OPEN) {
                    ws.send(JSON.stringify({ record: "msg_c2g_ping" })); 
                }
            }, 20000); 
        });

        ws.on('message', async (raw: any) => {
            try {
                const msg = JSON.parse(raw.toString());
                
                // Responde ao ping do servidor IMVU educadamente e sai fora
                if (msg.record === 'msg_g2c_ping') {
                    ws.send(JSON.stringify({ record: "msg_c2g_pong" }));
                    return;
                }

                // Ignora o próprio pong que o servidor nos manda de volta
                if (msg.record === 'msg_g2c_pong') {
                    return;
                }

                if (msg.record === 'msg_g2c_result' && msg.status === 0 && msg.op_id === 1) {
                    const queueCarteira = `inv:/wallet/wallet-${CONFIG.AVATAR_ID}`;
                    ws.send(JSON.stringify({ queues_with_results: [{ record: "subscription", name: queueCarteira, op_id: 2 }], record: "msg_c2g_subscribe" }));
                    console.log(`${Color.Green}[+] Radar Financeiro blindado na fila da carteira principal!${Color.Reset}`);
                }

                // GATILHO RESTRITO E SEGURO: Só audita se houver uma mensagem nova enviada para o usuário ou evento de saldo
                if (msg.record === 'msg_g2c_send_message' || (msg.name && msg.name.includes('wallet'))) {
                    console.log(`${Color.Cyan}[FINANCEIRO] Movimentação real detectada na carteira! Auditando extrato em 3s...${Color.Reset}`);
                    
                    setTimeout(() => { bot.auditarExtrato(); }, 3000);
                }
            } catch(e) {}
        });

        ws.on('close', () => {
            if (heartbeat) clearInterval(heartbeat);
            console.log(`${Color.Red}[!] Radar Financeiro caiu. Reiniciando o Socket invisível em 10s...${Color.Reset}`);
            setTimeout(() => { bot.iniciarRadarFinanceiro(); }, 10000);
        });

        ws.on('error', (err: any) => {
            console.log(`${Color.Red}[!] Erro de Rede no Radar Financeiro: ${err.message}${Color.Reset}`);
        });
    }
    
}
