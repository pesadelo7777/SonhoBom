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
        console.log(`${Color.Yellow}[*] Inicializando Radar Financeiro (Socket da Carteira)...${Color.Reset}`);

        const ws = new WebSocket('wss://imq.imvu.com:444/streaming/imvu_pre', {
            headers: { 'Cookie': `osCsid=${this.osCsid};`, 'User-Agent': 'Mozilla/5.0' },
            rejectUnauthorized: false
        });

        ws.on('open', () => {
            // Autentica o socket com a sessão mestre
            ws.send(JSON.stringify({ record: "msg_c2g_connect", user_id: String(CONFIG.AVATAR_ID), cookie: Buffer.from(this.osCsid).toString('base64'), metadata: [], op_id: 1 }));
        });

        ws.on('message', async (raw: any) => {
            try {
                const msg = JSON.parse(raw.toString());
                
                if (msg.record === 'msg_g2c_ping') {
                    ws.send(JSON.stringify({ record: "msg_c2g_pong" }));
                    return;
                }

                // Quando conecta com sucesso (status 0), se inscreve UNICAMENTE na carteira
                if (msg.record === 'msg_g2c_result' && msg.status === 0 && msg.op_id === 1) {
                    const queueCarteira = `inv:/wallet/wallet-${CONFIG.AVATAR_ID}`;
                    ws.send(JSON.stringify({ queues_with_results: [{ record: "subscription", name: queueCarteira, op_id: 2 }], record: "msg_c2g_subscribe" }));
                    console.log(`${Color.Green}[+] Radar Financeiro blindado na fila da carteira principal!${Color.Reset}`);
                }

                // O GATILHO (A "Assinatura" que achamos): Apenas o Admin pode enviar msg pra essa fila oculta
                if (msg.record === 'msg_g2c_send_message' && msg.user_id === 'YWRtaW4=') {
                    console.log(`${Color.Cyan}[FINANCEIRO] Movimentação na carteira detectada! Auditando extrato em 3s...${Color.Reset}`);

                    // Espera 3 segundos pro IMVU gerar a mensagem de comprovante no Inbox
                    setTimeout(() => this.auditarExtrato(), 3000);
                }
            } catch(e) {}
        });

        // Loop de auto-recuperação caso a rede do Render pisque
        ws.on('close', () => {
            console.log(`${Color.Red}[!] Radar Financeiro caiu. Reiniciando o Socket invisível em 10s...${Color.Reset}`);
            setTimeout(() => this.iniciarRadarFinanceiro(), 10000);
        });
    }

    private async auditarExtrato() {
        try {
            // Puxa as últimas 5 mensagens pra ver quem foi que mandou o dinheiro
            const msgRes = await axios.get('https://api.imvu.com/message/message', {
                headers: this.postHeaders,
                params: { limit: 5 }
            });

            const messages = msgRes.data.denormalized;
            if (!messages) return;

            for (const key in messages) {
                const msg = messages[key].data;

                // Tem que ser do Sistema do IMVU (user-1) e tem que ser Não Lida (unread: true) pra não creditar 2x
                if (msg && msg.unread && msg.sender === "http://api.imvu.com/user/user-1") {
                    const corpoMensagem = msg.message.toLowerCase();

                    // Se a mensagem contiver as palavras chaves do IMVU de transferência:
                    if (corpoMensagem.includes("credits from") || corpoMensagem.includes("créditos de")) {
                        const valorMatch = msg.message.match(/(\d+)\s*credits/i) || msg.message.match(/(\d+)\s*créditos/i);
                        const remetenteMatch = msg.message.match(/from\s+([a-zA-Z0-9_-]+)/i) || msg.message.match(/de\s+([a-zA-Z0-9_-]+)/i);

                        if (valorMatch && remetenteMatch) {
                            const creditosRecebidos = parseInt(valorMatch[1].replace(/[.,]/g, ''));
                            const nickPagador = remetenteMatch[1].toLowerCase();

                            console.log(`\x1b[32m[PAGAMENTO] ${creditosRecebidos} Créditos recebidos de @${nickPagador}\x1b[0m`);

                            // 1. MARCA COMO LIDA: Desarma a bomba na API do IMVU para não entregar moedas duplicadas se algo falhar abaixo
                            await axios.post(`https://api.imvu.com/message/message-${msg.id}`, { unread: false }, { headers: this.postHeaders });

                            // 2. ENTREGA O PRODUTO NO SUPABASE
                            const { data: userData } = await this.supabase.from('profiles').select('*').ilike('imvu_account', nickPagador).single();

                            if (userData) {
                                // SE MANDOU EXATAMENTE 20K -> ATIVA VIP 15
                                if (creditosRecebidos === 20000) {
                                    await this.supabase.from('profiles').update({ plano: 'VIP 15 Dias' }).eq('id', userData.id);
                                    console.log(`\x1b[35m[SISTEMA] Plano VIP 15 entregue automaticamente para @${nickPagador}\x1b[0m`);
                                } 
                                // SE MANDOU EXATAMENTE 35K -> ATIVA VIP 30
                                else if (creditosRecebidos === 35000) {
                                    await this.supabase.from('profiles').update({ plano: 'VIP 30 Dias' }).eq('id', userData.id);
                                    console.log(`\x1b[35m[SISTEMA] Plano VIP 30 entregue automaticamente para @${nickPagador}\x1b[0m`);
                                } 
                                // QUALQUER OUTRO VALOR -> SOMA NA CARTEIRA COMO MOEDAS AVULSAS (Ex: 1000 creditos = 5 moedas)
                                else {
                                    const moedasCompradas = Math.floor(creditosRecebidos / 200);
                                    if (moedasCompradas > 0) {
                                        await this.supabase.from('profiles').update({
                                            moedas_avulsas: (userData.moedas_avulsas || 0) + moedasCompradas
                                        }).eq('id', userData.id);
                                        console.log(`\x1b[32m[SISTEMA] +${moedasCompradas} Moedas entregues para @${nickPagador}\x1b[0m`);
                                    }
                                }
                            } else {
                                console.log(`\x1b[31m[ALERTA FINANCEIRO] @${nickPagador} pagou, mas não tem conta LifeVU vinculada!\x1b[0m`);
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.error("Erro Crítico ao auditar extrato:", e);
        }
    }
    
}
