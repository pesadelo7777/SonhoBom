import * as playdl from 'play-dl';
import youtubedl from 'youtube-dl-exec';
import ffmpeg from 'fluent-ffmpeg';
import { PassThrough } from 'stream';

ffmpeg.setFfmpegPath('C:\\ffmpeg\\ffmpeg.exe');

export class RadioService {
    private icecastUrl = 'icecast://source:hackme@localhost:8000/live.mp3';

    private mixer = new PassThrough(); 
    public masterLigado = false; // Tornamos público para o bot poder ler

    public fila: string[] = []; 
    public isProcessing: boolean = false; 
    private activeFfmpeg: any = null; 
    private activeYtDlp: any = null;
    
    private salaAtual: any = null;

    public setSala(room: any) {
        this.salaAtual = room;
    }

    private avisarSala(msg: string) {
        if (this.salaAtual && typeof this.salaAtual.enviarMensagem === 'function') {
            this.salaAtual.enviarMensagem(msg);
        } else {
            console.log('[SALA OFFLINE]:', msg);
        }
    }

    // Função auxiliar para saber se a música tá rolando
    public isTocando(): boolean {
        return this.activeFfmpeg !== null;
    }

    // === O MOTOR AUTO-RECUPERÁVEL ===
    private ligarMotorMestre() {
        if (this.masterLigado) return;
        this.masterLigado = true;
        console.log('[SISTEMA] Motor Mestre blindado. Icecast travado e online.');
        
        ffmpeg(this.mixer)
            .inputOptions('-re') 
            .audioCodec('libmp3lame')
            .audioBitrate('128k')
            .format('mp3')
            .outputOptions('-content_type', 'audio/mpeg')
            .save(this.icecastUrl)
            .on('error', (err) => { 
                console.log('[AVISO] Motor Mestre desarmou por inatividade. Limpando os canos...');
                this.masterLigado = false;
                this.mixer = new PassThrough(); // Troca a mesa de som quebrada por uma nova!
            })
            .on('end', () => {
                this.masterLigado = false;
                this.mixer = new PassThrough(); // Troca a mesa de som quebrada por uma nova!
            });
    }

    public pararAtual() {
        if (this.activeYtDlp) {
            this.activeYtDlp.kill('SIGKILL');
            this.activeYtDlp = null;
        }
        if (this.activeFfmpeg) {
            this.activeFfmpeg.kill('SIGKILL');
            this.activeFfmpeg = null;
        }
    }

    public async tocar(termoPesquisa: string): Promise<void> {
        try {
            this.isProcessing = true;
            this.ligarMotorMestre(); // Se o motor tiver caído, ele liga e recria a mesa aqui!

            const searchResults = await playdl.search(termoPesquisa, { limit: 1 });
            if (!searchResults || searchResults.length === 0) {
                this.avisarSala("⚠️ Não achei nenhuma pista com esse nome no Spotify.");
                this.isProcessing = false;
                return;
            }

            const video = searchResults[0];
            this.pararAtual();

            this.activeYtDlp = youtubedl.exec(video.url, { output: '-', format: 'bestaudio' }, { stdio: ['ignore', 'pipe', 'ignore'] });
            this.activeYtDlp.catch(() => {});

            if (this.activeYtDlp.stdout) {
                this.activeYtDlp.stdout.on('error', () => {});

                this.activeFfmpeg = ffmpeg(this.activeYtDlp.stdout)
                    .format('mp3')
                    .on('error', () => {})
                    .on('start', () => {
                        this.avisarSala(`▶️ Som na caixa: ${video.title}`);
                        this.isProcessing = false;
                    })
                    .on('end', () => {
                        this.activeFfmpeg = null; // Avisa o sistema que a música atual zerou
                        this.tocarProxima(); 
                    });

                this.activeFfmpeg.pipe(this.mixer, { end: false });
            }
        } catch (e: any) {
            this.isProcessing = false;
            this.avisarSala(`❌ Erro interno no paredão: ${e.message}`);
        }
    }

    public async tocarProxima() {
        if (this.fila.length > 0) {
            const proxima = this.fila.shift();
            if (proxima) {
                this.avisarSala(`⏭️ Trocando a música para próxima da fila...`);
                await this.tocar(proxima);
            }
        } else {
            this.avisarSala('📭 A fila acabou. Manda um !add aí!');
            this.pararAtual(); // Desliga a extração para não sobrecarregar
        }
    }
}

export const radioService = new RadioService();