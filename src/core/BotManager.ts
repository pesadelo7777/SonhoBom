// src/core/BotManager.ts

import axios from 'axios';
import { CONFIG, ClienteConfig } from '../config';
import { Color } from '../utils/helpers';
import { RoomInstance } from './RoomInstance';
import { createClient } from '@supabase/supabase-js';

export class BotManager {
    private osid: string = '';
    private osCsid: string = '';
    private sauce: string = '';
    private outfitString: string = '*use 191 80 85'; 
    private postHeaders: any = {};
    
    private supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
    public clientesAtivos: Map<string, RoomInstance> = new Map();
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
        
        // O radar global obsoleto HTTP foi removido.
        // O controle financeiro agora é 100% matemático via RoomInstance.
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
                    if (c.includes('osid=')) {
                        const m = c.match(/osid=([^;]+)/);
                        if (m) this.osid = m[1];
                    }
                    if (c.includes('osCsid=')) {
                        const m = c.match(/osCsid=([^;]+)/);
                        if (m) this.osCsid = m[1];
                    }
                });
            }

            let cookieHeader = '';
            if (this.osid) cookieHeader += `osid=${this.osid}; `;
            if (this.osCsid) cookieHeader += `osCsid=${this.osCsid};`;

            this.postHeaders = { 
                'Cookie': cookieHeader.trim(), 
                'X-Imvu-Application': 'next_desktop/1', 
                'User-Agent': 'Mozilla/5.0' 
            };
            if (this.sauce) this.postHeaders['X-Imvu-Sauce'] = this.sauce;

            if (!this.osCsid) {
                console.log(`${Color.Red}[!] Falha Crítica: O osCsid não foi gerado.${Color.Reset}`);
                return false;
            }

            console.log(`${Color.Green}[+] Autenticação Mestre concluída.${Color.Reset}`);
            return true;
        } catch (e: any) {
            console.error("Erro na autenticação:", e.message);
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
                    
                    this.iniciarSessaoCliente(cliente, 3000); 
                },
                verificarColisao
            );
            
            this.clientesAtivos.set(cliente.id, novaSala);
            novaSala.conectar();

        }, atrasoMs);
    }
}
