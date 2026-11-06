/**
 * 以 Web Audio API 即時合成的音效，不需載入任何音檔。
 * 瀏覽器規定 AudioContext 必須在使用者操作後才能啟動，因此需先呼叫 unlock()。
 */
export class Sfx {
  /** 是否播放音效 */
  enabled = true;
  private ctx: AudioContext | null = null;
  private lastHit = 0;

  /** 在使用者點擊時建立／恢復 AudioContext。 */
  unlock(): void {
    this.ctx ??= new AudioContext();
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /**
   * 碰撞音效，內部做節流避免大量彈珠同時碰撞時爆音。
   * @param speed 彈珠撞擊時的速度，決定音量
   * @param isBumper 是否撞到保險桿（使用較低沉的音色）
   */
  hit(speed: number, isBumper: boolean): void {
    if (!this.ctx || !this.enabled || speed < 1) return;
    const now = this.ctx.currentTime;
    if (now - this.lastHit < 0.035) return;
    this.lastHit = now;
    const gain = Math.min(0.12, speed * 0.012);
    if (isBumper) this.tone(180, 0.12, 'square', gain);
    else this.tone(900 + Math.random() * 700, 0.05, 'sine', gain);
  }

  /** 得獎彈珠抵達終點時的提示音。 */
  finish(): void {
    this.tone(660, 0.12, 'triangle', 0.2);
    this.tone(990, 0.18, 'triangle', 0.2, 0.08);
  }

  /** 第一名抵達時的勝利旋律。 */
  win(): void {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.22, 0.25 + i * 0.12));
  }

  /**
   * 播放單一音調。
   * @param freq 頻率（Hz）
   * @param dur 持續秒數
   * @param type 波形
   * @param gain 音量 0~1
   * @param delay 延遲秒數
   */
  private tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0): void {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(amp).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur);
  }
}
