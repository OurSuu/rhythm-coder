// src/utils/AudioAnalyzer.ts

export class AudioController {
    audioContext: AudioContext | null = null;
    analyser: AnalyserNode | null = null;
    source: MediaElementAudioSourceNode | null = null;
    dataArray: Uint8Array | null = null;

    // เริ่มต้นระบบเสียง (ต้องเรียกหลังจาก User กดปุ่ม Start เท่านั้น Browser ถึงยอมให้รัน)
    setup(audioElement: HTMLAudioElement) {
        if (this.audioContext) return; // ป้องกันการสร้างซ้ำ

        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();

        // fftSize = ความละเอียดในการจับเสียง (256 ได้ข้อมูล 128 ช่อง)
        this.analyser.fftSize = 256;

        this.source = this.audioContext.createMediaElementSource(audioElement);
        this.source.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);

        const bufferLength = this.analyser.frequencyBinCount;
        this.dataArray = new Uint8Array(bufferLength);
    }

    // ดึงค่าความดังของเสียงในขณะนั้น
    getAnalysis() {
        // 1. สร้างตัวแปร Local มารับค่า (TypeScript จะยอมรับการเช็คค่าแบบนี้)
        const analyser = this.analyser;
        const dataArray = this.dataArray;

        // 2. เช็คที่ตัวแปร Local แทน
        if (!analyser || !dataArray) return { bass: 0, mid: 0, high: 0 };

        // 3. เรียกใช้ได้เลย ไม่ต้องมี as Uint8Array แล้ว
        analyser.getByteFrequencyData(dataArray);

        // คำนวณค่าเฉลี่ย
        const bass = this.average(dataArray.slice(0, 10));
        const mid = this.average(dataArray.slice(10, 50));
        const high = this.average(dataArray.slice(50, 100));

        return { bass, mid, high };
    }

    // ฟังก์ชันช่วยหาค่าเฉลี่ย
    private average(arr: ArrayLike<number>) {
        if (arr.length === 0) return 0;
        let sum = 0;
        for (let i = 0; i < arr.length; i++) {
            sum += arr[i];
        }
        return sum / arr.length;
    }

    resume() {
        this.audioContext?.resume();
    }
}