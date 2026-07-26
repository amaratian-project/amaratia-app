import { File, Paths } from 'expo-file-system';

const MAX_LOG_SIZE = 1024 * 500; // 500 KB
const logFile = new File(Paths.document, 'amaratia-telemetry.log');

class TelemetryLogger {
  private logQueue: string[] = [];
  private isWriting = false;

  private formatMessage(level: 'INFO' | 'WARN' | 'ERROR', message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` | ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level}] ${message}${metaStr}\n`;
  }

  private async flush() {
    if (this.isWriting || this.logQueue.length === 0) return;
    this.isWriting = true;

    try {
      const logsToWrite = this.logQueue.join('');
      this.logQueue = [];

      if (!logFile.exists) {
        logFile.create();
      } else {
        const size = logFile.size;
        if (size > MAX_LOG_SIZE) {
          logFile.delete();
          logFile.create();
        }
      }

      const existing = logFile.text();
      logFile.write(existing + logsToWrite);
    } catch (e) {
      console.error('Fallo crítico escribiendo el log de telemetría', e);
    } finally {
      this.isWriting = false;
      if (this.logQueue.length > 0) {
        this.flush();
      }
    }
  }

  log(message: string, meta?: any) {
    if (__DEV__) console.log(`📘 ${message}`, meta || '');
    this.logQueue.push(this.formatMessage('INFO', message, meta));
    this.flush();
  }

  warn(message: string, meta?: any) {
    if (__DEV__) console.warn(`⚠️ ${message}`, meta || '');
    this.logQueue.push(this.formatMessage('WARN', message, meta));
    this.flush();
  }

  error(message: string, error?: any) {
    if (__DEV__) console.error(`❌ ${message}`, error || '');
    this.logQueue.push(this.formatMessage('ERROR', message, error?.message || error));
    this.flush();
  }

  async getLogContents(): Promise<string> {
    try {
      if (logFile.exists) {
        return logFile.text();
      }
      return 'No hay logs de telemetría disponibles.';
    } catch (e) {
      return `Error leyendo los logs: ${e}`;
    }
  }
}

export const Logger = new TelemetryLogger();
